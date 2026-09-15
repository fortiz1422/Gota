import { describe, expect, it } from 'vitest'
import {
  buildMercadoPagoAuthorizeUrl,
  exchangeAuthorizationCode,
  getMercadoPagoReadiness,
  generatePkcePair,
  isMatchingOAuthState,
} from './oauth'

describe('Mercado Pago personal OAuth spike', () => {
  it('genera state y PKCE S256 sin valores vacíos', async () => {
    const pair = await generatePkcePair((size) => new Uint8Array(size).fill(7))

    expect(pair.state).toHaveLength(64)
    expect(pair.verifier).toHaveLength(64)
    expect(pair.challenge).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(pair.challenge).not.toBe(pair.verifier)
  })

  it('construye URL con scopes read y offline_access y PKCE', () => {
    const url = new URL(buildMercadoPagoAuthorizeUrl({
      clientId: 'client-id',
      redirectUri: 'https://gota-arg.vercel.app/api/integrations/mercadopago/callback',
      state: 'state-value',
      challenge: 'challenge-value',
    }))

    expect(url.origin + url.pathname).toBe('https://auth.mercadopago.com/authorization')
    expect(url.searchParams.get('client_id')).toBe('client-id')
    expect(url.searchParams.get('redirect_uri')).toBe('https://gota-arg.vercel.app/api/integrations/mercadopago/callback')
    expect(url.searchParams.get('scope')).toBe('read offline_access')
    expect(url.searchParams.get('code_challenge')).toBe('challenge-value')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  })

  it('falla cerrado y tipa la configuración faltante', () => {
    expect(getMercadoPagoReadiness({})).toEqual({
      ok: false,
      missing: [
        'MERCADOPAGO_CLIENT_ID',
        'MERCADOPAGO_CLIENT_SECRET',
        'MERCADOPAGO_REDIRECT_URI',
      ],
    })
  })

  it('rechaza mismatch de state', () => {
    expect(isMatchingOAuthState('expected', 'received')).toBe(false)
    expect(isMatchingOAuthState('same', 'same')).toBe(true)
  })

  it('intercambia el code sólo por POST server-side con PKCE', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const accessToken = await exchangeAuthorizationCode({
      code: 'authorization-code',
      verifier: 'pkce-verifier',
      config: { clientId: 'client-id', clientSecret: 'client-secret', redirectUri: 'https://callback.test' },
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init })
        return new Response(JSON.stringify({ access_token: 'token-only-internal' }), { status: 200 })
      },
    })

    expect(accessToken).toBe('token-only-internal')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.mercadopago.com/oauth/token')
    expect(calls[0].init?.method).toBe('POST')
    expect(String(calls[0].init?.body)).toContain('code_verifier=pkce-verifier')
  })
})
