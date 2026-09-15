import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildMercadoPagoAuthorizeUrl,
  generatePkcePair,
  getMercadoPagoReadiness,
  MERCADOPAGO_STATE_COOKIE,
  MERCADOPAGO_VERIFIER_COOKIE,
} from '@/lib/mercadopago-spike/oauth'

export const dynamic = 'force-dynamic'

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' }

function noStore(response: NextResponse): NextResponse {
  Object.entries(NO_STORE_HEADERS).forEach(([name, value]) => response.headers.set(name, value))
  return response
}


export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return noStore(NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE_HEADERS }))

  const readiness = getMercadoPagoReadiness()
  if (!readiness.ok) {
    return noStore(NextResponse.json({ error: 'mercadopago_oauth_not_ready', missing: readiness.missing }, { status: 501, headers: NO_STORE_HEADERS }))
  }

  const pair = generatePkcePair()
  const url = buildMercadoPagoAuthorizeUrl({
    clientId: readiness.config.clientId,
    redirectUri: readiness.config.redirectUri,
    state: pair.state,
    challenge: pair.challenge,
  })
  const response = noStore(NextResponse.redirect(url))
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 600,
  }
  response.cookies.set(MERCADOPAGO_STATE_COOKIE, pair.state, cookieOptions)
  response.cookies.set(MERCADOPAGO_VERIFIER_COOKIE, pair.verifier, cookieOptions)
  return response
}