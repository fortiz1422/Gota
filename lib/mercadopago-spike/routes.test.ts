import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  getMercadoPagoReadiness: vi.fn(),
  generatePkcePair: vi.fn(),
  buildMercadoPagoAuthorizeUrl: vi.fn(),
  isMatchingOAuthState: vi.fn(),
  exchangeAuthorizationCode: vi.fn(),
  runReadOnlyProbes: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/mercadopago-spike/oauth', () => ({
  MERCADOPAGO_STATE_COOKIE: 'mp_personal_oauth_state',
  MERCADOPAGO_VERIFIER_COOKIE: 'mp_personal_oauth_verifier',
  getMercadoPagoReadiness: mocks.getMercadoPagoReadiness,
  generatePkcePair: mocks.generatePkcePair,
  buildMercadoPagoAuthorizeUrl: mocks.buildMercadoPagoAuthorizeUrl,
  isMatchingOAuthState: mocks.isMatchingOAuthState,
  exchangeAuthorizationCode: mocks.exchangeAuthorizationCode,
}))
vi.mock('@/lib/mercadopago-spike/probes', () => ({ runReadOnlyProbes: mocks.runReadOnlyProbes }))

import { GET as callbackGet } from '@/app/api/integrations/mercadopago/callback/route'
import { GET as connectGet } from '@/app/api/integrations/mercadopago/connect/route'

const supabase = { auth: { getUser: mocks.getUser } }
const readyConfig = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'https://gota-arg.vercel.app/api/integrations/mercadopago/callback',
}

function callbackRequest(query = '', cookies = ''): Request {
  return new Request(`https://gota-arg.vercel.app/api/integrations/mercadopago/callback${query}`, {
    headers: cookies ? { cookie: cookies } : undefined,
  })
}

function expectNoStore(response: Response) {
  expect(response.headers.get('cache-control')).toBe('no-store, max-age=0')
  expect(response.headers.get('pragma')).toBe('no-cache')
}

function expectOAuthCookiesCleared(response: Response) {
  const cookies = response.headers.getSetCookie()
  expect(cookies).toHaveLength(2)
  expect(cookies).toEqual(expect.arrayContaining([
    expect.stringContaining('mp_personal_oauth_state='),
    expect.stringContaining('mp_personal_oauth_verifier='),
  ]))
  expect(cookies.every((cookie) => cookie.includes('Expires=Thu, 01 Jan 1970 00:00:00 GMT'))).toBe(true)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createClient.mockResolvedValue(supabase)
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-private' } } })
  mocks.getMercadoPagoReadiness.mockReturnValue({ ok: true, config: readyConfig })
  mocks.generatePkcePair.mockReturnValue({ state: 'state-value', verifier: 'verifier-value', challenge: 'challenge-value' })
  mocks.buildMercadoPagoAuthorizeUrl.mockReturnValue('https://auth.mercadopago.com/authorization?state=state-value')
  mocks.isMatchingOAuthState.mockReturnValue(true)
  mocks.exchangeAuthorizationCode.mockResolvedValue('access-token-never-returned')
  mocks.runReadOnlyProbes.mockResolvedValue([{
    name: 'user',
    method: 'GET',
    path: '/users/me',
    diagnostic: { status: 200, ok: true, payloadType: 'object', count: null, fields: ['id'], error: null },
  }, {
    name: 'settlement_reports',
    method: 'GET',
    path: '/v1/account/settlement_report/list',
    diagnostic: { status: 200, ok: true, payloadType: 'object', count: 0, fields: [], error: null },
  }, {
    name: 'payments',
    method: 'GET',
    path: '/v1/payments/search',
    diagnostic: { status: 200, ok: true, payloadType: 'object', count: 0, fields: [], error: null },
  }])
})

describe('Mercado Pago OAuth spike routes', () => {
  it('connect sets short-lived secure PKCE cookies and no-store before redirecting', async () => {
    const response = await connectGet()

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://auth.mercadopago.com/authorization?state=state-value')
    expectNoStore(response)
    const cookies = response.headers.getSetCookie()
    expect(cookies).toEqual(expect.arrayContaining([
      expect.stringContaining('mp_personal_oauth_state=state-value'),
      expect.stringContaining('mp_personal_oauth_verifier=verifier-value'),
    ]))
    expect(cookies.every((cookie) => cookie.includes('Path=/') && cookie.includes('Max-Age=600') && cookie.includes('Secure') && cookie.includes('HttpOnly') && cookie.includes('SameSite=lax'))).toBe(true)
  })

  it.each([
    ['unauthorized', () => mocks.getUser.mockResolvedValue({ data: { user: null } }), '', ''],
    ['missing configuration', () => mocks.getMercadoPagoReadiness.mockReturnValue({ ok: false, missing: ['MERCADOPAGO_CLIENT_ID'] }), '', ''],
    ['provider denial', () => undefined, '?error=access_denied', ''],
    ['missing callback data', () => undefined, '?state=state', 'mp_personal_oauth_state=state; mp_personal_oauth_verifier=verifier'],
    ['state mismatch', () => mocks.isMatchingOAuthState.mockReturnValue(false), '?code=code&state=wrong', 'mp_personal_oauth_state=state; mp_personal_oauth_verifier=verifier'],
    ['exchange failure', () => mocks.exchangeAuthorizationCode.mockRejectedValue(new Error('client_secret=never-return')), '?code=code&state=state', 'mp_personal_oauth_state=state; mp_personal_oauth_verifier=verifier'],
  ])('clears both OAuth cookies and disables caching on callback %s', async (_name, arrange, query, cookies) => {
    arrange()

    const response = await callbackGet(callbackRequest(query, cookies))

    expectNoStore(response)
    expectOAuthCookiesCleared(response)
    expect(response.headers.get('location')).toMatch(/status=(invalid|not_configured|denied|provider_error)/)
    expect(await response.text()).not.toContain('never-return')
  })

  it('clears both cookies on success and redirects with bounded diagnostics', async () => {
    const response = await callbackGet(callbackRequest(
      '?code=authorization-code&state=state',
      'mp_personal_oauth_state=state; mp_personal_oauth_verifier=verifier',
    ))

    expect(response.status).toBe(307)
    expectNoStore(response)
    expectOAuthCookiesCleared(response)
    expect(mocks.exchangeAuthorizationCode).toHaveBeenCalledWith({
      code: 'authorization-code',
      verifier: 'verifier',
      config: readyConfig,
    })
    expect(mocks.runReadOnlyProbes).toHaveBeenCalledWith({ accessToken: 'access-token-never-returned' })
    expect(response.headers.get('location')).toBe(
      'https://gota-arg.vercel.app/integrations/mercadopago/result?status=success&identity=verified&reports=0&payments=0',
    )
    expect(response.headers.get('location')).not.toContain('access-token-never-returned')
    expect(response.headers.get('location')).not.toContain('authorization-code')
  })

  it.each([
    ['provider denial', '?error=access_denied', '', 'denied'],
    ['invalid callback', '?code=code', 'mp_personal_oauth_state=state; mp_personal_oauth_verifier=verifier', 'invalid'],
  ])('redirects %s to a human-safe result state', async (_name, query, cookies, status) => {
    const response = await callbackGet(callbackRequest(query, cookies))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      `https://gota-arg.vercel.app/integrations/mercadopago/result?status=${status}`,
    )
    expect(JSON.stringify(await response.text())).not.toContain('access_denied')
  })
})
