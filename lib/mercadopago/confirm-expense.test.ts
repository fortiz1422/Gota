import { isReviewableMercadoPagoExpense, type MercadoPagoMovement } from './review'
import type { ReconciledMercadoPagoMovement } from './reconciliation'
import { describe, expect, it } from 'vitest'
import { candidateFingerprint, buildConfirmationIntentHash, buildCanonicalSemantics, eligibleMercadoPagoExpense } from './confirm-expense'

describe('Mercado Pago expense confirmation canonical contract', () => {
  it('exports stable fingerprint independent of lastSeenAt', () => {
    const candidate = { candidateId: 'sha256:x', evidence: [{ id: 'raw-1', source: 'payments_search', native_key: 'p1', last_seen_at: '2026-01-01', movement: { amount: { value: 5500, currency: 'ARS' }, occurredAt: '2026-09-15' } }] }
    expect(candidateFingerprint(candidate)).toMatch(/^[a-f0-9]{64}$/)
    expect(candidateFingerprint({ ...candidate, evidence: [{ ...candidate.evidence[0], last_seen_at: '2026-02-01' }] })).toBe(candidateFingerprint(candidate))
  })

  it('hashes only canonical human intent, never a browser-selected account', () => {
    expect(buildCanonicalSemantics()).toEqual({ classification: 'human_confirmed_expense', provider_effect: 'balance_debit' })
    expect(buildConfirmationIntentHash({ description: ' Shell ', category: 'Otros', isWant: false })).toMatch(/^[a-f0-9]{64}$/)
  })

  it.each(['income', 'neutral'])('never makes a known %s confirmable as a balance expense', (kind) => {
    expect(eligibleMercadoPagoExpense({
      kind,
      balanceImpact: { observed: true, effect: 'debit', amount: { value: -1000, currency: 'ARS' } },
      balanceOccurredAt: '2026-10-02T01:26:52Z',
      summary: { refunded: null },
      operation: { type: 'PAYOUTS', status: null, statusDetail: null },
    } as never)).toBe(false)
  })
})

const transfer = {
  kind: 'transfer', direction: 'outflow', reviewStatus: 'pending',
  balanceImpact: { observed: true, effect: 'debit', amount: { value: -1000, currency: 'ARS' } },
  balanceOccurredAt: '2026-10-02T01:26:52Z', summary: { refunded: null },
  operation: { type: 'PAYOUTS', status: null, statusDetail: null },
  fundingSource: { kind: 'unknown' }, installments: null,
}
describe('outgoing transfers require human expense confirmation', () => {
  it.each([
    ['observed outgoing PAYOUTS', {}, true],
    ['incoming transfer', { direction: 'inflow' }, false],
    ['unknown direction', { direction: 'unknown' }, false],
    ['unobserved debit', { balanceImpact: { ...transfer.balanceImpact, observed: false } }, false],
    ['credit', { balanceImpact: { observed: true, effect: 'credit', amount: { value: 1000, currency: 'ARS' } } }, false],
    ['missing date', { balanceOccurredAt: null }, false],
    ['card funding', { fundingSource: { kind: 'card' } }, false],
    ['multiple installments', { installments: 3 }, false],
    ['refund amount', { summary: { refunded: 100 } }, false],
    ['charged back', { operation: { ...transfer.operation, status: 'charged_back' } }, false],
  ])('client and server agree for %s', (_name, overrides, expected) => {
    const candidate = { ...transfer, ...overrides }
    expect(eligibleMercadoPagoExpense(candidate as unknown as ReconciledMercadoPagoMovement)).toBe(expected)
    expect(isReviewableMercadoPagoExpense(candidate as unknown as MercadoPagoMovement)).toBe(expected)
  })
})
