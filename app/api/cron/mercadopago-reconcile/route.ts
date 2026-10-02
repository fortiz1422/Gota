import { NextResponse } from 'next/server'
import { backgroundDatabase, mercadoPagoBackgroundEnabled, withMercadoPagoSyncLease } from '@/lib/mercadopago/sync-lease'
import { getMercadoPagoOAuthReadiness } from '@/lib/mercadopago/oauth'
import { getMercadoPagoConnection } from '@/lib/mercadopago/server-repository'
import { runMercadoPagoReconciliation } from '@/lib/mercadopago/reconcile-service'
import { runMercadoPagoShadow } from '@/lib/mercadopago/shadow-service'
import { runMercadoPagoAutoPost } from '@/lib/mercadopago/auto-post-service'
const json = (body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}})
/** Separate cadence; no schedule or live opt-in is created by this route. */
export async function GET(request:Request) {
  const secret=process.env.CRON_SECRET
  if (!secret) return json({error:'cron_unavailable'},503)
  if (request.headers.get('authorization')!==`Bearer ${secret}`) return json({error:'unauthorized'},401)
  if (!mercadoPagoBackgroundEnabled() || process.env.MERCADOPAGO_RECONCILIATION_ENABLED!=='true') return json({state:'disabled'})
  const readiness=getMercadoPagoOAuthReadiness()
  if (!readiness.ok) return json({error:'oauth_not_ready'},503)
  try {
    const database=backgroundDatabase(), now=new Date()
    const successBefore=new Date(now.getTime()-86400000).toISOString(), attemptBefore=new Date(now.getTime()-30*60000).toISOString()
    const {data,error}=await database.from('mercadopago_connections').select('id,user_id').eq('background_sync_enabled',true).in('status',['connected','error'])
      .or(`last_reconciliation_success_at.is.null,last_reconciliation_success_at.lt.${successBefore}`)
      .or(`last_reconciliation_attempt_at.is.null,last_reconciliation_attempt_at.lt.${attemptBefore}`)
      .not('incremental_watermark','is',null).order('last_reconciliation_attempt_at',{ascending:true,nullsFirst:true}).limit(1)
    if (error) throw Error('reconciliation_state_unavailable')
    if (!data?.length) return json({processed:0})
    const row=data[0]
    const result=await withMercadoPagoSyncLease(row.user_id,row.id,async leaseId=>{
      const connection=await getMercadoPagoConnection(row.user_id)
      if (!connection || connection.id!==row.id) throw Error('inactive_connection')
      const {data:attempt,error:attemptError}=await database.from('mercadopago_connections').update({last_reconciliation_attempt_at:now.toISOString()}).eq('id',row.id).eq('user_id',row.user_id).eq('background_sync_enabled',true).eq('sync_lease_id',leaseId).select('id').maybeSingle()
      if (attemptError || !attempt) throw Error('reconciliation_attempt_failed')
      const run=await runMercadoPagoReconciliation(row.user_id,connection,readiness.config,leaseId,now)
      if (run.status==='success') {
        const {data:updated,error:updateError}=await database.from('mercadopago_connections').update({last_reconciliation_success_at:now.toISOString()}).eq('id',row.id).eq('user_id',row.user_id).eq('background_sync_enabled',true).eq('sync_lease_id',leaseId).gt('sync_lease_until',new Date().toISOString()).select('id').maybeSingle()
        if (updateError || !updated) throw Error('reconciliation_finalize_failed')
      }
      await runMercadoPagoShadow(row.user_id,row.id,connection.provider_user_id??'',connection.linked_account_id)
      const posting=await runMercadoPagoAutoPost(row.user_id,row.id)
      return {status:run.status,observed:run.count,posted:posting.posted}
    })
    return json({processed:1,...result},result.status==='success'?200:207)
  } catch(error) {
    if (error instanceof Error && error.message==='sync_busy') return json({processed:0,state:'busy'})
    return json({error:'reconciliation_failed'},502)
  }
}
