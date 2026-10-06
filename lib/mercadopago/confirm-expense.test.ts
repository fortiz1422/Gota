import { isReviewableMercadoPagoExpense, isReviewableMercadoPagoWalletPayment, type MercadoPagoMovement } from './review'
import type { ReconciledMercadoPagoMovement } from './reconciliation'
import { describe, expect, it } from 'vitest'
import { candidateFingerprint, buildConfirmationIntentHash, buildCanonicalSemantics, eligibleMercadoPagoExpense, getMercadoPagoOperationKey, isEligibleMercadoPagoWalletPayment } from './confirm-expense'

describe('Mercado Pago expense confirmation canonical contract', () => {
  it('exports stable fingerprint independent of lastSeenAt', () => {
    const candidate = { candidateId: 'sha256:x', evidence: [{ id: 'raw-1', source: 'payments_search', native_key: 'p1', last_seen_at: '2026-01-01', movement: { amount: { value: 5500, currency: 'ARS' }, occurredAt: '2026-09-15' } }] }
    expect(candidateFingerprint(candidate)).toMatch(/^[a-f0-9]{64}$/)
    expect(candidateFingerprint({ ...candidate, evidence: [{ ...candidate.evidence[0], last_seen_at: '2026-02-01' }] })).toBe(candidateFingerprint(candidate))
  })

  it('hashes all canonical human choices, including tags, never a browser-selected account', () => {
    expect(buildCanonicalSemantics()).toEqual({ classification: 'human_confirmed_expense', provider_effect: 'balance_debit' })
    const base = buildConfirmationIntentHash({ description: ' Shell ', category: 'Otros', isWant: false, isRecurring: false, isExtraordinary: false })
    expect(base).toMatch(/^[a-f0-9]{64}$/)
    expect(buildConfirmationIntentHash({ description: ' Shell ', category: 'Otros', isWant: false, isRecurring: true, isExtraordinary: false })).not.toBe(base)
    expect(buildConfirmationIntentHash({ description: ' Shell ', category: 'Otros', isWant: false, isRecurring: false, isExtraordinary: true })).not.toBe(base)
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
const walletPayment = {
  kind: 'expense', direction: 'outflow', accountRole: 'payer', reviewStatus: 'pending',
  amount: { value: 2300, currency: 'ARS' }, occurredAt: '2026-10-06T14:50:00Z',
  operation: { type: 'regular_payment', status: 'approved', statusDetail: 'accredited' },
  fundingSource: { kind: 'mercadopago_balance' }, installments: 1,
  summary: { totalPaid: 2300, refunded: 0 },
  balanceImpact: { observed: false, effect: 'unknown', amount: { value: null, currency: null } },
}

describe('account-money wallet payments', () => {
  it('are reviewable from approved payment evidence before settlement arrives', () => {
    expect(isEligibleMercadoPagoWalletPayment(walletPayment as unknown as ReconciledMercadoPagoMovement)).toBe(true)
    expect(isReviewableMercadoPagoWalletPayment(walletPayment as unknown as MercadoPagoMovement)).toBe(true)
  })

  it.each([
    ['wrong direction', { direction: 'inflow' }],
    ['wrong role', { accountRole: 'collector' }],
    ['not accredited', { operation: { ...walletPayment.operation, statusDetail: 'pending' } }],
    ['refund', { summary: { totalPaid: 2300, refunded: 100 } }],
    ['installments', { installments: 2 }],
    ['conflicting settlement', { balanceImpact: { observed: true, effect: 'debit', amount: { value: -2200, currency: 'ARS' } } }],
  ])('fails closed for %s', (_name, overrides) => {
    expect(isEligibleMercadoPagoWalletPayment({ ...walletPayment, ...overrides } as unknown as ReconciledMercadoPagoMovement)).toBe(false)
  })

  it('derives one stable operation identity from the provider native key', () => {
    const evidence = [{ nativeKey: '182684199500' }, { nativeKey: '182684199500' }] as never
    const key = getMercadoPagoOperationKey('connection-1', { evidence })
    expect(key).toMatch(/^[a-f0-9]{64}$/)
    expect(getMercadoPagoOperationKey('connection-1', { evidence })).toBe(key)
    expect(getMercadoPagoOperationKey('connection-2', { evidence })).not.toBe(key)
    expect(getMercadoPagoOperationKey('connection-1', { evidence: [{ nativeKey: 'a' }, { nativeKey: 'b' }] as never })).toBeNull()
  })
})

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
