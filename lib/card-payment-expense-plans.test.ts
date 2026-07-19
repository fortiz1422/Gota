import { describe, expect, it } from 'vitest'
import {
  buildPaymentAdjustmentExpensePlan,
  buildPaymentExpensePlans,
} from '@/lib/card-payment-expense-plans'

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

describe('buildPaymentAdjustmentExpensePlan', () => {
  it('imputa el cargo al último día del período cuando el cierre cae el mes siguiente', () => {
    const plan = buildPaymentAdjustmentExpensePlan({
      adjustment: {
        amount: 151_679.66,
        category: 'Cargos Bancarios',
        description: 'Cargo bancario',
        isWant: false,
      },
      currency: 'ARS',
      cardId: 'card-1',
      cycle: {
        id: 'cycle-june',
        periodMonth: '2026-06-01',
        closingDate: '2026-07-02',
      },
    })

    expect(plan).toMatchObject({
      date: '2026-06-30',
      card_id: 'card-1',
      card_cycle_id: 'cycle-june',
      payment_method: 'CREDIT',
      account_id: null,
    })
  })
})
