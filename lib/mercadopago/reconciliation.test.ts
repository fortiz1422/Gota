import { describe, expect, it } from 'vitest'
import { reconcileMercadoPagoMovements, type ReconciliationObservation } from './reconciliation'

const payment = (overrides: Partial<ReconciliationObservation['movement']> = {}): ReconciliationObservation => ({
  source: 'payments_search',
  nativeId: overrides.nativeId === undefined ? 'same-id' : overrides.nativeId,
  lastSeenAt: '2026-09-15T12:00:00.000Z',
  movement: { nativeId: 'same-id', source: 'payments_search', occurredAt: '2026-09-15T12:00:00.000Z', kind: 'expense', direction: 'outflow', confidence: 'confirmed', description: 'Compra', amount: { value: 5500, currency: 'ARS' }, ...overrides } as ReconciliationObservation['movement'],
})
const settlement = (overrides: Partial<ReconciliationObservation['movement']> = {}): ReconciliationObservation => ({
  source: 'account_settlement_report',
  nativeId: overrides.nativeId === undefined ? 'same-id' : overrides.nativeId,
  lastSeenAt: '2026-09-15T12:01:00.000Z',
  movement: { nativeId: 'same-id', source: 'account_settlement_report', occurredAt: '2026-09-15T12:01:00.000Z', kind: 'unknown', direction: 'unknown', confidence: 'partial', description: 'Shell', amount: { value: -5500, currency: 'ARS' }, ...overrides } as ReconciliationObservation['movement'],
})

