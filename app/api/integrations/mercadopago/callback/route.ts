import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { exchangeMercadoPagoAuthorizationCode, getMercadoPagoOAuthReadiness, MERCADOPAGO_STATE_COOKIE, MERCADOPAGO_VERIFIER_COOKIE } from '@/lib/mercadopago/oauth'
import { saveMercadoPagoConnection } from '@/lib/mercadopago/server-repository'

const headers = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' }
function clearOAuthCookies(response: NextResponse) {
  response.cookies.delete(MERCADOPAGO_STATE_COOKIE)
  response.cookies.delete(MERCADOPAGO_VERIFIER_COOKIE)
  return response
}
function resultRedirect(request: Request, status: 'success' | 'denied' | 'invalid' | 'not_configured' | 'provider_error') {
  return clearOAuthCookies(NextResponse.redirect(new URL(`/integrations/mercadopago/result?status=${status}`, request.url), { headers }))
}
function unauthorizedResponse() {
  return clearOAuthCookies(NextResponse.json({ error: 'unauthorized' }, { status: 401, headers }))
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorizedResponse()

  const query = new URL(request.url).searchParams
  const readiness = getMercadoPagoOAuthReadiness()
  if (!readiness.ok) return resultRedirect(request, 'not_configured')

  const cookieStore = await cookies()
  const state = query.get('state')
  const code = query.get('code')
  const expectedState = cookieStore.get(MERCADOPAGO_STATE_COOKIE)?.value
  const verifier = cookieStore.get(MERCADOPAGO_VERIFIER_COOKIE)?.value
  if (query.get('error')) return resultRedirect(request, 'denied')
  if (!state || !code || !expectedState || state !== expectedState || !verifier) return resultRedirect(request, 'invalid')

  try {
    const token = await exchangeMercadoPagoAuthorizationCode({ code, verifier, config: readiness.config })
    await saveMercadoPagoConnection(user.id, token, readiness.config.tokenEncryptionKey)
    return resultRedirect(request, 'success')
  } catch {
    return resultRedirect(request, 'provider_error')
  }
}
