import { createHash, randomBytes } from 'node:crypto'

export const MERCADOPAGO_OAUTH_AUTHORIZE_URL = 'https://auth.mercadopago.com/authorization'
export const MERCADOPAGO_OAUTH_TOKEN_URL = 'https://api.mercadopago.com/oauth/token'
export const MERCADOPAGO_STATE_COOKIE = 'mp_oauth_state'
export const MERCADOPAGO_VERIFIER_COOKIE = 'mp_oauth_verifier'
export type OAuthConfig = { clientId: string; clientSecret: string; redirectUri: string; scope: string; tokenEncryptionKey: string }
export type TokenPayload = { accessToken: string; refreshToken: string | null; userId: string | null; expiresAt: string | null }

const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

export function getMercadoPagoOAuthReadiness(env: Record<string, string | undefined> = process.env) {
  const key = text(env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY)
  const hasValidKey = Boolean(key && Buffer.from(key, 'base64').byteLength === 32)
  const missing = ['MERCADOPAGO_CLIENT_ID', 'MERCADOPAGO_CLIENT_SECRET', 'MERCADOPAGO_REDIRECT_URI', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((keyName) => !text(env[keyName]))
  if (!hasValidKey) missing.push('MERCADOPAGO_TOKEN_ENCRYPTION_KEY')
  if (missing.length) return { ok: false as const, missing }
  return { ok: true as const, config: { clientId: text(env.MERCADOPAGO_CLIENT_ID)!, clientSecret: text(env.MERCADOPAGO_CLIENT_SECRET)!, redirectUri: text(env.MERCADOPAGO_REDIRECT_URI)!, scope: text(env.MERCADOPAGO_OAUTH_SCOPE) ?? 'offline_access read', tokenEncryptionKey: text(env.MERCADOPAGO_TOKEN_ENCRYPTION_KEY)! } }
}

export function generatePkcePair() {
  const state = randomBytes(24).toString('hex')
  const verifier = randomBytes(32).toString('base64url')
  return { state, verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}

export function buildMercadoPagoAuthorizeUrl({ config, state, challenge }: { config: OAuthConfig; state: string; challenge: string }) {
  const url = new URL(MERCADOPAGO_OAUTH_AUTHORIZE_URL)
  url.search = new URLSearchParams({ client_id: config.clientId, response_type: 'code', platform_id: 'mp', redirect_uri: config.redirectUri, state, scope: config.scope, code_challenge: challenge, code_challenge_method: 'S256' }).toString()
  return url.toString()
}

export function resolveMercadoPagoTokenExpiresAt({ expiresInSeconds, now = new Date() }: { expiresInSeconds: number | null; now?: Date }) {
  return typeof expiresInSeconds === 'number' && Number.isFinite(expiresInSeconds) ? new Date(now.getTime() + expiresInSeconds * 1000).toISOString() : null
}

export function parseMercadoPagoTokenPayload(payload: unknown, now = new Date()): TokenPayload {
  if (!record(payload) || !text(payload.access_token)) throw new Error('Mercado Pago OAuth response is invalid')
  const expires = typeof payload.expires_in === 'number' ? payload.expires_in : typeof payload.expires_in === 'string' ? Number(payload.expires_in) : null
  return { accessToken: text(payload.access_token)!, refreshToken: text(payload.refresh_token), userId: typeof payload.user_id === 'number' ? String(payload.user_id) : text(payload.user_id), expiresAt: resolveMercadoPagoTokenExpiresAt({ expiresInSeconds: Number.isFinite(expires) ? expires : null, now }) }
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>
async function exchange(body: URLSearchParams, fetchImpl: FetchLike = fetch): Promise<TokenPayload> {
  const response = await fetchImpl(MERCADOPAGO_OAUTH_TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error('Mercado Pago OAuth exchange failed')
  return parseMercadoPagoTokenPayload(payload)
}
export function exchangeMercadoPagoAuthorizationCode({ code, config, verifier, fetchImpl }: { code: string; config: OAuthConfig; verifier: string; fetchImpl?: FetchLike }) {
  return exchange(new URLSearchParams({ grant_type: 'authorization_code', client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: config.redirectUri, code_verifier: verifier }), fetchImpl)
}
export function exchangeMercadoPagoRefreshToken({ refreshToken, config, fetchImpl }: { refreshToken: string; config: OAuthConfig; fetchImpl?: FetchLike }) {
  return exchange(new URLSearchParams({ grant_type: 'refresh_token', client_id: config.clientId, client_secret: config.clientSecret, refresh_token: refreshToken }), fetchImpl)
}
