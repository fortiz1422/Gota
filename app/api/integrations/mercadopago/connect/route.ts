import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildMercadoPagoAuthorizeUrl, generatePkcePair, getMercadoPagoOAuthReadiness, MERCADOPAGO_STATE_COOKIE, MERCADOPAGO_VERIFIER_COOKIE } from '@/lib/mercadopago/oauth'

export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' }
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers })
  const readiness = getMercadoPagoOAuthReadiness()
  if (!readiness.ok) return NextResponse.json({ error: 'oauth_not_ready' }, { status: 503, headers })
  const pair = generatePkcePair()
  const response = NextResponse.redirect(buildMercadoPagoAuthorizeUrl({ config: readiness.config, state: pair.state, challenge: pair.challenge }), { headers })
  const options = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/', maxAge: 600 }
  response.cookies.set(MERCADOPAGO_STATE_COOKIE, pair.state, options)
  response.cookies.set(MERCADOPAGO_VERIFIER_COOKIE, pair.verifier, options)
  return response
}
