import { backgroundDatabase, mercadoPagoBackgroundEnabled } from './sync-lease'
import { getMercadoPagoOAuthReadiness } from './oauth'
import { CAPTURE_BUDGET_MS, CAPTURE_MAX_WINDOWS, runMercadoPagoBackgroundCapture } from './background-capture'

const PROVIDER_READ_MS = 8_000
const TOKEN_REFRESH_MS = 8_000
const LEASE_RESERVE_MS = 2_000
/** Lease, token refresh, and one provider read. A turn shorter than this cannot finish a window. */
const MIN_TURN_MS = LEASE_RESERVE_MS + TOKEN_REFRESH_MS + PROVIDER_READ_MS
const FUNCTION_LIMIT_MS = 60_000

const SAFE_REASONS = new Set([
  'sync_busy', 'not_enabled', 'not_connected', 'attempt_write_failed', 'watermark_write_failed',
  'watermark_not_advanced', 'sync_lease_failed', 'sync_lease_release_failed', 'connection_read_failed',
  'invalid_watermark', 'invalid_import_boundary', 'capture_timeout', 'capture_budget_exhausted',
])

function withWallClock<T>(work: Promise<T>, ms: number, onTimeout: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout()
      reject(new Error('capture_timeout'))
    }, ms)
  })
  return Promise.race([work, timeout]).finally(() => { if (timer) clearTimeout(timer) })
}

function safeReason(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  return SAFE_REASONS.has(message) ? message : 'capture_failed'
}

export type CaptureDispatchConnection = {
  connectionId: string
  status: 'pending' | 'success' | 'catching_up' | 'error' | 'busy'
  windows: number
  observed: number
  upToDate: boolean
  cursorAdvanced: boolean
  posted: 0
  reason?: string
}

export type CaptureDispatchResult = {
  processed: number
  failed: number
  skipped: number
  pending: number
  catchingUp: number
  posted: 0
  connections: CaptureDispatchConnection[]
}

type Slot = CaptureDispatchConnection & { order: number; userId: string; finished: boolean }

/** One shared 40s budget. Each connection gets one day-window per turn, oldest attempt first.
 * A busy, failed, slow, or hung connection does not take the remaining turns.
 */
export async function dispatchMercadoPagoDailyCaptures(budgetMs = CAPTURE_BUDGET_MS): Promise<CaptureDispatchResult> {
  if (!mercadoPagoBackgroundEnabled()) throw new Error('background_disabled')
  if (!getMercadoPagoOAuthReadiness().ok) throw new Error('oauth_not_ready')
  const admin = backgroundDatabase()
  const { data, error } = await admin.from('mercadopago_connections').select('id,user_id')
    .eq('background_sync_enabled', true).in('status', ['connected', 'error'])
    .not('incremental_watermark', 'is', null).not('access_token_ciphertext', 'is', null)
    .order('last_incremental_attempt_at', { ascending: true, nullsFirst: true }).order('id', { ascending: true })
  if (error || !Array.isArray(data)) throw new Error('connection_read_failed')
  const seen = new Set<string>()
  const slots: Slot[] = []
  for (const row of data) {
    if (typeof row?.id !== 'string' || typeof row?.user_id !== 'string' || !row.id || !row.user_id) throw new Error('connection_read_failed')
    if (seen.has(row.id)) continue
    seen.add(row.id)
    slots.push({
      order: slots.length, connectionId: row.id, userId: row.user_id, status: 'pending', windows: 0, observed: 0,
      upToDate: false, cursorAdvanced: false, posted: 0, finished: false,
    })
  }
  const deadline = Date.now() + budgetMs
  while (Date.now() < deadline) {
    const next = slots.filter(slot => !slot.finished && slot.windows < CAPTURE_MAX_WINDOWS)
      .sort((a, b) => a.windows - b.windows || a.order - b.order)[0]
    if (!next) break
    const remaining = deadline - Date.now()
    if (remaining < MIN_TURN_MS) break
    const slice = Math.min(remaining, MIN_TURN_MS, FUNCTION_LIMIT_MS)
    const gate = { open: true }
    const work = runMercadoPagoBackgroundCapture(next.userId, next.connectionId, {
      deadline, maxWindows: 1, allowCommit: () => gate.open,
    })
    void work.catch(() => undefined)
    try {
      const result = await withWallClock(work, slice, () => { gate.open = false })
      if (result.posted !== 0) throw new Error('capture_posted')
      if (result.windows <= 0) {
        if (result.upToDate) {
          next.status = 'success'
          next.upToDate = true
          next.finished = true
          continue
        }
        break
      }
      next.windows += result.windows
      next.observed += result.observed
      if (result.status === 'error') {
        next.status = 'error'
        next.upToDate = false
        next.finished = true
        next.reason = 'provider_error'
        continue
      }
      next.cursorAdvanced = true
      next.upToDate = result.upToDate
      next.status = result.upToDate ? 'success' : 'catching_up'
      next.finished = next.status === 'success' || next.windows >= CAPTURE_MAX_WINDOWS
    } catch (error) {
      if (error instanceof Error && (error.message === 'oauth_not_ready' || error.message === 'background_disabled' || error.message === 'capture_posted')) throw error
      next.upToDate = false
      if (error instanceof Error && error.message === 'capture_budget_exhausted') {
        next.status = next.cursorAdvanced ? 'catching_up' : 'pending'
        next.reason = 'capture_budget_exhausted'
        next.finished = true
        break
      }
      next.finished = true
      if (error instanceof Error && error.message === 'sync_busy') {
        next.status = 'busy'
        next.reason = 'sync_busy'
      } else if (error instanceof Error && error.message === 'capture_timeout') {
        next.status = 'error'
        next.reason = 'capture_timeout'
      } else {
        next.status = 'error'
        next.reason = safeReason(error)
      }
    }
  }
  const connections = slots.map(slot => ({
    connectionId: slot.connectionId, status: slot.status, windows: slot.windows, observed: slot.observed,
    upToDate: slot.upToDate, cursorAdvanced: slot.cursorAdvanced, posted: 0 as const,
    ...(slot.reason ? { reason: slot.reason } : {}),
  }))
  return {
    processed: slots.filter(slot => slot.status === 'success' || slot.status === 'catching_up').length,
    failed: slots.filter(slot => slot.status === 'error').length,
    skipped: slots.filter(slot => slot.status === 'busy').length,
    pending: slots.filter(slot => slot.status === 'pending').length,
    catchingUp: slots.filter(slot => slot.status === 'catching_up').length,
    posted: 0,
    connections,
  }
}
