import { describe, expect, it, vi } from 'vitest'
import { runSettlementProbe, type SettlementProbeConnection } from './settlement-probe'

const WINDOW = { begin_date: '2026-09-15T03:00:00Z', end_date: '2026-09-16T02:59:59Z' }
const connection = (overrides: Partial<SettlementProbeConnection> = {}): SettlementProbeConnection => ({
  access_token_ciphertext: 'ciphertext',
  ...overrides,
})
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

function fetchSequence(sequence: Array<[unknown, number?]>) {
  const fetchImpl = vi.fn(async () => {
    const next = sequence.shift()
    if (!next) throw new Error('unexpected provider call')
    return response(next[0], next[1])
  })
  return fetchImpl
}

describe('temporary Mercado Pago settlement probe', () => {
  it('fails closed for zero or ambiguous encrypted connections', async () => {
    for (const connections of [[], [connection(), connection()]]) {
      const fetchImpl = vi.fn()
      const result = await runSettlementProbe({ connections, decrypt: vi.fn(), fetchImpl })
      expect(result).toEqual({ stage: 'connection', httpStatus: null, accepted: false, classification: 'unclassified_provider_error' })
      expect(fetchImpl).not.toHaveBeenCalled()
    }
  })

  it('lists first and does not POST when the exact fixed-window report exists', async () => {
    const fetchImpl = fetchSequence([[[{ begin_date: WINDOW.begin_date, end_date: WINDOW.end_date, status: 'ready', file_name: 'private.csv' }]]])
    const result = await runSettlementProbe({ connections: [connection()], decrypt: vi.fn(() => 'access-token'), fetchImpl })
    expect(result).toEqual({ stage: 'list', httpStatus: 200, accepted: false, classification: 'none', reportStatus: 'ready', hasFile: true })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const calls = fetchImpl.mock.calls as unknown as Array<[string, RequestInit | undefined]>
    expect(calls[0][0]).toBe('https://api.mercadopago.com/v1/account/settlement_report/list')
  })

  it('uses the literal fixed payload and accepts HTTP 202 exactly once', async () => {
    const fetchImpl = fetchSequence([
      [[{ begin_date: 'other', end_date: 'other' }]],
      [{ accepted: true }, 202],
    ])
    const result = await runSettlementProbe({ connections: [connection()], decrypt: vi.fn(() => 'access-token'), fetchImpl })
    expect(result).toEqual({ stage: 'create', httpStatus: 202, accepted: true, classification: 'none' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const calls = fetchImpl.mock.calls as unknown as Array<[string, RequestInit | undefined]>
    const init = calls[1][1] as RequestInit
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual(WINDOW)
    expect(calls.filter(([, request]) => request?.method === 'POST')).toHaveLength(1)
  })

  it('classifies a generic hostile 400 without returning provider text, cause, token, body or IDs', async () => {
    const hostile = { message: 'provider exploded; token=secret-token', cause: 'internal user-id=abc', body: { id: 'provider-id', token: 'secret-token' } }
    const fetchImpl = fetchSequence([[[{ begin_date: 'other', end_date: 'other' }]], [hostile, 400]])
    const result = await runSettlementProbe({ connections: [connection()], decrypt: vi.fn(() => 'secret-token'), fetchImpl })
    expect(result).toEqual({ stage: 'create', httpStatus: 400, accepted: false, classification: 'unclassified_provider_error' })
    expect(JSON.stringify(result)).not.toContain('secret-token')
    expect(JSON.stringify(result)).not.toContain('internal')
    expect(JSON.stringify(result)).not.toContain('provider-id')
  })

  it('maps hostile provider text to the closed classification only', async () => {
    const fetchImpl = fetchSequence([[[{ begin_date: 'other', end_date: 'other' }]], [{ message: 'the begin_date is invalid' }, 400]])
    const result = await runSettlementProbe({ connections: [connection()], decrypt: vi.fn(() => 'access-token'), fetchImpl })
    expect(result).toEqual({ stage: 'create', httpStatus: 400, accepted: false, classification: 'invalid_begin_date' })
  })

  it('classifies non-JSON or empty provider errors without reading them into the response', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 400 }))
    const result = await runSettlementProbe({ connections: [connection()], decrypt: vi.fn(() => 'access-token'), fetchImpl })
    expect(result).toEqual({ stage: 'list', httpStatus: 400, accepted: false, classification: 'non_json_or_empty' })
  })
})
