import { describe, expect, it, vi } from 'vitest'

import { decryptMercadoPagoToken, encryptMercadoPagoToken } from './token-crypto'
import { buildMercadoPagoAuthorizeUrl, getMercadoPagoOAuthReadiness, parseMercadoPagoTokenPayload, resolveMercadoPagoTokenExpiresAt } from './oauth'
import { buildMercadoPagoPullUrls, observationNativeKey, syncMercadoPagoObservations } from './observability-sync'

const KEY = Buffer.alloc(32, 7).toString('base64')
const NOW = new Date('2026-09-15T12:00:00.000Z')

function response(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status }) }

describe('Mercado Pago observability harness', () => {
  it('encrypts tokens with authenticated AES-256-GCM and rejects invalid material', () => {
    const ciphertext = encryptMercadoPagoToken({ plaintext: 'access-secret', encryptionKey: KEY })
    expect(ciphertext).not.toContain('access-secret')
    expect(decryptMercadoPagoToken({ ciphertext, encryptionKey: KEY })).toBe('access-secret')
    expect(() => decryptMercadoPagoToken({ ciphertext, encryptionKey: Buffer.alloc(32, 8).toString('base64') })).toThrow()
  })

  it('uses S256 PKCE and a fixed clock for token expiry', () => {
    const config = { clientId: 'id', clientSecret: 'secret', redirectUri: 'https://example.test/callback', scope: 'offline_access read', tokenEncryptionKey: KEY }
    const url = new URL(buildMercadoPagoAuthorizeUrl({ config, state: 'state', challenge: 'sha256-challenge' }))
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('code_challenge')).toBe('sha256-challenge')
    const token = parseMercadoPagoTokenPayload({ access_token: 'a', refresh_token: 'r', expires_in: 3600, user_id: 42 }, NOW)
    expect(token.expiresAt).toBe(resolveMercadoPagoTokenExpiresAt({ expiresInSeconds: 3600, now: NOW }))
    expect(getMercadoPagoOAuthReadiness({ MERCADOPAGO_CLIENT_ID: 'id', MERCADOPAGO_CLIENT_SECRET: 'secret', MERCADOPAGO_REDIRECT_URI: 'https://example.test/callback', MERCADOPAGO_TOKEN_ENCRYPTION_KEY: KEY, NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co' })).toEqual({ ok: false, missing: ['SUPABASE_SERVICE_ROLE_KEY'] })
  })

  it('builds Mercado Pago official 30-day search parameters and an unfiltered report URL', () => {
    const [payments, reports] = buildMercadoPagoPullUrls({ now: NOW })
    const url = new URL(payments)
    expect(url.searchParams.get('sort')).toBe('date_created')
    expect(url.searchParams.get('criteria')).toBe('desc')
    expect(url.searchParams.get('range')).toBe('date_created')
    expect(url.searchParams.get('begin_date')).toBe('2026-08-16T12:00:00.000Z')
    expect(url.searchParams.get('end_date')).toBe('2026-09-15T12:00:00.000Z')
    expect(url.searchParams.get('offset')).toBe('0')
    expect(reports).toBe('https://api.mercadopago.com/v1/account/settlement_report/list')
  })

  it('paginates payments, independently records report failure, and never exposes Authorization text', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      void init
      const value = String(url)
      if (value.includes('settlement_report/config')) return response({ configured: true })
      if (value.includes('settlement_report/list')) return response({ message: 'down' }, 503)
      if (value.includes('offset=0')) return response({ results: Array.from({ length: 50 }, (_, index) => ({ id: `p${index}` })), paging: { total: 51 } })
      return response({ results: [{ id: 'p50' }], paging: { total: 51 } })
    })
    const store = { upsertRawObservation: vi.fn().mockResolvedValue(undefined) }
    const result = await syncMercadoPagoObservations({ userId: 'tenant-1', accessToken: 'access-secret', now: NOW, fetchImpl, store })
    expect(fetchImpl).toHaveBeenCalledTimes(4)
    expect(fetchImpl.mock.calls.some(([url]) => String(url).includes('offset=50'))).toBe(true)
    expect(fetchImpl.mock.calls.some(([url]) => String(url) === 'https://api.mercadopago.com/v1/account/settlement_report/list')).toBe(true)
    expect((fetchImpl.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer access-secret' })
    expect(result.sources).toEqual([
      { source: 'payments_search', status: 'success', count: 51, errorCode: null },
      { source: 'account_settlement_report', status: 'error', count: 0, errorCode: 'provider_error' },
    ])
    expect(store.upsertRawObservation).toHaveBeenCalledTimes(51)
    expect(JSON.stringify(result)).not.toContain('access-secret')
  })

  it('uses native keys when available and stable canonical hashes otherwise', () => {
    expect(observationNativeKey({ id: 7, amount: 1 })).toBe('7')
    expect(observationNativeKey({ b: 2, a: 1 })).toBe(observationNativeKey({ a: 1, b: 2 }))
    expect(observationNativeKey({ a: 1 })).toMatch(/^sha256:[a-f0-9]{64}$/)
  })
})
