import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  cookies: vi.fn(),
  getMercadoPagoOAuthReadiness: vi.fn(),
  generatePkcePair: vi.fn(),
  buildMercadoPagoAuthorizeUrl: vi.fn(),
  exchangeMercadoPagoAuthorizationCode: vi.fn(),
  saveMercadoPagoConnection: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('next/headers', () => ({ cookies: mocks.cookies }))
vi.mock('@/lib/mercadopago/oauth', () => ({
  MERCADOPAGO_STATE_COOKIE: 'mp_oauth_state',
  MERCADOPAGO_VERIFIER_COOKIE: 'mp_oauth_verifier',
  getMercadoPagoOAuthReadiness: mocks.getMercadoPagoOAuthReadiness,
  generatePkcePair: mocks.generatePkcePair,
  buildMercadoPagoAuthorizeUrl: mocks.buildMercadoPagoAuthorizeUrl,
  exchangeMercadoPagoAuthorizationCode: mocks.exchangeMercadoPagoAuthorizationCode,
}))
vi.mock('@/lib/mercadopago/server-repository', () => ({ saveMercadoPagoConnection: mocks.saveMercadoPagoConnection }))

import { GET as callbackGet } from '@/app/api/integrations/mercadopago/callback/route'
import { GET as connectGet } from '@/app/api/integrations/mercadopago/connect/route'

const readyConfig = { clientId: 'client-id', clientSecret: 'client-secret', redirectUri: 'https://gota-arg.vercel.app/api/integrations/mercadopago/callback', scope: 'offline_access read', tokenEncryptionKey: 'key' }
const callbackRequest = (query = '') => new Request(`https://gota-arg.vercel.app/api/integrations/mercadopago/callback${query}`)
const cleared = (response: Response) => {
  const values = response.headers.getSetCookie()
  expect(values).toHaveLength(2)
  expect(values).toEqual(expect.arrayContaining([expect.stringContaining('mp_oauth_state='), expect.stringContaining('mp_oauth_verifier=')]))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser } })
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'tenant-1' } } })
  mocks.cookies.mockResolvedValue({ get: (name: string) => ({ value: name === 'mp_oauth_state' ? 'state' : 'verifier' }) })
  mocks.getMercadoPagoOAuthReadiness.mockReturnValue({ ok: true, config: readyConfig })
  mocks.generatePkcePair.mockReturnValue({ state: 'state', verifier: 'verifier', challenge: 'challenge' })
  mocks.buildMercadoPagoAuthorizeUrl.mockReturnValue('https://auth.mercadopago.com/authorization?code_challenge_method=S256')
  mocks.exchangeMercadoPagoAuthorizationCode.mockResolvedValue({ accessToken: 'access-secret', refreshToken: 'refresh-secret', userId: 'provider-user', expiresAt: null })
  mocks.saveMercadoPagoConnection.mockResolvedValue('connection-1')
})

describe('Mercado Pago OAuth routes', () => {
  it('connect uses a short-lived secure PKCE cookie pair and an S256 authorization URL', async () => {
    const response = await connectGet()
    expect(response.status).toBe(307)
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0')
    expect(mocks.buildMercadoPagoAuthorizeUrl).toHaveBeenCalledWith({ config: readyConfig, state: 'state', challenge: 'challenge' })
    const values = response.headers.getSetCookie()
    expect(values.every((value) => value.includes('Secure') && value.includes('HttpOnly') && value.includes('SameSite=lax') && value.includes('Max-Age=600'))).toBe(true)
  })

  it.each([
    ['unauthorized', () => mocks.getUser.mockResolvedValue({ data: { user: null } }), '', 401, null],
    ['provider denial', () => undefined, '?error=access_denied', 307, 'denied'],
    ['invalid state', () => mocks.cookies.mockResolvedValue({ get: () => ({ value: 'other' }) }), '?code=code&state=state', 307, 'invalid'],
    ['provider failure', () => mocks.exchangeMercadoPagoAuthorizationCode.mockRejectedValue(new Error('access-secret')), '?code=code&state=state', 307, 'provider_error'],
  ])('always clears both cookies and disables cache on %s', async (_name, arrange, query, status, result) => {
    arrange()
    const response = await callbackGet(callbackRequest(query))
    expect(response.status).toBe(status)
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0')
    cleared(response)
    if (result) expect(response.headers.get('location')).toBe(`https://gota-arg.vercel.app/integrations/mercadopago/result?status=${result}`)
    expect(await response.text()).not.toContain('access-secret')
  })

  it('persists encrypted-token handoff before redirecting success to the closed human result enum', async () => {
    const response = await callbackGet(callbackRequest('?code=code&state=state'))
    expect(mocks.saveMercadoPagoConnection).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ accessToken: 'access-secret' }), 'key')
    expect(response.headers.get('location')).toBe('https://gota-arg.vercel.app/integrations/mercadopago/result?status=success')
    cleared(response)
  })
})
