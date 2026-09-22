import { syncMercadoPagoSettlementReport } from './settlement-report'
import { observationNativeKey, type MercadoPagoSource, type RawObservation } from './raw-observation'
import { windowFromDates, type SyncWindow } from './sync-window'

export { observationNativeKey }
export type { RawObservation }

const API = 'https://api.mercadopago.com'

export const MERCADOPAGO_PAGE_SIZE = 50
export const MERCADOPAGO_MAX_PAGES = 10

type Source = MercadoPagoSource
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
type Store = { upsertRawObservation: (observation: RawObservation) => Promise<void> }
export type SourceRun = { source: Source; status: 'success' | 'error' | 'pending'; count: number; errorCode: 'provider_error' | null; beginDate?: string; endDate?: string }

function paymentSearchUrl(window: SyncWindow, offset: number): string {
  const url = new URL(`${API}/v1/payments/search`)
  url.search = new URLSearchParams({
    sort: 'date_created',
    criteria: 'desc',
    range: 'date_created',
    begin_date: window.beginTimestamp,
    end_date: window.endTimestamp,
    limit: String(MERCADOPAGO_PAGE_SIZE),
    offset: String(offset),
  }).toString()
  return url.toString()
}

export function buildMercadoPagoPullUrls({ now, window }: { now: Date; window?: SyncWindow }) {
  const effectiveWindow = window ?? windowFromDates(new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000), new Date(now.getTime()), 'custom')
  return [paymentSearchUrl(effectiveWindow, 0), `${API}/v1/account/settlement_report/list`]
}

function items(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>
    const value = record.results ?? record.data
    return Array.isArray(value) ? value : []
  }
  return []
}

async function getJson(url: string, token: string, fetchImpl: FetchLike): Promise<unknown> {
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('provider_error')
  return response.json().catch(() => { throw new Error('provider_error') })
}

async function pullPayments({ userId, accessToken, window, fetchImpl, store, started, batchId }: { userId: string; accessToken: string; window: SyncWindow; fetchImpl: FetchLike; store: Store; started: string; batchId: string }): Promise<SourceRun> {
  let count = 0
  for (let page = 0; page < MERCADOPAGO_MAX_PAGES; page += 1) {
    const payload = await getJson(paymentSearchUrl(window, page * MERCADOPAGO_PAGE_SIZE), accessToken, fetchImpl)
    const rows = items(payload)
    for (const row of rows) {
      await store.upsertRawObservation({ userId, source: 'payments_search', nativeKey: observationNativeKey(row), payload: row, firstSeenAt: started, lastSeenAt: started, metadata: { batchId, syncStartedAt: started } })
    }
    count += rows.length
    const paging = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>).paging : null
    const rawTotal = typeof paging === 'object' && paging !== null ? (paging as Record<string, unknown>).total : null
    const total: number | null = typeof rawTotal === 'number' ? rawTotal : null
    if (rows.length < MERCADOPAGO_PAGE_SIZE || (total !== null && count >= total)) break
  }
  return { source: 'payments_search', status: 'success', count, errorCode: null }
}

export async function syncMercadoPagoObservations({ userId, accessToken, now = new Date(), window, fetchImpl = fetch, store, lastSettlementPendingAt }: { userId: string; accessToken: string; now?: Date; window?: SyncWindow; fetchImpl?: FetchLike; store: Store; lastSettlementPendingAt?: string | null }) {
  const started = now.toISOString()
  const batchId = `mp-${now.getTime()}`
  const effectiveWindow = window ?? windowFromDates(new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000), new Date(now.getTime()), 'custom')
  const settle = async (operation: () => Promise<SourceRun>, source: Source): Promise<SourceRun> => {
    try { return await operation() } catch { return { source, status: 'error', count: 0, errorCode: 'provider_error' } }
  }
  const [payments, reports] = await Promise.all([
    settle(() => pullPayments({ userId, accessToken, window: effectiveWindow, fetchImpl, store, started, batchId }), 'payments_search'),
    settle(() => syncMercadoPagoSettlementReport({ userId, accessToken, now, window: effectiveWindow, fetchImpl, store, batchId, startedAt: started, lastPendingAt: lastSettlementPendingAt }), 'account_settlement_report'),
  ])
  return { batchId, startedAt: started, sources: [payments, reports].map((source) => ({ ...source, beginDate: effectiveWindow.beginDate, endDate: effectiveWindow.endDate })) }
}
