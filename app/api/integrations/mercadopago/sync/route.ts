import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMercadoPagoOAuthReadiness, exchangeMercadoPagoRefreshToken } from '@/lib/mercadopago/oauth'
import { decryptMercadoPagoToken, encryptMercadoPagoToken } from '@/lib/mercadopago/token-crypto'
import { getLatestMercadoPagoSourceRuns, getMercadoPagoConnection, saveMercadoPagoSourceRun, saveRawObservation, updateMercadoPagoConnection } from '@/lib/mercadopago/server-repository'
import { syncMercadoPagoObservations, type SourceRun } from '@/lib/mercadopago/observability-sync'

const headers = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' }
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers })
type SourceSummary = { status: SourceRun['status'] | 'not_run'; count: number; errorCode: SourceRun['errorCode'] }
const emptySources = (): { payments: SourceSummary; reports: SourceSummary } => ({
  payments: { status: 'not_run', count: 0, errorCode: null },
  reports: { status: 'not_run', count: 0, errorCode: null },
})

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return response({ error: 'unauthorized' }, 401)

  const connection = await getMercadoPagoConnection(user.id)
  if (!connection) return response({ state: 'not_connected', lastSyncAt: null, sources: emptySources() })
  const sources = emptySources()
  for (const run of await getLatestMercadoPagoSourceRuns(user.id, connection.id)) {
    const summary = { status: run.status, count: run.count, errorCode: run.error_code }
    if (run.source === 'payments_search') sources.payments = summary
    else sources.reports = summary
  }
  return response({ state: connection.status === 'connected' ? 'connected' : 'error', lastSyncAt: connection.last_sync_at, sources })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return response({ error: 'unauthorized' }, 401)

  const readiness = getMercadoPagoOAuthReadiness()
  if (!readiness.ok) return response({ error: 'oauth_not_ready' }, 503)
  const connection = await getMercadoPagoConnection(user.id)
  if (!connection?.access_token_ciphertext) return response({ error: 'not_connected' }, 409)

  try {
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

    const run = await syncMercadoPagoObservations({
      userId: user.id,
      accessToken: token,
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
      sources: Object.fromEntries(run.sources.map((source) => [source.source === 'payments_search' ? 'payments' : 'reports', { status: source.status, count: source.count, errorCode: source.errorCode }])),
    })
  } catch {
    await updateMercadoPagoConnection(user.id, connection.id, { status: 'error', last_error_code: 'sync_failed' }).catch(() => undefined)
    return response({ error: 'sync_failed' }, 502)
  }
}
