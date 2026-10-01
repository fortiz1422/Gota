import { backgroundDatabase, mercadoPagoBackgroundEnabled, withMercadoPagoSyncLease } from './sync-lease'
import { getMercadoPagoConnection, getLatestMercadoPagoSourceRuns, saveMercadoPagoSourceRun, saveRawObservation, updateMercadoPagoConnection, type MercadoPagoConnection } from './server-repository'
import { syncMercadoPagoObservations } from './observability-sync'
import { getValidMercadoPagoAccessToken } from './access-token'
import type { OAuthConfig } from './oauth'
import type { SyncWindow } from './sync-window'

/** Legacy manual fallback. Financial confirmation stays separate from capture. */
async function manualSync(userId: string, connection: MercadoPagoConnection, config: OAuthConfig, window: SyncWindow, previousRuns: Awaited<ReturnType<typeof getLatestMercadoPagoSourceRuns>>, leaseId?: string) {
  const accessToken = await getValidMercadoPagoAccessToken(userId, connection, config, leaseId)
  const lastSettlementPendingAt = previousRuns.find((run) => run.source === 'account_settlement_report' && run.status === 'pending')?.started_at ?? null
  const run = await syncMercadoPagoObservations({
    userId: userId,
    accessToken,
    window,
    lastSettlementPendingAt,
    store: { upsertRawObservation: (observation) => saveRawObservation({ ...observation, connectionId: connection.id }) },
  })
  await Promise.all(run.sources.map((source) => saveMercadoPagoSourceRun({ userId: userId, connectionId: connection.id, batchId: run.batchId, startedAt: run.startedAt, run: source })))
  const failed = run.sources.some((source) => source.status === 'error')
  const patch = {
    last_sync_at: run.startedAt,
    status: failed ? 'error' : 'connected',
    last_error_code: failed ? 'provider_error' : null,
  }
  if (leaseId) {
    const { data, error } = await backgroundDatabase().from('mercadopago_connections').update(patch).eq('id', connection.id).eq('user_id', userId).eq('sync_lease_id', leaseId).gt('sync_lease_until', new Date().toISOString()).in('status', ['connected', 'error']).not('access_token_ciphertext', 'is', null).select('id').maybeSingle()
    if (error || !data) throw new Error('sync_finalize_failed')
  } else {
    await updateMercadoPagoConnection(userId, connection.id, patch)
  }
  return { run, failed }
}

export async function runMercadoPagoManualSync(userId: string, connection: MercadoPagoConnection, config: OAuthConfig, window: SyncWindow, previousRuns: Awaited<ReturnType<typeof getLatestMercadoPagoSourceRuns>>) {
  if (!mercadoPagoBackgroundEnabled()) return manualSync(userId, connection, config, window, previousRuns)
  return withMercadoPagoSyncLease(userId, connection.id, async leaseId => {
    const fresh = await getMercadoPagoConnection(userId)
    if (!fresh || fresh.id !== connection.id) throw new Error('not_connected')
    return manualSync(userId, fresh, config, window, await getLatestMercadoPagoSourceRuns(userId, fresh.id), leaseId)
  })
}
