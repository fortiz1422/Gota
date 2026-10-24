import { NextResponse } from 'next/server'
import { mercadoPagoBackgroundEnabled } from '@/lib/mercadopago/sync-lease'
import { dispatchMercadoPagoDailyCaptures } from '@/lib/mercadopago/capture-dispatch'

export const maxDuration = 60
const headers = { 'Cache-Control': 'private, no-store' }
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers })

/** Daily capture into review for every opted-in connection. No financial posting. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return response({ error: 'cron_unavailable' }, 503)
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return response({ error: 'unauthorized' }, 401)
  if (!mercadoPagoBackgroundEnabled()) return response({ state: 'disabled' })
  try {
    const result = await dispatchMercadoPagoDailyCaptures()
    const complete = result.failed === 0 && result.pending === 0 && result.catchingUp === 0 && result.skipped === 0
    return response(result, complete ? 200 : 207)
  } catch (error) {
    if (error instanceof Error && error.message === 'oauth_not_ready') return response({ error: 'oauth_not_ready' }, 503)
    return response({ error: 'background_sync_failed' }, 502)
  }
}
