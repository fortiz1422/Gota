import { NextResponse } from 'next/server'
import { backgroundDatabase, mercadoPagoBackgroundEnabled } from '@/lib/mercadopago/sync-lease'
import { runMercadoPagoBackgroundCapture } from '@/lib/mercadopago/background-capture'

export const maxDuration = 60
const headers = { 'Cache-Control': 'private, no-store' }
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers })

/** Daily capture into review. Explicit connection opt-in; no financial posting. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return response({ error: 'cron_unavailable' }, 503)
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return response({ error: 'unauthorized' }, 401)
  if (!mercadoPagoBackgroundEnabled()) return response({ state: 'disabled' })
  try {
    const admin = backgroundDatabase()
    // One opted-in connection per invocation; oldest attempt first.
    const { data, error } = await admin.from('mercadopago_connections').select('id,user_id')
      .eq('background_sync_enabled', true).in('status', ['connected', 'error'])
      .not('incremental_watermark', 'is', null).not('access_token_ciphertext', 'is', null)
      .order('last_incremental_attempt_at', { ascending: true, nullsFirst: true }).limit(1)
    if (error) throw new Error('connection_read_failed')
    if (!data?.length) return response({ processed: 0 })
    const result = await runMercadoPagoBackgroundCapture(data[0].user_id, data[0].id)
    return response({ processed: 1, ...result }, result.status === 'success' ? 200 : 207)
  } catch (error) {
    if (error instanceof Error && error.message === 'sync_busy') return response({ processed: 0, state: 'busy' })
    if (error instanceof Error && error.message === 'oauth_not_ready') return response({ error: 'oauth_not_ready' }, 503)
    return response({ error: 'background_sync_failed' }, 502)
  }
}
