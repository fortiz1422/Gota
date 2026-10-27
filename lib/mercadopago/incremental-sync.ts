import { randomUUID } from 'node:crypto'
import { pullPayments, type SourceRun } from './observability-sync'
import type { RawObservation } from './raw-observation'
import type { SyncWindow } from './sync-window'

const OVERLAP_MS = 5 * 60 * 1000
const MAX_WINDOW_MS = 24 * 60 * 60 * 1000

/** Limit each run to one day. The next run overlaps OVERLAP_MS so a partial prefix is re-read, not skipped. */
export function incrementalWindow(watermark: string, now: Date, earliestTimestamp?: string): SyncWindow {
  const previous = Date.parse(watermark)
  if (!Number.isFinite(previous) || previous > now.getTime()) throw new Error('invalid_watermark')
  const earliest = earliestTimestamp ? Date.parse(earliestTimestamp) : Number.NEGATIVE_INFINITY
  if (earliestTimestamp && (!Number.isFinite(earliest) || earliest > previous)) throw new Error('invalid_import_boundary')
  const begin = new Date(Math.max(previous - OVERLAP_MS, earliest))
  const end = new Date(Math.min(now.getTime(), previous + MAX_WINDOW_MS))
  return {
    preset: 'custom', beginDate: begin.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10),
    beginTimestamp: begin.toISOString(), endTimestamp: end.toISOString(),
  }
}

export type IncrementalStore = {
  upsertRawObservation: (observation: RawObservation) => Promise<void>
  saveSourceRun: (input: { batchId: string; startedAt: string; run: SourceRun }) => Promise<void>
  /** Must use an atomic compare-and-set under a connection lease. */
  advanceWatermark: (expected: string, next: string) => Promise<void>
}

/** Next cursor, or null when this run must not move it. */
export function watermarkAfterRun(current: string, windowEnd: string, run: SourceRun): string | null {
  if (run.status === 'success') return windowEnd
  if (run.status !== 'pending' || run.coveredUntil === undefined) return null
  const next = Date.parse(run.coveredUntil)
  const previous = Date.parse(current)
  const end = Date.parse(windowEnd)
  if (!Number.isFinite(next) || next <= previous || next > end) return null
  return new Date(next).toISOString()
}

/**
 * Capture only: no ledger dependency and no settlement configuration requests.
 * Reads oldest `date_created` first, at most one page cap per call.
 * A full window advances the watermark to its end. A page cap (`pending`, errorCode null)
 * advances only to `coveredUntil`: every payment strictly before that instant was stored.
 * Payments at that instant are included again next run via the overlap; nothing newer is skipped.
 * Provider failures do not move the watermark. Amounts are never summed, so ARS and USD stay separate rows.
 * One `date_created` with more unread payments than the page cap is not passed over.
 */
export async function syncMercadoPagoIncremental({ userId, accessToken, watermark, store, earliestTimestamp, now = new Date(), fetchImpl = fetch }: {
  userId: string; accessToken: string; watermark: string; earliestTimestamp?: string; store: IncrementalStore; now?: Date; fetchImpl?: typeof fetch
}) {
  const window = incrementalWindow(watermark, now, earliestTimestamp)
  const batchId = `mp-${randomUUID()}`
  const startedAt = now.toISOString()
  let source: SourceRun
  try {
    source = await pullPayments({ userId, accessToken, window, fetchImpl, store, started: startedAt, batchId, sortOrder: 'asc' })
  } catch (error) {
    if (error instanceof Error && error.message === 'capture_budget_exhausted') throw error
    source = { source: 'payments_search', status: 'error', count: 0, errorCode: 'provider_error' }
  }
  const run = { ...source, beginDate: window.beginDate, endDate: window.endDate }
  await store.saveSourceRun({ batchId, startedAt, run })
  let advancedTo: string | null = null
  try {
    const cursor = watermarkAfterRun(watermark, window.endTimestamp, run)
    if (cursor) {
      await store.advanceWatermark(watermark, cursor)
      advancedTo = cursor
    }
    return { batchId, startedAt, run }
  } finally {
    if (run.status === 'pending') {
      console.info('mercadopago_payments_page_cap', JSON.stringify({
        batchId, count: run.count, coveredUntil: run.coveredUntil ?? null, cursor: advancedTo,
        begin: window.beginTimestamp, end: window.endTimestamp,
      }))
    }
  }
}
