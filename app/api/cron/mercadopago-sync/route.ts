import { NextResponse } from 'next/server'
import { backgroundDatabase, mercadoPagoBackgroundEnabled, withMercadoPagoSyncLease } from '@/lib/mercadopago/sync-lease'
import { getMercadoPagoOAuthReadiness } from '@/lib/mercadopago/oauth'
import { getMercadoPagoConnection, saveRawObservation, saveMercadoPagoSourceRun } from '@/lib/mercadopago/server-repository'
import { getValidMercadoPagoAccessToken } from '@/lib/mercadopago/access-token'
import { syncMercadoPagoIncremental } from '@/lib/mercadopago/incremental-sync'
import { runMercadoPagoAutoPost } from '@/lib/mercadopago/auto-post-service'
import { runMercadoPagoShadow } from '@/lib/mercadopago/shadow-service'

const headers = { 'Cache-Control': 'private, no-store' }
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers })

/** Dormant until deployment + DB + explicit opt-in. No Vercel schedule added yet. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return response({ error: 'cron_unavailable' }, 503)
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return response({ error: 'unauthorized' }, 401)
  if (!mercadoPagoBackgroundEnabled()) return response({ state: 'disabled' })
  const readiness = getMercadoPagoOAuthReadiness()
  if (!readiness.ok) return response({ error: 'oauth_not_ready' }, 503)
  try {
    const admin = backgroundDatabase()
    // One connection per invocation; oldest attempt first prevents starvation.
    const { data, error } = await admin.from('mercadopago_connections').select('id,user_id')
      .eq('background_sync_enabled', true).in('status', ['connected', 'error'])
      .not('incremental_watermark', 'is', null).not('access_token_ciphertext', 'is', null)
      .order('last_incremental_attempt_at', { ascending: true, nullsFirst: true }).limit(1)
    if (error) throw new Error('connection_read_failed')
    if (!data?.length) return response({ processed: 0 })
    const row = data[0]
    const result = await withMercadoPagoSyncLease(row.user_id, row.id, async leaseId => {
      const connection = await getMercadoPagoConnection(row.user_id)
      if (!connection || connection.id !== row.id) throw new Error('not_connected')
      const { data: state, error: stateError } = await admin.from('mercadopago_connections').select('incremental_watermark,background_sync_enabled,initial_import_started_at').eq('id', row.id).eq('user_id', row.user_id).single()
      if (stateError || !state?.incremental_watermark || !state.background_sync_enabled) throw new Error('not_enabled')
      const { error: attemptError } = await admin.from('mercadopago_connections').update({ last_incremental_attempt_at: new Date().toISOString() }).eq('id', row.id).eq('user_id', row.user_id).eq('sync_lease_id', leaseId)
      if (attemptError) throw new Error('attempt_write_failed')
      const accessToken = await getValidMercadoPagoAccessToken(row.user_id, connection, readiness.config, leaseId)
      const run = await syncMercadoPagoIncremental({
        userId: row.user_id, accessToken, watermark: state.incremental_watermark, earliestTimestamp: state.initial_import_started_at ?? undefined,
        fetchImpl: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
        store: {
          upsertRawObservation: observation => saveRawObservation({ ...observation, connectionId: row.id }),
          saveSourceRun: input => saveMercadoPagoSourceRun({ ...input, userId: row.user_id, connectionId: row.id }),
          advanceWatermark: async (expected, next) => {
            const { data: advanced, error: advanceError } = await admin.rpc('mercadopago_advance_watermark', { p_user_id: row.user_id, p_connection_id: row.id, p_lease_id: leaseId, p_expected: expected, p_next: next })
            if (advanceError || advanced !== true) throw new Error('watermark_write_failed')
          },
        },
      })
      // Retryable independently of the watermark: reevaluate preserved RAW on each invocation.
      const shadowCount = await runMercadoPagoShadow(row.user_id, row.id, connection.provider_user_id ?? '', connection.linked_account_id)
      const posting = await runMercadoPagoAutoPost(row.user_id, row.id)
      return { status: run.run.status, observed: run.run.count, shadowCount, posted: posting.posted }
    })
    return response({ processed: 1, ...result }, result.status === 'success' ? 200 : 207)
  } catch (error) {
    if (error instanceof Error && error.message === 'sync_busy') return response({ processed: 0, state: 'busy' })
    return response({ error: 'background_sync_failed' }, 502)
  }
}
