import { randomUUID } from 'node:crypto'
import { pullPayments, type SourceRun } from './observability-sync'
import type { RawObservation } from './raw-observation'
import type { SyncWindow } from './sync-window'

const OVERLAP_MS = 5 * 60 * 1000
const MAX_WINDOW_MS = 24 * 60 * 60 * 1000

/** Limit each run to one day; incomplete runs retry the same slice. */
export function incrementalWindow(watermark: string, now: Date): SyncWindow {
  const previous = Date.parse(watermark)
  if (!Number.isFinite(previous) || previous > now.getTime()) throw new Error('invalid_watermark')
  const begin = new Date(previous - OVERLAP_MS)
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

/** Capture only: no ledger dependency, no settlement configuration requests. */
export async function syncMercadoPagoIncremental({ userId, accessToken, watermark, store, now = new Date(), fetchImpl = fetch }: {
  userId: string; accessToken: string; watermark: string; store: IncrementalStore; now?: Date; fetchImpl?: typeof fetch
}) {
  const window = incrementalWindow(watermark, now)
  const batchId = `mp-${randomUUID()}`
  const startedAt = now.toISOString()
  let source: SourceRun
  try {
    source = await pullPayments({ userId, accessToken, window, fetchImpl, store, started: startedAt, batchId })
  } catch {
    source = { source: 'payments_search', status: 'error', count: 0, errorCode: 'provider_error' }
  }
  const run = { ...source, beginDate: window.beginDate, endDate: window.endDate }
  await store.saveSourceRun({ batchId, startedAt, run })
  if (run.status === 'success') await store.advanceWatermark(watermark, window.endTimestamp)
  return { batchId, startedAt, run }
}
