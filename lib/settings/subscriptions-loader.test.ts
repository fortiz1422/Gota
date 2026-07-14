import { describe, expect, it, vi } from 'vitest'
import { loadSubscriptionsData } from './subscriptions-loader'

const urls = ['/api/subscriptions', '/api/cards', '/api/accounts'] as const

describe('loadSubscriptionsData', () => {
  it('loads subscriptions, cards and accounts together', async () => {
    const payloads: Record<string, unknown> = {
      '/api/subscriptions': [{ id: 'subscription-1' }],
      '/api/cards': [{ id: 'card-1' }],
      '/api/accounts': [{ id: 'account-1' }],
    }
    const request = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => payloads[url],
    }))

    await expect(loadSubscriptionsData(request)).resolves.toEqual({
      subscriptions: [{ id: 'subscription-1' }],
      cards: [{ id: 'card-1' }],
      accounts: [{ id: 'account-1' }],
    })
    expect(request.mock.calls.map(([url]) => url)).toEqual(urls)
  })

  it.each(urls)('rejects when %s responds with an error', async (failedUrl) => {
    const request = vi.fn(async (url: string) => ({
      ok: url !== failedUrl,
      json: async () => [],
    }))

    await expect(loadSubscriptionsData(request)).rejects.toThrow(
      'No pudimos cargar las suscripciones.'
    )
  })
})
