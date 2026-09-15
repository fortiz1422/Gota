const API = 'https://api.mercadopago.com'
const DAY = 24 * 60 * 60 * 1000
const MAX_PAGES = 10
export type RawObservation = { userId: string; source: 'payments_search' | 'account_settlement_report'; nativeKey: string; payload: unknown; firstSeenAt: string; lastSeenAt: string; metadata: { batchId: string; syncStartedAt: string } }
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
type Store = { upsertRawObservation: (observation: RawObservation) => Promise<void> }

export function buildMercadoPagoPullUrls({ now }: { now: Date }) {
  const begin = new Date(now.getTime() - 30 * DAY).toISOString()
  const end = now.toISOString()
  const url = new URL(`${API}/v1/payments/search`)
  url.search = new URLSearchParams({ range: 'date_created', begin_date: begin, end_date: end, limit: '50', offset: '0' }).toString()
  return [url.toString(), `${API}/v1/account/settlement_report/list`]
}

function nativeKey(value: unknown, fallback: string) {
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    for (const key of ['id', 'payment_id', 'transaction_id', 'external_reference']) if (typeof record[key] === 'string' || typeof record[key] === 'number') return String(record[key])
  }
  return fallback
}
function items(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (typeof payload === 'object' && payload !== null) {
    const value = (payload as Record<string, unknown>).results ?? (payload as Record<string, unknown>).data
    return Array.isArray(value) ? value : [payload]
  }
  return [payload]
}
async function getJson(url: string, token: string, fetchImpl: FetchLike) {
  const response = await fetchImpl(url, { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, cache: 'no-store' })
  if (!response.ok) throw new Error('Mercado Pago sync failed')
  return response.json().catch(() => null)
}
export async function syncMercadoPagoObservations({ userId, accessToken, now = new Date(), fetchImpl = fetch, store }: { userId: string; accessToken: string; now?: Date; fetchImpl?: FetchLike; store: Store }) {
  const started = now.toISOString()
  const batchId = `mp-${now.getTime()}`
  let totalPayments = 0
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL(`${API}/v1/payments/search`)
    url.search = new URLSearchParams({ range: 'date_created', begin_date: new Date(now.getTime() - 30 * DAY).toISOString(), end_date: now.toISOString(), limit: '50', offset: String(page * 50) }).toString()
    const payload = await getJson(url.toString(), accessToken, fetchImpl)
    const rows = items(payload)
    for (let index = 0; index < rows.length; index += 1) await store.upsertRawObservation({ userId, source: 'payments_search', nativeKey: nativeKey(rows[index], `page-${page}-row-${index}`), payload: rows[index], firstSeenAt: started, lastSeenAt: started, metadata: { batchId, syncStartedAt: started } })
    totalPayments += rows.length
    const paging = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>).paging : null
    const total = typeof paging === 'object' && paging !== null && typeof (paging as Record<string, unknown>).total === 'number'
      ? (paging as Record<string, unknown>).total as number
      : totalPayments
    if (rows.length === 0 || totalPayments >= total || (typeof paging !== 'object' && rows.length < 50)) break
  }
  const reportPayload = await getJson(`${API}/v1/account/settlement_report/list`, accessToken, fetchImpl)
  const reportRows = items(reportPayload)
  for (let index = 0; index < reportRows.length; index += 1) await store.upsertRawObservation({ userId, source: 'account_settlement_report', nativeKey: nativeKey(reportRows[index], `snapshot-${started}`), payload: reportRows[index], firstSeenAt: started, lastSeenAt: started, metadata: { batchId, syncStartedAt: started } })
  return { payments: totalPayments, reports: reportRows.length }
}
