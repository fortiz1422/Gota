import { randomUUID } from 'node:crypto'
import { syncMercadoPagoSettlementReport } from './settlement-report'
import { observationNativeKey, type MercadoPagoSource, type RawObservation } from './raw-observation'
import { windowFromDates, type SyncWindow } from './sync-window'

export { observationNativeKey }
export type { RawObservation }

const API = 'https://api.mercadopago.com'

export const MERCADOPAGO_PAGE_SIZE = 50
/** Pages read before a slice may stop, once the time cursor can move. 10 × 50 = 500. */
export const MERCADOPAGO_MAX_PAGES = 10
/**
 * Extra pages in the same window when the oldest prefix cannot move the watermark
 * (one `date_created`, or a cluster inside the 5-minute overlap). 30 × 50 = 1500.
 * A larger cluster stays `pending`: the watermark does not move and nothing is skipped.
 * It is not imported automatically. That state is `held`, visible on the capture result.
 */
export const MERCADOPAGO_TIE_MAX_PAGES = 30

type Source = MercadoPagoSource
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
type Store = { upsertRawObservation: (observation: RawObservation) => Promise<void> }
/**
 * `pending` + `errorCode: null` on `payments_search` means the page cap was hit
 * and further pages remain. That is not `provider_error`. `coveredUntil` is the
 * newest `date_created` of an oldest-first prefix: every payment strictly before
 * it was stored; payments at that instant may still be unread.
 */
export type SourceRun = {
  source: Source
  status: 'success' | 'error' | 'pending'
  count: number
  errorCode: 'provider_error' | null
  beginDate?: string
  endDate?: string
  coveredUntil?: string
}

export type PaymentSearchRole = 'default' | 'payer' | 'collector'
export type PaymentSortOrder = 'asc' | 'desc'

function paymentSearchUrl(window: SyncWindow, offset: number, role: PaymentSearchRole = 'default', sortOrder: PaymentSortOrder = 'desc'): string {
  const url = new URL(`${API}/v1/payments/search`)
  url.search = new URLSearchParams({
    sort: 'date_created',
    criteria: sortOrder,
    range: 'date_created',
    begin_date: window.beginTimestamp,
    end_date: window.endTimestamp,
    limit: String(MERCADOPAGO_PAGE_SIZE),
    offset: String(offset),
  }).toString()
  if (role !== 'default') url.searchParams.set(`${role}.id`, 'me')
  return url.toString()
}

function createdMs(row: unknown): number | null {
  if (typeof row !== 'object' || row === null) return null
  const value = (row as Record<string, unknown>).date_created
  if (typeof value !== 'string') return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
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
    if (Array.isArray(value)) return value
  }
  throw new Error('provider_error')
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

export async function pullPayments({ userId, accessToken, window, fetchImpl, store, started, batchId, role = 'default', sortOrder = 'desc', watermarkMs }: { role?: PaymentSearchRole; sortOrder?: PaymentSortOrder; userId: string; accessToken: string; window: SyncWindow; fetchImpl: FetchLike; store: Store; started: string; batchId: string; watermarkMs?: number }): Promise<SourceRun> {
  let count = 0
  const seenKeys = new Set<string>()
  const created: number[] = []
  let datesOk = sortOrder === 'asc'
  const beginMs = Date.parse(window.beginTimestamp)
  const endMs = Date.parse(window.endTimestamp)
  const tieAware = sortOrder === 'asc' && watermarkMs !== undefined && Number.isFinite(watermarkMs)
  const hardCap = tieAware ? MERCADOPAGO_TIE_MAX_PAGES : MERCADOPAGO_MAX_PAGES
  for (let page = 0; page < hardCap; page += 1) {
    const payload = await getJson(paymentSearchUrl(window, page * MERCADOPAGO_PAGE_SIZE, role, sortOrder), accessToken, fetchImpl)
    const rows = items(payload)
    for (const row of rows) {
      const nativeKey = observationNativeKey(row)
      // Offset pagination can repeat a page. Repeated rows cannot prove coverage
      // or count toward advancing the incremental watermark.
      if (seenKeys.has(nativeKey)) throw new Error('provider_error')
      seenKeys.add(nativeKey)
      if (sortOrder === 'asc') {
        const ms = createdMs(row)
        const previous = created.length > 0 ? created[created.length - 1] : Number.NEGATIVE_INFINITY
        if (ms === null || ms < beginMs || ms > endMs || ms < previous) datesOk = false
        else created.push(ms)
      }
      await store.upsertRawObservation({ userId, source: 'payments_search', nativeKey, payload: row, firstSeenAt: started, lastSeenAt: started, metadata: { batchId, syncStartedAt: started } })
    }
    count += rows.length
    const paging = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>).paging : null
    const rawTotal = typeof paging === 'object' && paging !== null ? (paging as Record<string, unknown>).total : null
    const total: number | null = typeof rawTotal === 'number' ? rawTotal : null
    const complete = (total !== null && count >= total) || (total === null && rows.length < MERCADOPAGO_PAGE_SIZE)
    // A finished window may omit dates. An unfinished oldest-first page cannot move the cursor without them.
    if (sortOrder === 'asc' && !datesOk && !complete) throw new Error('provider_error')
    if (complete) return { source: 'payments_search', status: 'success', count, errorCode: null }
    // A short page that does not reach `total` contradicts the provider. Do not treat it as a cap.
    if (rows.length < MERCADOPAGO_PAGE_SIZE) throw new Error('provider_error')
    if (!tieAware && page === MERCADOPAGO_MAX_PAGES - 1) {
      return { source: 'payments_search', status: 'pending', count, errorCode: null }
    }
    if (tieAware && page + 1 >= MERCADOPAGO_MAX_PAGES) {
      const coveredMs = created[created.length - 1]
      if (created.length !== count || coveredMs === undefined) throw new Error('provider_error')
      // Keep reading this window only while the time cursor cannot move. Past the safety cap, stay pending.
      if (coveredMs > watermarkMs || page + 1 >= hardCap) {
        return { source: 'payments_search', status: 'pending', count, errorCode: null, coveredUntil: new Date(coveredMs).toISOString() }
      }
    }
  }
  return { source: 'payments_search', status: 'pending', count, errorCode: null }
}

export async function syncMercadoPagoObservations({ userId, accessToken, now = new Date(), window, fetchImpl = fetch, store, lastSettlementPendingAt }: { userId: string; accessToken: string; now?: Date; window?: SyncWindow; fetchImpl?: FetchLike; store: Store; lastSettlementPendingAt?: string | null }) {
  const started = now.toISOString()
  const batchId = `mp-${randomUUID()}`
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
