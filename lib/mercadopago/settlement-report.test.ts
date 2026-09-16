import { describe, expect, it, vi } from 'vitest'
import { buildSettlementReportWindows, parseSettlementReportCsv, syncMercadoPagoSettlementReport, SETTLEMENT_REPORT_REQUIRED_FIELDS } from './settlement-report'

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
      if (url.endsWith('/list')) return response([{ file_name: 'settlement-20260915.csv', begin_date: '2026-06-18T03:00:00Z', end_date: '2026-07-18T02:59:59Z' }])
      if (url.endsWith('/settlement-20260915.csv')) return response(`${header}\n${row}`)
      if (url.includes('/v1/account/settlement_report') && init?.method === 'POST') return response({}, 202)
      throw new Error(`unexpected ${url}`)
    })
    const store = { upsertRawObservation: vi.fn().mockResolvedValue(undefined) }

    const result = await syncMercadoPagoSettlementReport({ userId: 'user-1', accessToken: 'secret', now: NOW, fetchImpl, store, batchId: 'parent-batch', startedAt: NOW.toISOString() })

    expect(result).toMatchObject({ source: 'account_settlement_report', status: 'pending', count: 0 })
    expect(calls.map((call) => call.method)).toEqual(['GET', 'POST', 'GET', 'GET', 'POST'])
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
      if (url.endsWith('/list')) return response({ reports: [{ status: 'pending', begin_date: '2026-06-18T03:00:00Z', end_date: '2026-07-18T02:59:59Z' }] })
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

  it('rejects 203 from create rather than treating it as pending success', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/config')) return response({ configured: true })
      if (url.endsWith('/list')) return response([])
      if (url.endsWith('/settlement_report') && init?.method === 'POST') return response('not-json', 203)
      throw new Error(`unexpected ${url}`)
    })

    const result = await syncMercadoPagoSettlementReport({ userId: 'user-1', accessToken: 'secret', now: NOW, fetchImpl, store: { upsertRawObservation: vi.fn() }, batchId: 'parent-batch', startedAt: NOW.toISOString() })

    expect(result).toEqual({ source: 'account_settlement_report', status: 'error', count: 0, errorCode: 'provider_error' })
    expect(log).toHaveBeenCalledWith('mercadopago_settlement_report_error', '{"stage":"create","httpStatus":203}')
    log.mockRestore()
  })

  it('prefers a safe provider code and excludes hostile non-code fields', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fetchImpl = vi.fn(async () => response({ code: 'SAFE.CODE-1', error: 'provider message', status: 'HOSTILE_STATUS', extra: 'secret', token: 'secret-token', body: 'request body', userId: 'user-1' }, 400))

    await syncMercadoPagoSettlementReport({ userId: 'user-1', accessToken: 'secret-token', now: NOW, fetchImpl, store: { upsertRawObservation: vi.fn() }, batchId: 'parent-batch', startedAt: NOW.toISOString() })

    const serializedLog = JSON.stringify(log.mock.calls[0])
    expect(serializedLog).toContain('SAFE.CODE-1')
    expect(serializedLog).not.toContain('provider message')
    expect(serializedLog).not.toContain('HOSTILE_STATUS')
    expect(serializedLog).not.toContain('secret')
    expect(serializedLog).not.toContain('request body')
    expect(serializedLog).not.toContain('user-1')
    log.mockRestore()
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

  it('uses an exact deterministic 90-day RFC3339 UTC window for generation', async () => {
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
    expect(JSON.parse(calls.find((call) => call.url.endsWith('/settlement_report'))?.body ?? '')).toEqual({ begin_date: '2026-06-18T03:00:00Z', end_date: '2026-07-18T02:59:59Z' })
  })

  it('generates three contiguous Argentina calendar chunks with exact UTC second limits', () => {
    expect(buildSettlementReportWindows(NOW)).toEqual([
      { beginDate: '2026-06-18', endDate: '2026-07-17', beginTimestamp: '2026-06-18T03:00:00Z', endTimestamp: '2026-07-18T02:59:59Z' },
      { beginDate: '2026-07-18', endDate: '2026-08-16', beginTimestamp: '2026-07-18T03:00:00Z', endTimestamp: '2026-08-17T02:59:59Z' },
      { beginDate: '2026-08-17', endDate: '2026-09-15', beginTimestamp: '2026-08-17T03:00:00Z', endTimestamp: '2026-09-16T02:59:59Z' },
    ])
  })

  it('creates the oldest missing chunk only, while downloading ready chunks', async () => {
    const calls: string[] = []
    const store = { upsertRawObservation: vi.fn().mockResolvedValue(undefined) }
    const windows = buildSettlementReportWindows(NOW)
    const readyReport = (index: number, fileName: string) => ({ file_name: fileName, begin_date: windows[index].beginTimestamp, end_date: windows[index].endTimestamp })
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input); calls.push(`${init?.method ?? 'GET'} ${url}`)
      if (url.endsWith('/config')) return response({ configured: true })
      if (url.endsWith('/list')) return response([readyReport(2, 'newest.csv')])
      if (url.endsWith('/newest.csv')) return response(`${header}\n${row}`)
      if (url.endsWith('/settlement_report') && init?.method === 'POST') return response({}, 202)
      throw new Error(`unexpected ${url}`)
    })

    const result = await syncMercadoPagoSettlementReport({ userId: 'user-1', accessToken: 'secret', now: NOW, fetchImpl, store, batchId: 'batch', startedAt: NOW.toISOString() })

    expect(result).toMatchObject({ status: 'pending', count: 0 })
    expect(calls.filter((call) => call.startsWith('GET ') && call.endsWith('.csv'))).toHaveLength(1)
    const postCall = (fetchImpl.mock.calls as unknown as Array<[unknown, RequestInit | undefined]>).find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(postCall?.[1]?.body as string)).toEqual({ begin_date: windows[0].beginTimestamp, end_date: windows[0].endTimestamp })
  })

  it('does not create when any chunk is pending, but downloads ready chunks first', async () => {
    const store = { upsertRawObservation: vi.fn().mockResolvedValue(undefined) }
    const windows = buildSettlementReportWindows(NOW)
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/config')) return response({ configured: true })
      if (url.endsWith('/list')) return response([{ file_name: 'old.csv', begin_date: windows[0].beginTimestamp, end_date: windows[0].endTimestamp }, { status: 'pending', begin_date: windows[1].beginTimestamp, end_date: windows[1].endTimestamp }])
      if (url.endsWith('/old.csv')) return response(`${header}\n${row}`)
      throw new Error(`unexpected ${url}`)
    })
    const result = await syncMercadoPagoSettlementReport({ userId: 'user-1', accessToken: 'secret', now: NOW, fetchImpl, store, batchId: 'batch', startedAt: NOW.toISOString() })
    expect(result).toMatchObject({ status: 'pending', count: 0 })
    expect(store.upsertRawObservation).toHaveBeenCalledTimes(1)
    expect((fetchImpl.mock.calls as unknown as Array<[unknown, RequestInit | undefined]>).some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it('fails closed for an existing window with unknown status and no file, while downloading other ready chunks', async () => {
    const windows = buildSettlementReportWindows(NOW)
    const store = { upsertRawObservation: vi.fn().mockResolvedValue(undefined) }
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/config')) return response({ configured: true })
      if (url.endsWith('/list')) return response([
        { file_name: 'old.csv', begin_date: windows[0].beginTimestamp, end_date: windows[0].endTimestamp },
        { status: 'unknown_provider_state', begin_date: windows[1].beginTimestamp, end_date: windows[1].endTimestamp },
      ])
      if (url.endsWith('/old.csv')) return response(`${header}\n${row}`)
      if (init?.method === 'POST') throw new Error('must not create a duplicate')
      throw new Error(`unexpected ${url}`)
    })

    const result = await syncMercadoPagoSettlementReport({ userId: 'user-1', accessToken: 'secret', now: NOW, fetchImpl, store, batchId: 'batch', startedAt: NOW.toISOString() })

    expect(result).toMatchObject({ status: 'pending', count: 0 })
    expect(store.upsertRawObservation).toHaveBeenCalledTimes(1)
    expect((fetchImpl.mock.calls as unknown as Array<[unknown, RequestInit | undefined]>).some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it('selects duplicate ready reports deterministically and rejects invalid timestamp matches', async () => {
    const windows = buildSettlementReportWindows(NOW)
    const store = { upsertRawObservation: vi.fn().mockResolvedValue(undefined) }
    const downloads: string[] = []
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/config')) return response({ configured: true })
      if (url.endsWith('/list')) return response([
        { file_name: 'z-old.csv', begin_date: windows[0].beginTimestamp, end_date: windows[0].endTimestamp },
        { file_name: 'a-old.csv', begin_date: windows[0].beginTimestamp, end_date: windows[0].endTimestamp },
        { file_name: 'probe.csv', begin_date: 'invalid', end_date: windows[1].endTimestamp },
        { file_name: 'middle.csv', begin_date: windows[1].beginTimestamp, end_date: windows[1].endTimestamp },
        { file_name: 'new.csv', begin_date: windows[2].beginTimestamp, end_date: windows[2].endTimestamp },
      ])
      if (url.endsWith('.csv')) { downloads.push(url); return response(`${header}\n${row}`) }
      if (init?.method === 'POST') throw new Error('all windows are present')
      throw new Error(`unexpected ${url}`)
    })

    const result = await syncMercadoPagoSettlementReport({ userId: 'user-1', accessToken: 'secret', now: NOW, fetchImpl, store, batchId: 'batch', startedAt: NOW.toISOString() })

    expect(result).toMatchObject({ status: 'success', count: 3 })
    expect(downloads).toEqual([
      'https://api.mercadopago.com/v1/account/settlement_report/a-old.csv',
      'https://api.mercadopago.com/v1/account/settlement_report/middle.csv',
      'https://api.mercadopago.com/v1/account/settlement_report/new.csv',
    ])
    expect(store.upsertRawObservation).toHaveBeenCalledTimes(3)
  })

  it('downloads all three ready chunks and sums their rows', async () => {
    const windows = buildSettlementReportWindows(NOW)
    const store = { upsertRawObservation: vi.fn().mockResolvedValue(undefined) }
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/config')) return response({ configured: true })
      if (url.endsWith('/list')) return response(windows.map((window, index) => ({ file_name: `chunk-${index}.csv`, begin_date: window.beginTimestamp, end_date: window.endTimestamp })))
      if (url.includes('/chunk-')) return response(`${header}\n${row}`)
      throw new Error(`unexpected ${url}`)
    })
    const result = await syncMercadoPagoSettlementReport({ userId: 'user-1', accessToken: 'secret', now: NOW, fetchImpl, store, batchId: 'batch', startedAt: NOW.toISOString() })
    expect(result).toMatchObject({ status: 'success', count: 3 })
    expect(store.upsertRawObservation).toHaveBeenCalledTimes(3)
  })

  it('uses calendar boundaries across month and year changes', () => {
    expect(buildSettlementReportWindows(new Date('2025-01-15T12:00:00.000Z'))[0]).toEqual({ beginDate: '2024-10-18', endDate: '2024-11-16', beginTimestamp: '2024-10-18T03:00:00Z', endTimestamp: '2024-11-17T02:59:59Z' })
  })
})
