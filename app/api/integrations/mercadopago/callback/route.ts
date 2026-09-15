import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

import {
  exchangeAuthorizationCode,
  getMercadoPagoReadiness,
  isMatchingOAuthState,
  MERCADOPAGO_STATE_COOKIE,
  MERCADOPAGO_VERIFIER_COOKIE,
} from '@/lib/mercadopago-spike/oauth'
import { runReadOnlyProbes } from '@/lib/mercadopago-spike/probes'
import { mapMercadoPagoResult, type MercadoPagoResultStatus } from '@/lib/mercadopago-spike/result'

export const dynamic = 'force-dynamic'

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' }

function noStore(response: NextResponse): NextResponse {
  Object.entries(NO_STORE_HEADERS).forEach(([name, value]) => response.headers.set(name, value))
  return response
}

function resultRedirect(request: Request, status: MercadoPagoResultStatus): NextResponse {
  const url = new URL('/integrations/mercadopago/result', request.url)
  url.searchParams.set('status', status)
  return noStore(NextResponse.redirect(url, 307))
}

function clearOAuthCookies(response: NextResponse): NextResponse {
  response.cookies.delete(MERCADOPAGO_STATE_COOKIE)
  response.cookies.delete(MERCADOPAGO_VERIFIER_COOKIE)
  return response
}

function requestCookie(request: Request, name: string): string | null {
  const value = request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))
  return value ? decodeURIComponent(value.slice(name.length + 1)) : null
}

export async function GET(request: Request) {
  let response: NextResponse
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return clearOAuthCookies(resultRedirect(request, 'invalid'))

    const readiness = getMercadoPagoReadiness()
    if (!readiness.ok) return clearOAuthCookies(resultRedirect(request, 'not_configured'))

    const params = new URL(request.url).searchParams
    if (params.get('error')) return clearOAuthCookies(resultRedirect(request, 'denied'))

    const code = params.get('code')
    const receivedState = params.get('state')
    const expectedState = requestCookie(request, MERCADOPAGO_STATE_COOKIE)
    const verifier = requestCookie(request, MERCADOPAGO_VERIFIER_COOKIE)
    if (!code || !receivedState || !verifier) return clearOAuthCookies(resultRedirect(request, 'invalid'))
    if (!isMatchingOAuthState(expectedState, receivedState)) return clearOAuthCookies(resultRedirect(request, 'invalid'))

    const accessToken = await exchangeAuthorizationCode({
      code,
      verifier,
      config: readiness.config,
    })
    const probes = await runReadOnlyProbes({ accessToken })
    const result = mapMercadoPagoResult(probes)
    response = resultRedirect(request, result.status)
  } catch {
    response = resultRedirect(request, 'provider_error')
  }

  return clearOAuthCookies(response)
}
