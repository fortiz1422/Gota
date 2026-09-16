import { observationNativeKey, type RawObservation } from './raw-observation'

const API = 'https://api.mercadopago.com'
const DAY = 24 * 60 * 60 * 1000
const PENDING_COOLDOWN_MS = 10 * 60 * 1000
const REQUIRED_FIELDS = [
  'SOURCE_ID', 'EXTERNAL_REFERENCE', 'TRANSACTION_DATE', 'SETTLEMENT_DATE', 'TRANSACTION_TYPE',
  'TRANSACTION_AMOUNT', 'TRANSACTION_CURRENCY', 'SETTLEMENT_NET_AMOUNT', 'SETTLEMENT_CURRENCY',
  'REAL_AMOUNT', 'FEE_AMOUNT', 'PAYMENT_METHOD', 'PAYMENT_METHOD_TYPE', 'DESCRIPTION', 'INSTALLMENTS',
  'FRANCHISE', 'LAST_FOUR_DIGITS', 'BUSINESS_UNIT', 'SUB_UNIT',
] as const
export const SETTLEMENT_REPORT_REQUIRED_FIELDS = REQUIRED_FIELDS

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
type Store = { upsertRawObservation: (observation: RawObservation) => Promise<void> }
type SettlementReportStage = 'config_get' | 'config_create' | 'list' | 'list_parse' | 'create' | 'download' | 'csv_parse' | 'raw_persist'
type SettlementReportDiagnostic = { stage: SettlementReportStage; httpStatus: number | null; providerCode?: string }
export type SettlementReportRun = { source: 'account_settlement_report'; status: 'success' | 'error' | 'pending'; count: number; errorCode: 'provider_error' | null }

class SettlementReportDiagnosticError extends Error {
  constructor(public readonly diagnostic: SettlementReportDiagnostic) {
    super('provider_error')
  }
}

function csvFields(input: string): string[][] {
  const text = input.replace(/^\ufeff/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let closedQuote = false
  const commit = () => { row.push(field); field = ''; closedQuote = false }
  const finishRow = () => { commit(); if (row.some((value) => value !== '')) rows.push(row); row = [] }
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1 }
      else if (char === '"') { quoted = false; closedQuote = true }
      else field += char
    } else if (closedQuote && char !== ',' && char !== '\n' && char !== '\r') {
      throw new Error('settlement_report_malformed_csv')
    } else if (char === '"' && field === '') quoted = true
    else if (char === ',') commit()
    else if (char === '\n') finishRow()
    else if (char !== '\r') field += char
  }
  if (quoted) throw new Error('settlement_report_malformed_csv')
  if (field !== '' || row.length) finishRow()
  return rows
}

export function parseSettlementReportCsv(input: string): Record<string, string>[] {
  const rows = csvFields(input)
  const headers = rows.shift() ?? []
  if (headers.length !== REQUIRED_FIELDS.length || headers.length !== new Set(headers).size || REQUIRED_FIELDS.some((field) => !headers.includes(field))) throw new Error('settlement_report_invalid_headers')
  return rows.map((values) => {
    if (values.length !== headers.length) throw new Error('settlement_report_malformed_row')
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]))
  })
}

function dateWindow(now: Date) {
  const toIsoSeconds = (date: Date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z')
  const beginTimestamp = toIsoSeconds(new Date(now.getTime() - 90 * DAY))
  const endTimestamp = toIsoSeconds(now)
  return { beginDate: beginTimestamp.slice(0, 10), endDate: endTimestamp.slice(0, 10), beginTimestamp, endTimestamp }
}

function authInit(token: string, method = 'GET', body?: string): RequestInit {
  return { method, headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }, cache: 'no-store', ...(body ? { body } : {}) }
}

async function request(url: string, token: string, fetchImpl: FetchLike, init?: RequestInit): Promise<Response> {
  const base = authInit(token, init?.method ?? 'GET', typeof init?.body === 'string' ? init.body : undefined)
  return fetchImpl(url, { ...base, ...init, headers: { ...(base.headers as Record<string, string>), ...(init?.headers as Record<string, string> ?? {}) } })
}

function listItems(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    for (const key of ['reports', 'results', 'data', 'items']) if (Array.isArray(record[key])) return listItems(record[key])
  }
  throw new Error('settlement_report_invalid_list')
}

function value(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) if (typeof row[key] === 'string' || typeof row[key] === 'number') return String(row[key])
  return null
}

function matchesWindow(row: Record<string, unknown>, beginDate: string, endDate: string) {
  return value(row, ['begin_date'])?.slice(0, 10) === beginDate && value(row, ['end_date'])?.slice(0, 10) === endDate
}

function safeFileName(valueToValidate: string | null): string | null {
  return valueToValidate && /^[A-Za-z0-9][A-Za-z0-9._-]*\.csv$/.test(valueToValidate) ? valueToValidate : null
}

