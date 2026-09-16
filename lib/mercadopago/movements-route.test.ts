import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), getConnection: vi.fn(), getObservations: vi.fn(), normalize: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('@/lib/mercadopago/server-repository', () => ({ getMercadoPagoConnection: mocks.getConnection, getMercadoPagoMovementObservations: mocks.getObservations }))
vi.mock('@/lib/mercadopago/provider-movement', () => ({ normalizeMercadoPagoMovement: mocks.normalize }))

import { GET } from '@/app/api/integrations/mercadopago/movements/route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) } })
  mocks.getConnection.mockResolvedValue({ id: 'connection-1', provider_user_id: 'provider-1' })
  mocks.getObservations.mockResolvedValue([{ source: 'payments_search', native_key: '101', payload: { id: 101 }, last_seen_at: '2026-09-15T12:00:00.000Z' }])
  mocks.normalize.mockReturnValue({ nativeId: '101', description: 'Compra sintética', amount: { value: 5, currency: 'ARS' }, kind: 'expense', direction: 'outflow', confidence: 'confirmed' })
})

describe('Mercado Pago movements route', () => {
  it('returns 401 before repository calls when unauthenticated', async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } })
    const response = await GET()
    expect(response.status).toBe(401)
    expect(mocks.getConnection).not.toHaveBeenCalled()
    expect(mocks.getObservations).not.toHaveBeenCalled()
  })

  it('sorts normalized rows by occurredAt descending and native id deterministically', async () => {
    mocks.getObservations.mockResolvedValue([
      { source: 'payments_search', native_key: 'a', payload: { id: 'a' }, last_seen_at: '2026-09-15T12:00:00.000Z' },
      { source: 'payments_search', native_key: 'd', payload: { id: 'd' }, last_seen_at: '2026-09-15T12:00:00.000Z' },
      { source: 'payments_search', native_key: 'b', payload: { id: 'b' }, last_seen_at: '2026-09-15T12:00:00.000Z' },
      { source: 'payments_search', native_key: 'c', payload: { id: 'c' }, last_seen_at: '2026-09-15T12:00:00.000Z' },
    ])
    mocks.normalize.mockImplementation(({ nativeKey }: { nativeKey: string }) => ({ nativeId: nativeKey, occurredAt: nativeKey === 'c' ? '2026-09-16T00:00:00.000Z' : nativeKey === 'd' ? 'not-a-date' : '2026-09-15T00:00:00.000Z', kind: 'expense', confidence: 'confirmed' }))

    const body = await (await GET()).json()

    expect(body.movements.map((movement: { nativeId: string }) => movement.nativeId)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('returns normalized rows and aggregate counts without provider identity or raw payload', async () => {
    const response = await GET()
    const body = await response.json()
    expect(Array.isArray(body.movements)).toBe(true)
    expect(Object.keys(body)).toEqual(['aggregates', 'movements'])
    expect(body).toEqual({ aggregates: { total: 1, observations: 1, crossSourceMatches: 0, paymentOnly: 1, balanceOnly: 0, expense: 1, income: 0, transfer: 0, neutral: 0, unknown: 0, partial: 0, confirmed: 1 }, movements: [expect.objectContaining({ nativeId: '101', sources: ['payments_search'], match: 'single_source', balanceImpact: { observed: false, effect: 'unknown', amount: { value: null, currency: null } } })] })
    expect(JSON.stringify(body)).not.toMatch(/payload|provider_user_id|payer|collector|token|authorization/i)
    expect(mocks.getObservations).toHaveBeenCalledWith('user-1', 'connection-1', 100)
    expect(mocks.normalize).toHaveBeenCalledWith(expect.objectContaining({ providerUserId: 'provider-1', nativeKey: '101' }))
  })
})
