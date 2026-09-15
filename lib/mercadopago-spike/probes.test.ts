import { describe, expect, it } from 'vitest'
import { runReadOnlyProbes } from './probes'

describe('Mercado Pago read-only probes', () => {
  it('usa GET y los contratos exactos de settlement reports y payments', async () => {
    const calls: Array<{ url: string; method: string }> = []
    const probes = await runReadOnlyProbes({
      accessToken: 'token-not-returned',
      now: new Date('2026-09-15T12:00:00Z'),
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), method: init?.method ?? 'GET' })
        return new Response('{}', { status: 200 })
      },
    })

    expect(calls).toHaveLength(3)
    expect(calls.every((call) => call.method === 'GET')).toBe(true)

    const settlementCall = calls.find((call) => call.url.includes('/settlement_report/list'))
    expect(settlementCall?.url).toBe('https://api.mercadopago.com/v1/account/settlement_report/list')

    const paymentCall = calls.find((call) => call.url.includes('/payments/search'))
    expect(paymentCall?.url).toBe(
      'https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&range=date_created&begin_date=2026-09-15T00%3A00%3A00.000Z&end_date=2026-09-15T23%3A59%3A59.999Z&limit=5&offset=0',
    )

    const paymentParams = new URL(paymentCall!.url).searchParams
    expect(Object.fromEntries(paymentParams)).toEqual({
      sort: 'date_created',
      criteria: 'desc',
      range: 'date_created',
      begin_date: '2026-09-15T00:00:00.000Z',
      end_date: '2026-09-15T23:59:59.999Z',
      limit: '5',
      offset: '0',
    })
    expect(paymentParams.has('date_created_from')).toBe(false)
    expect(paymentParams.has('date_created_to')).toBe(false)

    expect(probes.map((probe) => probe.path)).toEqual([
      '/users/me',
      '/v1/account/settlement_report/list',
      '/v1/payments/search?sort=date_created&criteria=desc&range=date_created&begin_date=2026-09-15T00%3A00%3A00.000Z&end_date=2026-09-15T23%3A59%3A59.999Z&limit=5&offset=0',
    ])
    expect(probes.every((probe) => probe.method === 'GET')).toBe(true)
  })
})