async function json(response: Response): Promise<unknown> {
  return response.json().catch(() => { throw new Error('provider_error') })
}

async function providerFailure(response: Response, stage: SettlementReportStage): Promise<never> {
  let providerCode: string | undefined
  try {
    const payload: unknown = await response.json()
    if (payload && typeof payload === 'object') {
      const record = payload as Record<string, unknown>
      for (const key of ['code', 'error', 'status']) {
        const candidate = record[key]
        if ((typeof candidate === 'string' || typeof candidate === 'number') && /^[A-Za-z0-9_.-]{1,64}$/.test(String(candidate))) {
          providerCode = String(candidate)
          break
        }
      }
    }
  } catch {
    // Keep diagnostics limited to stage and HTTP status for non-JSON responses.
  }
  throw new SettlementReportDiagnosticError({ stage, httpStatus: response.status, ...(providerCode ? { providerCode } : {}) })
}

function logDiagnostic(error: unknown, stage: SettlementReportStage): void {
  const diagnostic = error instanceof SettlementReportDiagnosticError
    ? error.diagnostic
    : { stage, httpStatus: null }
  console.error('mercadopago_settlement_report_error', JSON.stringify(diagnostic))
}

export async function syncMercadoPagoSettlementReport({ userId, accessToken, now = new Date(), fetchImpl = fetch, store, batchId, startedAt, lastPendingAt }: { userId: string; accessToken: string; now?: Date; fetchImpl?: FetchLike; store: Store; batchId: string; startedAt: string; lastPendingAt?: string | null }): Promise<SettlementReportRun> {
  let stage: SettlementReportStage = 'config_get'
  try {
    const { beginDate, endDate, beginTimestamp, endTimestamp } = dateWindow(now)
    const configUrl = `${API}/v1/account/settlement_report/config`
    const configResponse = await request(configUrl, accessToken, fetchImpl)
    if (configResponse.status === 404) {
      stage = 'config_create'
      const config = JSON.stringify({ file_name_prefix: 'gota_settlement', frequency: { hour: 0, type: 'monthly', value: 1 }, columns: REQUIRED_FIELDS.map((key) => ({ key })), display_timezone: 'GMT-03', separator: ',', include_withdraw: true, header_language: 'en' })
      const created = await request(configUrl, accessToken, fetchImpl, { method: 'POST', body: config, headers: { 'Content-Type': 'application/json' } })
      if (!created.ok) await providerFailure(created, stage)
    } else if (!configResponse.ok) await providerFailure(configResponse, stage)

    stage = 'list'
    const listResponse = await request(`${API}/v1/account/settlement_report/list`, accessToken, fetchImpl)
    if (!listResponse.ok) await providerFailure(listResponse, stage)
    stage = 'list_parse'
    const reports = listItems(await json(listResponse)).filter((report) => matchesWindow(report, beginDate, endDate))
    if (reports.some((report) => ['pending', 'preparing', 'processing', 'created'].includes((value(report, ['status', 'state']) ?? '').toLowerCase()))) return { source: 'account_settlement_report', status: 'pending', count: 0, errorCode: null }
    const ready = reports.find((report) => safeFileName(value(report, ['file_name'])) !== null)
    const fileName = safeFileName(value(ready ?? {}, ['file_name']))
    if (!fileName) {
      const previous = lastPendingAt ? new Date(lastPendingAt).getTime() : Number.NaN
      if (Number.isFinite(previous) && now.getTime() - previous < PENDING_COOLDOWN_MS) return { source: 'account_settlement_report', status: 'pending', count: 0, errorCode: null }
      stage = 'create'
      const created = await request(`${API}/v1/account/settlement_report`, accessToken, fetchImpl, { method: 'POST', body: JSON.stringify({ begin_date: beginTimestamp, end_date: endTimestamp }), headers: { 'Content-Type': 'application/json' } })
      if (created.status !== 202) await providerFailure(created, stage)
      return { source: 'account_settlement_report', status: 'pending', count: 0, errorCode: null }
    }

    stage = 'download'
    const download = await request(`${API}/v1/account/settlement_report/${encodeURIComponent(fileName)}`, accessToken, fetchImpl, { headers: { Accept: 'text/csv' } })
    if (!download.ok) await providerFailure(download, stage)
    stage = 'csv_parse'
    const rows = parseSettlementReportCsv(await download.text())
    stage = 'raw_persist'
    for (const row of rows) await store.upsertRawObservation({ userId, source: 'account_settlement_report', nativeKey: row.SOURCE_ID || observationNativeKey(row), payload: row, firstSeenAt: startedAt, lastSeenAt: startedAt, metadata: { batchId, syncStartedAt: startedAt } })
    return { source: 'account_settlement_report', status: 'success', count: rows.length, errorCode: null }
  } catch (error) {
    logDiagnostic(error, stage)
    return { source: 'account_settlement_report', status: 'error', count: 0, errorCode: 'provider_error' }
  }
}
