import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMercadoPagoOAuthReadiness, exchangeMercadoPagoRefreshToken } from '@/lib/mercadopago/oauth'
import { decryptMercadoPagoToken, encryptMercadoPagoToken } from '@/lib/mercadopago/token-crypto'
import { getLatestMercadoPagoSourceRuns, getMercadoPagoConnection, saveMercadoPagoSourceRun, saveRawObservation, updateMercadoPagoConnection } from '@/lib/mercadopago/server-repository'
import { syncMercadoPagoObservations, type SourceRun } from '@/lib/mercadopago/observability-sync'
import { parseSyncRequestBody, parseSyncWindow } from '@/lib/mercadopago/sync-window'

const headers = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' }
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers })
type SourceSummary = { status: SourceRun['status'] | 'not_run'; count: number; observedInRun: number; lastCompleteDate: string | null }
const emptySources = (): { payments: SourceSummary; reports: SourceSummary } => ({
  payments: { status: 'not_run', count: 0, observedInRun: 0, lastCompleteDate: null },
  reports: { status: 'not_run', count: 0, observedInRun: 0, lastCompleteDate: null },
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return response({ error: 'unauthorized' }, 401)

  const connection = await getMercadoPagoConnection(user.id)
  if (!connection) return response({ state: 'not_connected', lastSyncAt: null, sources: emptySources() })
  const sources = emptySources()
  const latestBySource = new Map<string, Awaited<ReturnType<typeof getLatestMercadoPagoSourceRuns>>[number]>()
  const latestCompleteBySource = new Map<string, Awaited<ReturnType<typeof getLatestMercadoPagoSourceRuns>>[number]>()
  for (const run of await getLatestMercadoPagoSourceRuns(user.id, connection.id)) {
    if (!latestBySource.has(run.source)) latestBySource.set(run.source, run)
    if (run.status === 'success' && run.end_date && !latestCompleteBySource.has(run.source)) latestCompleteBySource.set(run.source, run)
  }
  for (const run of latestBySource.values()) {
    const summary = { status: run.status, count: run.count, observedInRun: run.count, lastCompleteDate: latestCompleteBySource.get(run.source)?.end_date ?? null }
    if (run.source === 'payments_search') sources.payments = summary
    else sources.reports = summary
  }
  const completeDates = [sources.payments.lastCompleteDate, sources.reports.lastCompleteDate].filter((date): date is string => date !== null).sort()
  const argentinaToday = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const staleCutoff = new Date(`${argentinaToday}T00:00:00Z`).getTime() - 7 * 86400000
  const sinceLastFullSync = completeDates.length === 2 && new Date(`${completeDates[0]}T00:00:00Z`).getTime() < staleCutoff
    ? { available: true, beginDate: new Date(new Date(`${completeDates[0]}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10) }
    : { available: false, beginDate: null }
  return response({ state: connection.status === 'connected' ? 'connected' : 'error', lastSyncAt: connection.last_sync_at, sources, sinceLastFullSync })
}

export async function POST(request?: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return response({ error: 'unauthorized' }, 401)

  const readiness = getMercadoPagoOAuthReadiness()
  if (!readiness.ok) return response({ error: 'oauth_not_ready' }, 503)
  const connection = await getMercadoPagoConnection(user.id)
  if (!connection?.access_token_ciphertext) return response({ error: 'not_connected' }, 409)

  try {
    let body: unknown = {}
    if (request) {
      const text = await request.text()
      body = text ? JSON.parse(text) : {}
    }
    const previousRuns = await getLatestMercadoPagoSourceRuns(user.id, connection.id)
    const completeBySource = new Map<string, string>()
    for (const run of previousRuns) if (run.status === 'success' && run.end_date && !completeBySource.has(run.source)) completeBySource.set(run.source, run.end_date)
    const completeDates = [...completeBySource.values()].sort()
    const window = parseSyncWindow(parseSyncRequestBody(body), new Date(), completeDates.length === 2 ? completeDates[0] : null)
    let token = decryptMercadoPagoToken({ ciphertext: connection.access_token_ciphertext, encryptionKey: readiness.config.tokenEncryptionKey })
    const expires = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0
    if (expires && expires <= Date.now() + 30_000) {
      if (!connection.refresh_token_ciphertext) throw new Error('refresh_unavailable')
      const refreshed = await exchangeMercadoPagoRefreshToken({
        refreshToken: decryptMercadoPagoToken({ ciphertext: connection.refresh_token_ciphertext, encryptionKey: readiness.config.tokenEncryptionKey }),
        config: readiness.config,
      })
      token = refreshed.accessToken
      await updateMercadoPagoConnection(user.id, connection.id, {
        access_token_ciphertext: encryptMercadoPagoToken({ plaintext: refreshed.accessToken, encryptionKey: readiness.config.tokenEncryptionKey }),
        refresh_token_ciphertext: refreshed.refreshToken ? encryptMercadoPagoToken({ plaintext: refreshed.refreshToken, encryptionKey: readiness.config.tokenEncryptionKey }) : connection.refresh_token_ciphertext,
        token_expires_at: refreshed.expiresAt,
        status: 'connected',
        last_error_code: null,
      })
    }

    const lastSettlementPendingAt = previousRuns.find((run) => run.source === 'account_settlement_report' && run.status === 'pending')?.started_at ?? null
    const run = await syncMercadoPagoObservations({
      userId: user.id,
      accessToken: token,
      window,
      lastSettlementPendingAt,
      store: { upsertRawObservation: (observation) => saveRawObservation({ ...observation, connectionId: connection.id }) },
    })
    await Promise.all(run.sources.map((source) => saveMercadoPagoSourceRun({ userId: user.id, connectionId: connection.id, batchId: run.batchId, startedAt: run.startedAt, run: source })))
    const failed = run.sources.some((source) => source.status === 'error')
    await updateMercadoPagoConnection(user.id, connection.id, {
      last_sync_at: run.startedAt,
      status: failed ? 'error' : 'connected',
      last_error_code: failed ? 'provider_error' : null,
    })
    return response({
      range: { preset: window.preset, beginDate: window.beginDate, endDate: window.endDate },
      sources: Object.fromEntries(run.sources.map((source) => [source.source === 'payments_search' ? 'payments' : 'reports', { status: source.status, count: source.count, observedInRun: source.count, coverageComplete: source.status === 'success' }])),
    }, failed ? 207 : 200)
  } catch (error) {
    if (error instanceof Error && ['invalid_sync_schema', 'invalid_sync_preset', 'invalid_sync_dates', 'invalid_sync_range', 'future_sync_range', 'sync_range_too_large', 'no_complete_sync'].includes(error.message)) return response({ error: error.message }, 400)
    await updateMercadoPagoConnection(user.id, connection.id, { status: 'error', last_error_code: 'sync_failed' }).catch(() => undefined)
    return response({ error: 'sync_failed' }, 502)
  }
}
