import { afterEach, describe, expect, it, vi } from 'vitest'
import { exchangeMercadoPagoAuthorizationCode, exchangeMercadoPagoRefreshToken, type OAuthConfig } from './oauth'
const config: OAuthConfig = { clientId: 'fixture', clientSecret: 'fixture', redirectUri: 'https://gota.test/callback', scope: 'read', tokenEncryptionKey: 'fixture' }
afterEach(() => vi.restoreAllMocks())
describe('bounded OAuth exchange', () => {
  it.each(['refresh', 'authorization'])('aborts a stalled %s exchange on its deadline without retrying', async grant => {
    const controller = new AbortController()
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal)
    const fetcher = vi.fn(async (_input, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      if (!init?.signal) throw new Error('missing exchange deadline')
      init.signal.addEventListener('abort', () => reject(init.signal!.reason), { once: true })
    }))
    const pending = grant === 'refresh'
      ? exchangeMercadoPagoRefreshToken({ refreshToken: 'fixture', config, fetchImpl: fetcher })
      : exchangeMercadoPagoAuthorizationCode({ code: 'fixture', verifier: 'fixture', config, fetchImpl: fetcher })
    controller.abort(new DOMException('Timed out', 'TimeoutError'))
    await expect(pending).rejects.toMatchObject({ name: 'TimeoutError' })
    expect(timeout).toHaveBeenCalledWith(8000)
    expect(fetcher).toHaveBeenCalledOnce()
  })
  it('clips a refresh that is close to the capture deadline', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(new AbortController().signal)
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ access_token: 'fixture-access', expires_in: 3600 })))
    await exchangeMercadoPagoRefreshToken({ refreshToken: 'fixture', config, fetchImpl: fetcher, timeoutMs: 2_500 })
    expect(timeout).toHaveBeenCalledWith(2_500)
    expect(timeout.mock.calls[0]?.[0]).toBeLessThan(8_000)
  })
  it('does not expose the provider error payload', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ message: 'fixture-private-provider-detail' }), { status: 400 }))
    await expect(exchangeMercadoPagoRefreshToken({ refreshToken: 'fixture', config, fetchImpl: fetcher })).rejects.toThrow('Mercado Pago OAuth exchange failed')
    expect(fetcher).toHaveBeenCalledOnce()
  })
})
