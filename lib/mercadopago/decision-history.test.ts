import { describe, expect, it, vi, beforeEach } from 'vitest'
import fixture from './fixtures/personal-history.sanitized.json'
import { normalizeMercadoPagoMovement } from './provider-movement'
import { reconcileMercadoPagoMovements } from './reconciliation'
import { previousDecisionFor, readMercadoPagoDecisionHistory, type PreviousProviderDecision } from './decision-history'

const mocks = vi.hoisted(() => ({ from: vi.fn(), range: vi.fn(), eq: vi.fn() }))
vi.mock('./sync-lease', () => ({ backgroundDatabase: () => ({ from: mocks.from }) }))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.eq.mockReturnThis()
  mocks.from.mockReturnValue({ select: () => ({ eq: mocks.eq, order: () => ({ range: mocks.range }) }) })
  mocks.range.mockResolvedValue({ data: [], error: null })
})

const observations = fixture.observations.map(o => {
  const source = o.source as 'payments_search' | 'account_settlement_report'
  const movement = normalizeMercadoPagoMovement({ source, nativeKey: o.nativeKey, payload: o.payload, providerUserId: o.providerUserId })
  return { source, nativeKey: o.nativeKey, nativeId: movement.nativeId, movement, lastSeenAt: '2026-09-01T12:00:01Z' }
})
const matched = reconcileMercadoPagoMovements(observations).find(c => c.match === 'exact_native_id')!
const paymentOnly = reconcileMercadoPagoMovements(matched.evidence.filter(e => e.source === 'payments_search'))[0]
const history = (status: PreviousProviderDecision['status']): PreviousProviderDecision[] => [{
  candidate_id: paymentOnly.candidateId, status,
  evidence: { observations: paymentOnly.evidence.map(e => ({ source: e.source, native_key: e.nativeKey })) },
}]

describe('decision history across source reconciliation', () => {
  it.each(['confirmed', 'dismissed'] as const)('preserves %s when Settlement changes candidate identity', status => {
    expect(matched.candidateId).not.toBe(paymentOnly.candidateId)
    expect(previousDecisionFor(matched, history(status))).toBe(status)
  })
  it('does not match an unrelated native key or a synthetic identity', () => {
    expect(previousDecisionFor(matched, [{ candidate_id: 'other', status: 'confirmed', evidence: { observations: [{ native_key: 'different' }] } }])).toBeNull()
    const synthetic = { ...matched, candidateId: 'other', evidence: matched.evidence.map(e => ({ ...e, nativeKey: 'sha256:synthetic', nativeId: 'sha256:synthetic' })) }
    expect(previousDecisionFor(synthetic, [{ candidate_id: 'older', status: 'confirmed', evidence: { observations: [{ native_key: 'sha256:synthetic' }] } }])).toBeNull()
    expect(previousDecisionFor(matched, [{ candidate_id: matched.candidateId, status: 'dismissed', evidence: null }])).toBe('dismissed')
  })
  it('reads both owned tables and continues after a full page', async () => {
    mocks.range.mockResolvedValueOnce({ data: Array.from({ length: 100 }, () => history('confirmed')[0]), error: null })
      .mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ data: history('dismissed'), error: null })
    expect(await readMercadoPagoDecisionHistory('u', 'c')).toHaveLength(101)
    expect(mocks.from.mock.calls.map(c => c[0])).toEqual(['mercadopago_movement_reviews', 'mercadopago_movement_reviews', 'mercadopago_movement_dismissals'])
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'u')
    expect(mocks.eq).toHaveBeenCalledWith('connection_id', 'c')
    expect(mocks.range).toHaveBeenCalledWith(100, 199)
  })
  it('fails closed when decision history cannot be read', async () => {
    mocks.range.mockResolvedValue({ data: null, error: { code: 'failure' } })
    await expect(readMercadoPagoDecisionHistory('u', 'c')).rejects.toThrow('decision_history_read_failed')
  })
})
