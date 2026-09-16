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
export type SettlementReportRun = { source: 'account_settlement_report'; status: 'success' | 'error' | 'pending'; count: number; errorCode: 'provider_error' | null }

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
  return { beginDate: new Date(now.getTime() - 90 * DAY).toISOString().slice(0, 10), endDate: now.toISOString().slice(0, 10) }
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

export async function syncMercadoPagoSettlementReport({ userId, accessToken, now = new Date(), fetchImpl = fetch, store, batchId, startedAt, lastPendingAt }: { userId: string; accessToken: string; now?: Date; fetchImpl?: FetchLike; store: Store; batchId: string; startedAt: string; lastPendingAt?: string | null }): Promise<SettlementReportRun> {
  try {
    const { beginDate, endDate } = dateWindow(now)
    const configUrl = `${API}/v1/account/settlement_report/config`
    const configResponse = await request(configUrl, accessToken, fetchImpl)
    if (configResponse.status === 404) {
      const config = JSON.stringify({ file_name_prefix: 'gota_settlement', frequency: 'daily', columns: [...REQUIRED_FIELDS], display_timezone: 'GMT-03', separator: ',', include_withdraw: true, header_language: 'en' })
      const created = await request(configUrl, accessToken, fetchImpl, { method: 'POST', body: config, headers: { 'Content-Type': 'application/json' } })
      if (!created.ok) throw new Error('provider_error')
    } else if (!configResponse.ok) throw new Error('provider_error')

    const listResponse = await request(`${API}/v1/account/settlement_report/list`, accessToken, fetchImpl)
    if (!listResponse.ok) throw new Error('provider_error')
    const reports = listItems(await json(listResponse)).filter((report) => matchesWindow(report, beginDate, endDate))
    if (reports.some((report) => ['pending', 'preparing', 'processing', 'created'].includes((value(report, ['status', 'state']) ?? '').toLowerCase()))) return { source: 'account_settlement_report', status: 'pending', count: 0, errorCode: null }
    const ready = reports.find((report) => safeFileName(value(report, ['file_name'])) !== null)
    const fileName = safeFileName(value(ready ?? {}, ['file_name']))
    if (!fileName) {
      const previous = lastPendingAt ? new Date(lastPendingAt).getTime() : Number.NaN
      if (Number.isFinite(previous) && now.getTime() - previous < PENDING_COOLDOWN_MS) return { source: 'account_settlement_report', status: 'pending', count: 0, errorCode: null }
      const created = await request(`${API}/v1/account/settlement_report`, accessToken, fetchImpl, { method: 'POST', body: JSON.stringify({ begin_date: beginDate, end_date: endDate }), headers: { 'Content-Type': 'application/json' } })
      if (created.status !== 202) throw new Error('provider_error')
      return { source: 'account_settlement_report', status: 'pending', count: 0, errorCode: null }
    }

    const download = await request(`${API}/v1/account/settlement_report/${encodeURIComponent(fileName)}`, accessToken, fetchImpl, { headers: { Accept: 'text/csv' } })
    if (!download.ok) throw new Error('provider_error')
    const rows = parseSettlementReportCsv(await download.text())
    for (const row of rows) await store.upsertRawObservation({ userId, source: 'account_settlement_report', nativeKey: row.SOURCE_ID || observationNativeKey(row), payload: row, firstSeenAt: startedAt, lastSeenAt: startedAt, metadata: { batchId, syncStartedAt: startedAt } })
    return { source: 'account_settlement_report', status: 'success', count: rows.length, errorCode: null }
  } catch {
    return { source: 'account_settlement_report', status: 'error', count: 0, errorCode: 'provider_error' }
  }
}
