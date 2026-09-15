import { createHash, randomBytes } from 'node:crypto'

export const MERCADOPAGO_AUTHORIZE_URL = 'https://auth.mercadopago.com/authorization'
export const MERCADOPAGO_TOKEN_URL = 'https://api.mercadopago.com/oauth/token'
export const MERCADOPAGO_STATE_COOKIE = 'mp_personal_oauth_state'
export const MERCADOPAGO_VERIFIER_COOKIE = 'mp_personal_oauth_verifier'
export const MERCADOPAGO_OAUTH_COOKIE_NAMES = [MERCADOPAGO_STATE_COOKIE, MERCADOPAGO_VERIFIER_COOKIE] as const
export const MERCADOPAGO_SCOPE = 'read offline_access'

export type MercadoPagoReadiness =
  | { ok: true; config: { clientId: string; clientSecret: string; redirectUri: string } }
  | { ok: false; missing: string[] }

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

function nonEmpty(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function getMercadoPagoReadiness(
  env: Record<string, string | undefined> = process.env,
): MercadoPagoReadiness {
  const clientId = nonEmpty(env.MERCADOPAGO_CLIENT_ID)
  const clientSecret = nonEmpty(env.MERCADOPAGO_CLIENT_SECRET)
  const redirectUri = nonEmpty(env.MERCADOPAGO_REDIRECT_URI)
  const missing = [
    !clientId ? 'MERCADOPAGO_CLIENT_ID' : null,
    !clientSecret ? 'MERCADOPAGO_CLIENT_SECRET' : null,
    !redirectUri ? 'MERCADOPAGO_REDIRECT_URI' : null,
  ].filter((value): value is string => value !== null)

  if (missing.length > 0) return { ok: false, missing }
  return { ok: true, config: { clientId: clientId!, clientSecret: clientSecret!, redirectUri: redirectUri! } }
}

export type PkcePair = { state: string; verifier: string; challenge: string }

type RandomBytes = (size: number) => Uint8Array

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

export function generatePkcePair(random: RandomBytes = (size) => randomBytes(size)): PkcePair {
  const state = Buffer.from(random(32)).toString('hex')
  const verifier = base64Url(random(48))
  const challenge = base64Url(createHash('sha256').update(verifier).digest())
  return { state, verifier, challenge }
}

export function buildMercadoPagoAuthorizeUrl(params: {
  clientId: string
  redirectUri: string
  state: string
  challenge: string
}): string {
  const url = new URL(MERCADOPAGO_AUTHORIZE_URL)
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('platform_id', 'mp')
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('state', params.state)
  url.searchParams.set('scope', MERCADOPAGO_SCOPE)
  url.searchParams.set('code_challenge', params.challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

export function isMatchingOAuthState(expected: string | null, received: string | null): boolean {
  return Boolean(expected && received && expected === received)
}

export async function exchangeAuthorizationCode(params: {
  code: string
  verifier: string
  config: { clientId: string; clientSecret: string; redirectUri: string }
  fetchImpl?: FetchLike
}): Promise<string> {
  const fetchImpl = params.fetchImpl ?? fetch
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: params.config.clientId,
    client_secret: params.config.clientSecret,
    code: params.code,
    redirect_uri: params.config.redirectUri,
    code_verifier: params.verifier,
  })
  const response = await fetchImpl(MERCADOPAGO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const payload = await response.json().catch(() => null) as unknown
  if (!response.ok) throw new Error(`token_exchange_http_${response.status}`)
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || typeof (payload as { access_token?: unknown }).access_token !== 'string') {
    throw new Error('token_exchange_invalid_response')
  }
  return (payload as { access_token: string }).access_token
}
