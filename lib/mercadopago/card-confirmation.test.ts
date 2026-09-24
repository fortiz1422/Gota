import { describe, expect, it } from 'vitest'
import { isEligibleCreditCardPurchase } from './confirm-expense'
type CardGateInput = Parameters<typeof isEligibleCreditCardPurchase>[0]

describe('MP credit-card gate', () => {
  const candidate: CardGateInput = { kind: 'expense', direction: 'outflow', accountRole: 'payer', operation: { type: 'regular_payment', status: 'approved', statusDetail: null }, fundingSource: { kind: 'card', cardType: 'credit' }, amount: { value: 800, currency: 'ARS' }, summary: { gross: 800, totalPaid: null, netReceived: null, refunded: null, fees: null }, occurredAt: '2026-09-15T10:00:00Z', installments: 1 }
  it('admits approved payer expenses funded by known credit card only', () => {
    expect(isEligibleCreditCardPurchase(candidate)).toBe(true)
    for (const change of [
      { kind: 'income' }, { direction: 'inflow' }, { accountRole: 'collector' },
      { operation: { type: 'money_transfer', status: 'approved' } },
      { operation: { type: 'regular_payment', status: 'rejected' } },
      { fundingSource: { kind: 'card', cardType: 'debit' } },
      { fundingSource: { kind: 'card', cardType: null } },
      { amount: { value: 0, currency: 'ARS' } }, { amount: { value: 800, currency: 'EUR' } },
      { occurredAt: null }, { installments: null }, { installments: 2 },
    ]) expect(isEligibleCreditCardPurchase({ ...candidate, ...change } as CardGateInput)).toBe(false)
  })
})
