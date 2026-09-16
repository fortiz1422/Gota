import { describe, expect, it, vi } from 'vitest'
import { parseSettlementReportCsv, syncMercadoPagoSettlementReport, SETTLEMENT_REPORT_REQUIRED_FIELDS } from './settlement-report'

const NOW = new Date('2026-09-15T12:00:00.000Z')
const row = [
  'source-1', 'external-1', '2026-09-15T10:00:00-03:00', '2026-09-16T10:00:00-03:00', 'SETTLEMENT', '5500', 'ARS', '5300', 'ARS', '5500', '200', 'credit_card', 'credit_card', '"Shell 5500, sucursal 1"', '1', 'VISA', '4321', 'available_money', 'payments',
].join(',')
const header = SETTLEMENT_REPORT_REQUIRED_FIELDS.join(',')
const response = (body: string | object, status = 200) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })

describe('Mercado Pago settlement report', () => {
  it('parses quoted commas, BOM, CRLF and skips a blank line', () => {
    const csv = `\ufeff${header}\r\n${row}\r\n\r\n`
    expect(parseSettlementReportCsv(csv)).toEqual([expect.objectContaining({ DESCRIPTION: 'Shell 5500, sucursal 1', SOURCE_ID: 'source-1' })])
  })

  it('fails closed when required headers or fields are missing', () => {
    expect(() => parseSettlementReportCsv('SOURCE_ID,DESCRIPTION\nsource-1,only')).toThrow('settlement_report_invalid_headers')
    expect(() => parseSettlementReportCsv(`${header}\n${row},extra`)).toThrow('settlement_report_malformed_row')
    expect(() => parseSettlementReportCsv(`${header}\n${row.split(',').slice(0, -1).join(',')}`)).toThrow('settlement_report_malformed_row')
    expect(() => parseSettlementReportCsv(`${header},DESCRIPTION\n${row},again`)).toThrow('settlement_report_invalid_headers')
    expect(() => parseSettlementReportCsv(`${header}\n${row.replace('"Shell 5500, sucursal 1"', '"Shell ""5500""')}`)).toThrow('settlement_report_malformed_csv')
  })

  it('logs a sanitized config_get diagnostic for a non-ok response', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchImpl = vi.fn(async () => response({ error: 'invalid token', code: 'AUTH_FAILED', status: 401, Authorization: 'secret', body: 'sensitive request body' }, 401))

    const result = await syncMercadoPagoSettlementReport({ userId: 'user-1', accessToken: 'secret', now: NOW, fetchImpl, store: { upsertRawObservation: vi.fn() }, batchId: 'parent-batch', startedAt: NOW.toISOString() })

    expect(result).toEqual({ source: 'account_settlement_report', status: 'error', count: 0, errorCode: 'provider_error' })
    expect(log).toHaveBeenCalledTimes(1)
    const serializedLog = JSON.stringify(log.mock.calls[0])
    expect(serializedLog).toContain('config_get')
    expect(serializedLog).toContain('401')
    expect(serializedLog).toContain('AUTH_FAILED')
    expect(serializedLog).not.toContain('secret')
    expect(serializedLog).not.toContain('sensitive request body')
    log.mockRestore()
  })

  it('logs config_create and preserves the generic result when config creation is non-ok', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchImpl = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => init?.method === 'POST'
      ? response({ error: 'forbidden operation', code: 'CONFIG_DENIED', status: 403, token: 'secret', request_body: 'sensitive' }, 403)
      : response({}, 404))

    const result = await syncMercadoPagoSettlementReport({ userId: 'user-1', accessToken: 'secret', now: NOW, fetchImpl, store: { upsertRawObservation: vi.fn() }, batchId: 'parent-batch', startedAt: NOW.toISOString() })

    expect(result).toEqual({ source: 'account_settlement_report', status: 'error', count: 0, errorCode: 'provider_error' })
    expect(log).toHaveBeenCalledTimes(1)
    const serializedLog = JSON.stringify(log.mock.calls[0])
    expect(serializedLog).toContain('config_create')
    expect(serializedLog).toContain('403')
    expect(serializedLog).toContain('CONFIG_DENIED')
    expect(serializedLog).not.toContain('secret')
    expect(serializedLog).not.toContain('sensitive')
    log.mockRestore()
  })

  it('configures only after 404, lists before creating, downloads ready report and stores rows', async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = []
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : undefined })
      if (url.endsWith('/config') && (init?.method ?? 'GET') === 'GET') return response({}, 404)
      if (url.endsWith('/config') && init?.method === 'POST') return response({ ok: true }, 201)
      if (url.endsWith('/list')) return response([{ file_name: 'settlement-20260915.csv', begin_date: '2026-06-17', end_date: '2026-09-15' }])
      if (url.endsWith('/settlement-20260915.csv')) return response(`${header}\n${row}`)
      throw new Error(`unexpected ${url}`)
    })
    const store = { upsertRawObservation: vi.fn().mockResolvedValue(undefined) }

    const result = await syncMercadoPagoSettlementReport({ userId: 'user-1', accessToken: 'secret', now: NOW, fetchImpl, store, batchId: 'parent-batch', startedAt: NOW.toISOString() })

    expect(result).toMatchObject({ source: 'account_settlement_report', status: 'success', count: 1 })
    expect(calls.map((call) => call.method)).toEqual(['GET', 'POST', 'GET', 'GET'])
    expect(JSON.parse(calls[1].body ?? '')).toEqual({
      file_name_prefix: 'gota_settlement',
      frequency: { hour: 0, type: 'monthly', value: 1 },
      columns: SETTLEMENT_REPORT_REQUIRED_FIELDS.map((key) => ({ key })),
      display_timezone: 'GMT-03', separator: ',', include_withdraw: true, header_language: 'en',
    })
    expect(calls[3].url).toBe('https://api.mercadopago.com/v1/account/settlement_report/settlement-20260915.csv')
    expect(store.upsertRawObservation).toHaveBeenCalledWith(expect.objectContaining({ source: 'account_settlement_report', nativeKey: 'source-1', payload: expect.objectContaining({ DESCRIPTION: 'Shell 5500, sucursal 1' }), metadata: { batchId: 'parent-batch', syncStartedAt: NOW.toISOString() } }))
    expect(JSON.stringify(result)).not.toContain('secret')
  })

  it('returns pending after listing a pending report and does not create a duplicate', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/config')) return response({ configured: true })
      if (url.endsWith('/list')) return response({ reports: [{ status: 'pending', begin_date: '2026-06-17', end_date: '2026-09-15' }] })
      throw new Error(`unexpected ${url}`)
    })
    const result = await syncMercadoPagoSettlementReport({ userId: 'user-1', accessToken: 'secret', now: NOW, fetchImpl, store: { upsertRawObservation: vi.fn() }, batchId: 'parent-batch', startedAt: NOW.toISOString() })
    expect(result).toMatchObject({ status: 'pending', count: 0 })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('creates once after an empty list and returns preparing, never zero-row success', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/config')) return response({ configured: true })
      if (url.endsWith('/list')) return response({ reports: [] })
      if (url.endsWith('/settlement_report') && init?.method === 'POST') return response({}, 202)
      throw new Error(`unexpected ${url}`)
    })
    const result = await syncMercadoPagoSettlementReport({ userId: 'user-1', accessToken: 'secret', now: NOW, fetchImpl, store: { upsertRawObservation: vi.fn() }, batchId: 'parent-batch', startedAt: NOW.toISOString() })
    expect(result).toMatchObject({ status: 'pending', count: 0 })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('does not duplicate a generation while a persisted pending run is within cooldown', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/config')) return response({ configured: true })
      if (url.endsWith('/list')) return response([])
      throw new Error(`unexpected ${url}`)
    })
    const result = await syncMercadoPagoSettlementReport({ userId: 'user-1', accessToken: 'secret', now: NOW, fetchImpl, store: { upsertRawObservation: vi.fn() }, batchId: 'parent-batch', startedAt: NOW.toISOString(), lastPendingAt: '2026-09-15T11:55:00.000Z' })
    expect(result).toMatchObject({ status: 'pending', count: 0 })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('uses an exact deterministic 90-day UTC window for generation', async () => {
    const calls: Array<{ url: string; body?: string }> = []
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, body: typeof init?.body === 'string' ? init.body : undefined })
      if (url.endsWith('/config')) return response({ configured: true })
      if (url.endsWith('/list')) return response([])
      if (url.endsWith('/settlement_report') && init?.method === 'POST') return response({}, 202)
      throw new Error(`unexpected ${url}`)
    })
    await syncMercadoPagoSettlementReport({ userId: 'user-1', accessToken: 'secret', now: NOW, fetchImpl, store: { upsertRawObservation: vi.fn() }, batchId: 'parent-batch', startedAt: NOW.toISOString() })
    expect(JSON.parse(calls.find((call) => call.url.endsWith('/settlement_report'))?.body ?? '')).toEqual({ begin_date: '2026-06-17', end_date: '2026-09-15' })
  })
})
