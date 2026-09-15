import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { exchangeMercadoPagoAuthorizationCode, getMercadoPagoOAuthReadiness, MERCADOPAGO_STATE_COOKIE, MERCADOPAGO_VERIFIER_COOKIE } from '@/lib/mercadopago/oauth'
import { saveMercadoPagoConnection } from '@/lib/mercadopago/server-repository'

const headers = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' }
function redirect(request: Request, code: string) {
  const response = NextResponse.redirect(new URL(`/settings?mp_status=${encodeURIComponent(code)}`, request.url), { headers })
  response.cookies.delete(MERCADOPAGO_STATE_COOKIE)
  response.cookies.delete(MERCADOPAGO_VERIFIER_COOKIE)
  return response
}
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers })
  const query = new URL(request.url).searchParams
  const readiness = getMercadoPagoOAuthReadiness()
  if (!readiness.ok) return redirect(request, 'oauth_not_ready')
  const state = query.get('state')
  const code = query.get('code')
  const providerError = query.get('error')
  const cookieStore = await cookies()
  const expectedState = cookieStore.get(MERCADOPAGO_STATE_COOKIE)?.value
  const verifier = cookieStore.get(MERCADOPAGO_VERIFIER_COOKIE)?.value
  if (providerError) return redirect(request, 'provider_denied')
  if (!state || !code || !expectedState || state !== expectedState || !verifier) return redirect(request, 'invalid_oauth_state')
  try {
    const token = await exchangeMercadoPagoAuthorizationCode({ code, verifier, config: readiness.config })
    await saveMercadoPagoConnection(user.id, token, readiness.config.tokenEncryptionKey)
    return redirect(request, 'connected')
  } catch {
    return redirect(request, 'oauth_callback_failed')
  }
}
