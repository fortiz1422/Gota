import { describe, expect, it } from 'vitest'
import { buildPaymentExpensePlans } from '@/lib/card-payment-expense-plans'

describe('buildPaymentExpensePlans', () => {
  it('creates one ARS expense per payment item when ars and usd are both funded from ars', () => {
    const plans = buildPaymentExpensePlans({
      plannedItems: [
        { item: { currency: 'ARS' }, plans: [{ appliedAmount: 10000 }] },
        { item: { currency: 'USD' }, plans: [{ appliedAmount: 50 }] },
      ],
      fromCurrency: 'ARS',
      accountId: 'ars-account',
      exchangeRate: 1200,
    })

    expect(plans).toEqual([
      { plannedItemIndex: 0, expenseCurrency: 'ARS', accountId: 'ars-account', amount: 10000 },
      { plannedItemIndex: 1, expenseCurrency: 'ARS', accountId: 'ars-account', amount: 60000 },
    ])
  })

  it('keeps separate ars/usd expenses when split accounts are used', () => {
    const plans = buildPaymentExpensePlans({
      plannedItems: [
        { item: { currency: 'ARS' }, plans: [{ appliedAmount: 10000 }] },
        { item: { currency: 'USD' }, plans: [{ appliedAmount: 50 }] },
      ],
      fromCurrency: 'ARS',
      accountId: 'ars-account',
      accountIdUsd: 'usd-account',
      exchangeRate: 1200,
    })

    expect(plans).toEqual([
      { plannedItemIndex: 0, expenseCurrency: 'ARS', accountId: 'ars-account', amount: 10000 },
      { plannedItemIndex: 1, expenseCurrency: 'USD', accountId: 'usd-account', amount: 50 },
    ])
  })
})