describe('reconcileMercadoPagoMovements', () => {
  it('merges exact native IDs with Payments as primary and separate settlement impact', () => {
    const [candidate] = reconcileMercadoPagoMovements([payment(), settlement()])
    expect(candidate).toMatchObject({ match: 'exact_native_id', sources: ['payments_search', 'account_settlement_report'], nativeId: 'same-id', kind: 'expense', direction: 'outflow', description: 'Compra', balanceImpact: { observed: true, effect: 'debit', amount: { value: -5500, currency: 'ARS' } } })
    expect(candidate.settlement).toMatchObject({ source: 'account_settlement_report', description: 'Shell' })
  })

  it('does not merge different IDs even when date and amount match', () => {
    const candidates = reconcileMercadoPagoMovements([payment(), { ...settlement(), nativeId: 'different-id', movement: { ...settlement().movement, nativeId: 'different-id' } }])
    expect(candidates).toHaveLength(2)
    expect(candidates.every((candidate) => candidate.match === 'single_source')).toBe(true)
  })

  it('does not merge null or unreliable native IDs', () => {
    const candidates = reconcileMercadoPagoMovements([{ ...payment(), nativeId: null, movement: { ...payment().movement, nativeId: null } }, { ...settlement(), nativeId: null, movement: { ...settlement().movement, nativeId: null } }])
    expect(candidates).toHaveLength(2)
    expect(candidates.map((candidate) => candidate.sources).sort((a, b) => a[0].localeCompare(b[0]))).toEqual([['account_settlement_report'], ['payments_search']])
  })

  it('never uses sha256 fallback observation keys to merge sources', () => {
    const fallback = `sha256:${'a'.repeat(64)}`
    const candidates = reconcileMercadoPagoMovements([payment({ nativeId: fallback }), settlement({ nativeId: fallback })])

    expect(candidates).toHaveLength(2)
    expect(candidates.every((candidate) => candidate.match === 'single_source')).toBe(true)
  })

  it('keeps candidate IDs stable when observations are reordered or unrelated observations are added', () => {
    const matched = [payment({ nativeId: 'stable-id' }), settlement({ nativeId: 'stable-id' })]
    const original = reconcileMercadoPagoMovements(matched).find((candidate) => candidate.nativeId === 'stable-id')
    const reordered = reconcileMercadoPagoMovements([...matched].reverse()).find((candidate) => candidate.nativeId === 'stable-id')
    const expanded = reconcileMercadoPagoMovements([...matched, payment({ nativeId: 'unrelated-id' })]).find((candidate) => candidate.nativeId === 'stable-id')

    expect(original?.candidateId).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(original?.candidateId).not.toContain('stable-id')
    expect(reordered?.candidateId).toBe(original?.candidateId)
    expect(expanded?.candidateId).toBe(original?.candidateId)
  })

  it('keeps fallback candidate IDs stable when only lastSeenAt changes', () => {
    const first = { ...payment({ nativeId: null }), lastSeenAt: '2026-09-15T12:00:00.000Z' }
    const refreshed = { ...first, lastSeenAt: '2026-09-16T12:00:00.000Z' }
    const [before] = reconcileMercadoPagoMovements([first])
    const [after] = reconcileMercadoPagoMovements([refreshed])

    expect(after.candidateId).toBe(before.candidateId)
    expect(after.candidateId).toMatch(/^sha256:[a-f0-9]{64}$/)
  })

  it('preserves all same-source conflicting observations as separate evidence', () => {
    const candidates = reconcileMercadoPagoMovements([
      payment({ nativeId: 'same-source', amount: { value: 5500, currency: 'ARS' } }),
      payment({ nativeId: 'same-source', amount: { value: 5600, currency: 'ARS' }, occurredAt: '2026-09-15T12:01:00.000Z' }),
    ])

    expect(candidates).toHaveLength(2)
    expect(candidates.map((candidate) => candidate.candidateId)).toEqual([
      expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    ])
    expect(new Set(candidates.map((candidate) => candidate.candidateId)).size).toBe(2)
  })
  it('does not merge a provider ID when amount or currency evidence is incompatible', () => {
    const amountConflict = reconcileMercadoPagoMovements([payment({ nativeId: 'collision', amount: { value: 5500, currency: 'ARS' } }), settlement({ nativeId: 'collision', amount: { value: -4500, currency: 'ARS' } })])
    const currencyConflict = reconcileMercadoPagoMovements([payment({ nativeId: 'currency-collision', amount: { value: 5500, currency: 'ARS' } }), settlement({ nativeId: 'currency-collision', amount: { value: -5500, currency: 'USD' } })])

    for (const candidates of [amountConflict, currencyConflict]) {
      expect(candidates).toHaveLength(2)
      expect(candidates.every((candidate) => candidate.match === 'single_source')).toBe(true)
    }
  })

  it('keeps settlement-only PAYOUTS economically unknown with debit balance impact', () => {
    const [candidate] = reconcileMercadoPagoMovements([{ ...settlement(), nativeId: 'payout-1', movement: { ...settlement().movement, nativeId: 'payout-1', description: null, operation: { type: 'PAYOUTS', status: null, statusDetail: null } } }])
    expect(candidate).toMatchObject({ kind: 'unknown', direction: 'unknown', description: null, balanceImpact: { observed: true, effect: 'debit', amount: { value: -5500, currency: 'ARS' } } })
  })

  it('marks payment-only as no balance observation and derives aggregates', () => {
    const result = reconcileMercadoPagoMovements([payment(), payment({ nativeId: 'other-id', occurredAt: '2026-09-16T12:00:00.000Z' })])
    expect(result.aggregates).toEqual({ total: 2, observations: 2, crossSourceMatches: 0, paymentOnly: 2, balanceOnly: 0, expense: 2, income: 0, transfer: 0, neutral: 0, unknown: 0, partial: 0, confirmed: 2 })
    expect(result[0].balanceImpact).toEqual({ observed: false, effect: 'unknown', amount: { value: null, currency: null } })
  })

  it('derives production-shaped aggregate counts from generated fixture observations', () => {
    const observations = [
      ...Array.from({ length: 13 }, (_, index) => [payment({ nativeId: `pair-${index}` }), settlement({ nativeId: `pair-${index}` })]).flat(),
      ...Array.from({ length: 22 }, (_, index) => payment({ nativeId: `payment-${index}` })),
      ...Array.from({ length: 5 }, (_, index) => settlement({ nativeId: `balance-${index}` })),
    ]
    const result = reconcileMercadoPagoMovements(observations)
    expect(result.aggregates).toMatchObject({ observations: 53, crossSourceMatches: 13, total: 40, paymentOnly: 22, balanceOnly: 5 })
  })

  it('sorts newest first with a deterministic ID tie-breaker', () => {
    const result = reconcileMercadoPagoMovements([payment({ nativeId: 'b', occurredAt: '2026-09-15T12:00:00.000Z' }), payment({ nativeId: 'a', occurredAt: '2026-09-15T12:00:00.000Z' })])
    expect(result.map((candidate) => candidate.nativeId)).toEqual(['a', 'b'])
  })
})
