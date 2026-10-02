import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { mercadoPagoBackgroundEnabled } from '@/lib/mercadopago/sync-lease'
import { getMercadoPagoOAuthReadiness } from '@/lib/mercadopago/oauth'
import { captureProbeStart, runMercadoPagoCaptureProbe, runMercadoPagoSettlementProbe } from '@/lib/mercadopago/capture-probe'

export const maxDuration = 120
const schema = z.object({ day: z.string(), source: z.enum(['payments', 'settlement']).optional() }).strict()
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

export async function POST(request: Request) {
  // Never available on production, even if the rollout flag is accidentally enabled there.
  if (process.env.VERCEL_ENV !== 'preview' || !mercadoPagoBackgroundEnabled()) return json({ error: 'probe_disabled' }, 404)
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'invalid_origin' }, 403)
  const session = await createClient()
  const user = (await session.auth.getUser()).data.user
  if (!user) return json({ error: 'unauthorized' }, 401)
  const body = schema.safeParse(await request.json().catch(() => null))
  if (!body.success) return json({ error: 'invalid_probe_day' }, 422)
  try { captureProbeStart(body.data.day) } catch { return json({ error: 'invalid_probe_day' }, 422) }
  const readiness = getMercadoPagoOAuthReadiness()
  if (!readiness.ok) return json({ error: 'oauth_not_ready' }, 503)
  try {
    const probe = body.data.source === 'settlement' ? runMercadoPagoSettlementProbe : runMercadoPagoCaptureProbe
    return json(await probe(user.id, body.data.day, readiness.config))
  } catch (error) {
    const code = error instanceof Error && ['sync_busy', 'not_connected', 'probe_capture_incomplete'].includes(error.message) ? error.message : 'probe_failed'
    return json({ error: code }, code === 'sync_busy' || code === 'not_connected' ? 409 : 502)
  }
}
