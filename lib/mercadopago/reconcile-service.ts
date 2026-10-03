import { randomUUID } from 'node:crypto'
import type { MercadoPagoConnection } from './server-repository'
import { getLatestMercadoPagoSourceRuns, saveMercadoPagoSourceRun, saveRawObservation } from './server-repository'
import { getValidMercadoPagoAccessToken } from './access-token'
import type { OAuthConfig } from './oauth'
import { windowFromDates } from './sync-window'
import { syncMercadoPagoSettlementReport } from './settlement-report'

export function closedMercadoPagoReconciliationWindow(now: Date) {
  const day = new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)}T00:00:00Z`)
  const yesterday = new Date(day.getTime()-86400000)
  return windowFromDates(new Date(yesterday.getTime()-2*86400000),yesterday,'custom')
}
/** Settlement-only auditor. Never creates or updates provider configuration. */
export async function runMercadoPagoReconciliation(userId: string, connection: MercadoPagoConnection, config: OAuthConfig, leaseId: string, now = new Date()) {
  const accessToken = await getValidMercadoPagoAccessToken(userId, connection, config, leaseId)
  const runs = await getLatestMercadoPagoSourceRuns(userId, connection.id)
  const batchId = randomUUID(), startedAt = now.toISOString()
  const window = closedMercadoPagoReconciliationWindow(now)
  const run = await syncMercadoPagoSettlementReport({ userId,accessToken,now,window,batchId,startedAt,
    allowConfigCreation:false,exactWindow:true,
    lastPendingAt:runs.find(item=>item.source==='account_settlement_report' && item.status==='pending')?.started_at,
    fetchImpl:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(8000)}),
    store:{upsertRawObservation:observation=>saveRawObservation({...observation,connectionId:connection.id})},
  })
  await saveMercadoPagoSourceRun({userId,connectionId:connection.id,batchId,startedAt,run:{...run,beginDate:window.beginDate,endDate:window.endDate}})
  return run
}
