import { backgroundDatabase, mercadoPagoBackgroundEnabled, withMercadoPagoSyncLease } from './sync-lease'
import { getMercadoPagoOAuthReadiness } from './oauth'
import { getLatestMercadoPagoSourceRuns, getMercadoPagoConnection, saveRawObservation, saveMercadoPagoSourceRun } from './server-repository'
import { getValidMercadoPagoAccessToken } from './access-token'
import { parseTieResume, syncMercadoPagoIncremental } from './incremental-sync'

export const CAPTURE_MAX_WINDOWS = 32
export const CAPTURE_BUDGET_MS = 40_000

/** Capture only. Never imports posting/shadow services or writes the financial ledger.
 * Each completed day commits its own cursor; an interrupted catch-up resumes there.
 * The dispatcher passes one shared deadline and one window per turn.
 */
export async function runMercadoPagoBackgroundCapture(userId: string, connectionId: string, options: { deadline?: number; maxWindows?: number; allowCommit?: () => boolean } = {}) {
  if (!mercadoPagoBackgroundEnabled()) throw new Error('background_disabled')
  const readiness = getMercadoPagoOAuthReadiness()
  if (!readiness.ok) throw new Error('oauth_not_ready')
  const deadline = options.deadline ?? Date.now() + CAPTURE_BUDGET_MS
  const maxWindows = options.maxWindows ?? CAPTURE_MAX_WINDOWS
  if (maxWindows <= 0 || Date.now() >= deadline) {
    return { status: 'catching_up' as const, observed: 0, windows: 0, capturedThrough: null, upToDate: false, posted: 0 as const, cursorMoved: false }
  }
  const target = new Date()
  return withMercadoPagoSyncLease(userId, connectionId, async leaseId => {
    const admin = backgroundDatabase()
    const connection = await getMercadoPagoConnection(userId)
    if (!connection || connection.id !== connectionId || !connection.access_token_ciphertext || !['connected', 'error'].includes(connection.status)) throw new Error('not_connected')
    const { data: state, error } = await admin.from('mercadopago_connections')
      .select('incremental_watermark,background_sync_enabled,initial_import_started_at')
      .eq('id', connectionId).eq('user_id', userId).single()
    if (error || !state?.background_sync_enabled || !state.incremental_watermark) throw new Error('not_enabled')
    if (Date.now() >= deadline) {
      return { status: 'catching_up' as const, observed: 0, windows: 0, capturedThrough: state.incremental_watermark as string, upToDate: false, posted: 0 as const, cursorMoved: false }
    }
    const { data: attempted, error: attemptError } = await admin.from('mercadopago_connections')
      .update({ last_incremental_attempt_at: target.toISOString() })
      .eq('id', connectionId).eq('user_id', userId).eq('sync_lease_id', leaseId)
      .gt('sync_lease_until', new Date().toISOString()).eq('background_sync_enabled', true)
      .select('id').maybeSingle()
    if (attemptError || !attempted) throw new Error('attempt_write_failed')
    if (Date.parse(state.incremental_watermark) >= target.getTime()) {
      return { status: 'success' as const, observed: 0, windows: 0, capturedThrough: state.incremental_watermark as string, upToDate: true, posted: 0 as const, cursorMoved: false }
    }
    const accessToken = await getValidMercadoPagoAccessToken(userId, connection, readiness.config, leaseId, deadline)
    const initialWatermark: string = state.incremental_watermark
    let watermark: string = state.incremental_watermark
    let observed = 0
    let windows = 0
    let status: 'success' | 'error' | 'catching_up' = 'catching_up'
    for (; windows < maxWindows && Date.now() < deadline; windows++) {
      const expected = watermark
      const latest = await getLatestMercadoPagoSourceRuns(userId, connectionId)
      const latestPayments = latest.find(run => run.source === 'payments_search')
      const resume = latestPayments?.status === 'pending' ? parseTieResume(latestPayments.batch_id) : null
      const result = await syncMercadoPagoIncremental({
        userId, accessToken, watermark, now: new Date(), resume,
        earliestTimestamp: state.initial_import_started_at ?? undefined,
        fetchImpl: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(Math.max(1, Math.min(8000, deadline - Date.now()))) }),
        store: {
          upsertRawObservation: async observation => {
            if (Date.now() >= deadline || options.allowCommit?.() === false) throw new Error('capture_budget_exhausted')
            await saveRawObservation({ ...observation, connectionId })
          },
          saveSourceRun: input => saveMercadoPagoSourceRun({ ...input, userId, connectionId }),
          advanceWatermark: async (previous, next) => {
            if (Date.now() > deadline || options.allowCommit?.() === false) throw new Error('capture_budget_exhausted')
            const { data: advanced, error: advanceError } = await admin.rpc('mercadopago_advance_watermark', {
              p_user_id: userId, p_connection_id: connectionId, p_lease_id: leaseId, p_expected: previous, p_next: next,
            })
            if (advanceError || advanced !== true) throw new Error('watermark_write_failed')
            watermark = next
          },
        },
      })
      observed += result.run.count
      if (result.run.status === 'error') { status = 'error'; windows++; break }
      const moved = Date.parse(watermark) > Date.parse(expected)
      // A tie the safety cap could not pass stays pending. The next turn resumes it.
      // That is not a provider failure and must not freeze the daily dispatch on error.
      if (!moved) {
        if (result.run.status === 'pending') { status = 'catching_up'; windows++; break }
        throw new Error('watermark_not_advanced')
      }
      if (Date.parse(watermark) >= target.getTime()) { status = 'success'; windows++; break }
      status = 'catching_up'
    }
    return { status, observed, windows, capturedThrough: watermark, upToDate: status === 'success', posted: 0 as const, cursorMoved: Date.parse(watermark) > Date.parse(initialWatermark) }
  })
}
