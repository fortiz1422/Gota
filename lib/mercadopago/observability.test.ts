import { describe, expect, it, vi } from 'vitest'

import { decryptMercadoPagoToken, encryptMercadoPagoToken } from './token-crypto'
import { parseMercadoPagoTokenPayload, resolveMercadoPagoTokenExpiresAt, getMercadoPagoOAuthReadiness } from './oauth'
import { buildMercadoPagoPullUrls, syncMercadoPagoObservations } from './observability-sync'
import { buildMercadoPagoSettingsModel } from './settings-model'

const KEY = Buffer.alloc(32, 7).toString('base64')
const NOW = new Date('2026-09-15T12:00:00.000Z')

describe('Mercado Pago observability harness', () => {
  it('does AES-256-GCM roundtrip and rejects invalid keys', async () => {
    const ciphertext = encryptMercadoPagoToken({ plaintext: 'access-secret', encryptionKey: KEY })
    expect(decryptMercadoPagoToken({ ciphertext, encryptionKey: KEY })).toBe('access-secret')
    expect(() => encryptMercadoPagoToken({ plaintext: 'x', encryptionKey: 'bad' })).toThrow(/32-byte/)
    expect(() => decryptMercadoPagoToken({ ciphertext, encryptionKey: Buffer.alloc(32, 8).toString('base64') })).toThrow()
  })

  it('parses token payload and computes fixed expiry', () => {
    const token = parseMercadoPagoTokenPayload({ access_token: 'a', refresh_token: 'r', expires_in: 3600, user_id: 42 }, NOW)
    expect(token).toMatchObject({ accessToken: 'a', refreshToken: 'r', userId: '42' })
    expect(token.expiresAt).toBe(resolveMercadoPagoTokenExpiresAt({ expiresInSeconds: 3600, now: NOW }))
  })

  it('requires a base64 AES-256 key before declaring OAuth ready', () => {
    const result = getMercadoPagoOAuthReadiness({ MERCADOPAGO_CLIENT_ID: 'id', MERCADOPAGO_CLIENT_SECRET: 'secret', MERCADOPAGO_REDIRECT_URI: 'https://example.test/callback', MERCADOPAGO_TOKEN_ENCRYPTION_KEY: 'bad' })
    expect(result).toEqual({ ok: false, missing: ['MERCADOPAGO_TOKEN_ENCRYPTION_KEY'] })
  })

  it('builds the bounded pull URLs without speculative report filters', () => {
    expect(buildMercadoPagoPullUrls({ now: NOW })).toEqual([
      'https://api.mercadopago.com/v1/payments/search?range=date_created&begin_date=2026-08-16T12%3A00%3A00.000Z&end_date=2026-09-15T12%3A00%3A00.000Z&limit=50&offset=0',
      'https://api.mercadopago.com/v1/account/settlement_report/list',
    ])
  })

  it('pulls pages, writes raw observations idempotently, and never writes ledger', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: Array.from({ length: 50 }, (_, index) => ({ id: `p${index}` })), paging: { total: 51 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ id: 'p2' }], paging: { total: 51 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ date: '2026-09-01' }]), { status: 200 }))
    const store = { upsertRawObservation: vi.fn().mockResolvedValue(undefined) }
    const result = await syncMercadoPagoObservations({ userId: 'u1', accessToken: 'secret', now: NOW, fetchImpl, store })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(fetchImpl.mock.calls[0][0]).toContain('begin_date=2026-08-16T12%3A00%3A00.000Z')
    expect(fetchImpl.mock.calls[1][0]).toContain('offset=50')
    expect(fetchImpl.mock.calls[2][0]).toBe('https://api.mercadopago.com/v1/account/settlement_report/list')
    expect(store.upsertRawObservation).toHaveBeenCalledTimes(52)
    expect(result).toEqual({ payments: 51, reports: 1 })
    expect(JSON.stringify(result)).not.toContain('secret')
  })

  it('returns narrow settings states and validation copy', () => {
    expect(buildMercadoPagoSettingsModel(null)).toMatchObject({ state: 'not_connected', cta: 'Conectar Mercado Pago' })
    expect(buildMercadoPagoSettingsModel({ status: 'connected', lastSyncAt: '2026-09-15T12:00:00.000Z', sources: { payments: 1, reports: 2 } })).toMatchObject({ state: 'connected', cta: 'Sincronizar ahora', validationCopy: expect.stringContaining('validación') })
    expect(buildMercadoPagoSettingsModel({ status: 'error', lastSyncAt: null, sources: { payments: 0, reports: 0 } }).state).toBe('error')
  })
})
