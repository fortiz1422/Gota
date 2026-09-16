import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), getUser: vi.fn(), readiness: vi.fn(), getConnection: vi.fn(), getRuns: vi.fn(), updateConnection: vi.fn(), saveRun: vi.fn(), saveRaw: vi.fn(), decrypt: vi.fn(), encrypt: vi.fn(), refresh: vi.fn(), sync: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/mercadopago/oauth', () => ({ getMercadoPagoOAuthReadiness: mocks.readiness, exchangeMercadoPagoRefreshToken: mocks.refresh }))
vi.mock('@/lib/mercadopago/token-crypto', () => ({ decryptMercadoPagoToken: mocks.decrypt, encryptMercadoPagoToken: mocks.encrypt }))
vi.mock('@/lib/mercadopago/server-repository', () => ({ getMercadoPagoConnection: mocks.getConnection, getLatestMercadoPagoSourceRuns: mocks.getRuns, updateMercadoPagoConnection: mocks.updateConnection, saveMercadoPagoSourceRun: mocks.saveRun, saveRawObservation: mocks.saveRaw }))
vi.mock('@/lib/mercadopago/observability-sync', () => ({ syncMercadoPagoObservations: mocks.sync }))

import { GET, POST } from '@/app/api/integrations/mercadopago/sync/route'

const config = { clientId: 'id', clientSecret: 'secret', redirectUri: 'https://example.test/callback', scope: 'offline_access read', tokenEncryptionKey: Buffer.alloc(32, 1).toString('base64') }
const connection = { id: 'connection-1', status: 'connected', access_token_ciphertext: 'ciphertext', refresh_token_ciphertext: 'refresh-ciphertext', token_expires_at: null, last_sync_at: null }
const partial = { batchId: 'batch-1', startedAt: '2026-09-15T00:00:00.000Z', sources: [{ source: 'payments_search', status: 'success', count: 2, errorCode: null }, { source: 'account_settlement_report', status: 'error', count: 0, errorCode: 'provider_error' }] }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser } })
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  mocks.readiness.mockReturnValue({ ok: true, config })
  mocks.getConnection.mockResolvedValue(connection)
  mocks.getRuns.mockResolvedValue([])
  mocks.decrypt.mockReturnValue('access-token')
  mocks.sync.mockResolvedValue(partial)
  mocks.saveRun.mockResolvedValue(undefined)
  mocks.updateConnection.mockResolvedValue(undefined)
})

describe('Mercado Pago sync route', () => {
  it('returns no auth without repository or ledger calls', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })

    const response = await GET()

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'unauthorized' })
    expect(mocks.getConnection).not.toHaveBeenCalled()
    expect(mocks.saveRaw).not.toHaveBeenCalled()
  })

  it('returns a narrow not-connected GET state', async () => {
    mocks.getConnection.mockResolvedValue(null)

    const response = await GET()

    expect(await response.json()).toEqual({ state: 'not_connected', lastSyncAt: null, sources: { payments: { status: 'not_run', count: 0 }, reports: { status: 'not_run', count: 0 } } })
  })

  it('persists partial source summaries and returns their narrow status without ledger calls', async () => {
    const response = await POST()

    expect(response.status).toBe(207)
    expect(await response.json()).toEqual({ sources: { payments: { status: 'success', count: 2 }, reports: { status: 'error', count: 0 } } })
    expect(mocks.saveRun).toHaveBeenCalledTimes(2)
    expect(mocks.updateConnection).toHaveBeenLastCalledWith('user-1', 'connection-1', { last_sync_at: partial.startedAt, status: 'error', last_error_code: 'provider_error' })
    expect(mocks.saveRaw).not.toHaveBeenCalled()
  })

  it('returns pending without turning async report preparation into a fatal response', async () => {
    mocks.sync.mockResolvedValue({ batchId: 'batch-2', startedAt: '2026-09-15T00:00:00.000Z', sources: [{ source: 'payments_search', status: 'success', count: 2, errorCode: null }, { source: 'account_settlement_report', status: 'pending', count: 0, errorCode: null }] })

    const response = await POST()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ sources: { payments: { status: 'success', count: 2 }, reports: { status: 'pending', count: 0 } } })
    expect(mocks.updateConnection).toHaveBeenLastCalledWith('user-1', 'connection-1', { last_sync_at: '2026-09-15T00:00:00.000Z', status: 'connected', last_error_code: null })
  })

  it('refreshes an expired token before running the sync', async () => {
    mocks.getConnection.mockResolvedValue({ ...connection, token_expires_at: '2020-01-01T00:00:00.000Z' })
    mocks.decrypt.mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token')
    mocks.refresh.mockResolvedValue({ accessToken: 'fresh-access', refreshToken: 'fresh-refresh', userId: null, expiresAt: '2026-10-01T00:00:00.000Z' })
    mocks.encrypt.mockReturnValue('new-ciphertext')

    await POST()

    expect(mocks.refresh).toHaveBeenCalledWith({ refreshToken: 'refresh-token', config })
    expect(mocks.sync).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', accessToken: 'fresh-access' }))
  })

  it('does not expose readiness details or sync when server readiness fails', async () => {
    mocks.readiness.mockReturnValue({ ok: false, missing: ['SUPABASE_SERVICE_ROLE_KEY'] })

    const response = await POST()

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'oauth_not_ready' })
    expect(mocks.sync).not.toHaveBeenCalled()
  })
})
