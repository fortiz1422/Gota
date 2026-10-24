import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encryptMercadoPagoToken, decryptMercadoPagoToken } from './token-crypto'
import type { MercadoPagoConnection } from './server-repository'
import type { OAuthConfig } from './oauth'

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), update: vi.fn(), database: vi.fn() }))
vi.mock('./oauth', () => ({ exchangeMercadoPagoRefreshToken: mocks.refresh }))
vi.mock('./server-repository', () => ({ updateMercadoPagoConnection: mocks.update }))
vi.mock('./sync-lease', () => ({ backgroundDatabase: mocks.database }))
import { getValidMercadoPagoAccessToken } from './access-token'

const now = new Date('2026-10-23T20:00:00Z')
const key = Buffer.alloc(32, 7).toString('base64')
const cipher = (plaintext: string) => encryptMercadoPagoToken({ plaintext, encryptionKey: key })
const config: OAuthConfig = { clientId: 'test-id', clientSecret: 'test-secret', redirectUri: 'https://gota.test/callback', scope: 'offline_access read', tokenEncryptionKey: key }
const connection = (patch: Partial<MercadoPagoConnection> = {}): MercadoPagoConnection => ({
  id: 'connection', linked_account_id: null, linked_account_version: 0, provider_user_id: '42', status: 'connected',
  access_token_ciphertext: cipher('old-access'), refresh_token_ciphertext: cipher('old-refresh'),
  token_expires_at: '2026-10-23T20:00:20Z', last_sync_at: null, ...patch,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(now)
  mocks.refresh.mockResolvedValue({ accessToken: 'new-access', refreshToken: 'new-refresh', userId: '42', expiresAt: '2026-10-24T20:00:00Z' })
  mocks.update.mockResolvedValue(undefined)
})
afterEach(() => vi.useRealTimers())

describe('Mercado Pago access token lifecycle', () => {
  it('reuses a token outside the refresh window without network or persistence', async () => {
    expect(await getValidMercadoPagoAccessToken('user', connection({ token_expires_at: '2026-10-23T20:00:31Z' }), config)).toBe('old-access')
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('refreshes an expiring token and persists encrypted rotated credentials before returning it', async () => {
    expect(await getValidMercadoPagoAccessToken('user', connection(), config)).toBe('new-access')
    expect(mocks.refresh).toHaveBeenCalledWith({ refreshToken: 'old-refresh', config })
    const [user, id, patch] = mocks.update.mock.calls[0]
    expect([user, id]).toEqual(['user', 'connection'])
    expect(decryptMercadoPagoToken({ ciphertext: patch.access_token_ciphertext, encryptionKey: key })).toBe('new-access')
    expect(decryptMercadoPagoToken({ ciphertext: patch.refresh_token_ciphertext, encryptionKey: key })).toBe('new-refresh')
    expect(patch).toMatchObject({ status: 'connected', last_error_code: null, token_expires_at: '2026-10-24T20:00:00Z' })
    expect(JSON.stringify(patch)).not.toContain('new-access')
    expect(JSON.stringify(patch)).not.toContain('new-refresh')
  })

  it('asks for a refresh no longer than the time left before the capture deadline', async () => {
    await getValidMercadoPagoAccessToken('user', connection(), config, undefined, now.getTime() + 2_500)
    const timeoutMs = mocks.refresh.mock.calls[0][0].timeoutMs as number
    expect(timeoutMs).toBeLessThanOrEqual(2_500)
    expect(timeoutMs).toBeLessThan(8_000)
  })

  it('preserves the existing refresh token when the provider does not rotate it', async () => {
    mocks.refresh.mockResolvedValue({ accessToken: 'new-access', refreshToken: null, expiresAt: null })
    const row = connection()
    await getValidMercadoPagoAccessToken('user', row, config)
    expect(mocks.update.mock.calls[0][2].refresh_token_ciphertext).toBe(row.refresh_token_ciphertext)
  })

  it.each([
    [{ status: 'revoked' as const }, 'not_connected'],
    [{ access_token_ciphertext: null }, 'not_connected'],
    [{ token_expires_at: 'invalid' }, 'invalid_token_expiry'],
    [{ refresh_token_ciphertext: null }, 'refresh_unavailable'],
  ])('rejects unusable credentials before refresh: %s', async (patch, reason) => {
    await expect(getValidMercadoPagoAccessToken('user', connection(patch), config)).rejects.toThrow(reason)
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('does not return an unpersisted replacement after a persistence failure', async () => {
    mocks.update.mockRejectedValue(new Error('connection_update_failed'))
    await expect(getValidMercadoPagoAccessToken('user', connection(), config)).rejects.toThrow('connection_update_failed')
  })

  it('does not persist credentials when provider refresh fails', async () => {
    mocks.refresh.mockRejectedValue(new Error('provider unavailable'))
    await expect(getValidMercadoPagoAccessToken('user', connection(), config)).rejects.toThrow('provider unavailable')
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it.each([{ data: null, error: null }, { data: null, error: new Error('database unavailable') }])('rejects a stale or failed lease write instead of returning its token', async result => {
    const query = { eq: vi.fn(), gt: vi.fn(), in: vi.fn(), not: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue(result) }
    for (const method of ['eq', 'gt', 'in', 'not', 'select'] as const) query[method].mockReturnValue(query)
    const update = vi.fn().mockReturnValue(query)
    const from = vi.fn().mockReturnValue({ update })
    mocks.database.mockReturnValue({ from })
    await expect(getValidMercadoPagoAccessToken('user', connection(), config, 'lease')).rejects.toThrow('refresh_persist_failed')
    expect(query.eq).toHaveBeenCalledWith('id', 'connection')
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user')
    expect(query.eq).toHaveBeenCalledWith('sync_lease_id', 'lease')
    expect(query.gt).toHaveBeenCalledWith('sync_lease_until', now.toISOString())
    expect(query.in).toHaveBeenCalledWith('status', ['connected', 'error'])
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
