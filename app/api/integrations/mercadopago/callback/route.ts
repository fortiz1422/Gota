import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

import {
  exchangeAuthorizationCode,
  getMercadoPagoReadiness,
  isMatchingOAuthState,
  MERCADOPAGO_STATE_COOKIE,
  MERCADOPAGO_VERIFIER_COOKIE,
} from '@/lib/mercadopago-spike/oauth'
import { buildDiagnosticPayload } from '@/lib/mercadopago-spike/diagnostics'
import { runReadOnlyProbes } from '@/lib/mercadopago-spike/probes'

export const dynamic = 'force-dynamic'

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' }

function noStore(response: NextResponse): NextResponse {
  Object.entries(NO_STORE_HEADERS).forEach(([name, value]) => response.headers.set(name, value))
  return response
}

function safeFailure(status: number, error: string): NextResponse {
  return noStore(NextResponse.json({ error }, { status, headers: NO_STORE_HEADERS }))
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

function diagnosticResponse(probes: Awaited<ReturnType<typeof runReadOnlyProbes>>): NextResponse {
  return noStore(NextResponse.json(buildDiagnosticPayload(probes), { status: 200, headers: NO_STORE_HEADERS }))
}

export async function GET(request: Request) {
  let response: NextResponse
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return clearOAuthCookies(safeFailure(401, 'unauthorized'))

    const readiness = getMercadoPagoReadiness()
    if (!readiness.ok) return clearOAuthCookies(safeFailure(501, 'mercadopago_oauth_not_ready'))

    const params = new URL(request.url).searchParams
    if (params.get('error')) return clearOAuthCookies(safeFailure(400, 'oauth_denied'))

    const code = params.get('code')
    const receivedState = params.get('state')
    const expectedState = requestCookie(request, MERCADOPAGO_STATE_COOKIE)
    const verifier = requestCookie(request, MERCADOPAGO_VERIFIER_COOKIE)
    if (!code || !receivedState || !verifier) return clearOAuthCookies(safeFailure(400, 'invalid_oauth_callback'))
    if (!isMatchingOAuthState(expectedState, receivedState)) return clearOAuthCookies(safeFailure(400, 'invalid_oauth_state'))

    const accessToken = await exchangeAuthorizationCode({
      code,
      verifier,
      config: readiness.config,
    })
    const probes = await runReadOnlyProbes({ accessToken })
    response = diagnosticResponse(probes)
  } catch {
    response = safeFailure(502, 'mercadopago_oauth_failed')
  }

  return clearOAuthCookies(response)
}

export { diagnosticResponse }
