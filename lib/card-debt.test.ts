import { describe, expect, it } from 'vitest'
import { calculateCardDebtSummary, type CardDebtMovement } from './card-debt'

function movement(overrides: Partial<CardDebtMovement>): CardDebtMovement {
  return {
    amount: 0,
    currency: 'ARS',
    category: 'Supermercado',
    payment_method: 'DEBIT',
    is_legacy_card_payment: null,
    card_id: null,
    ...overrides,
  }
}

describe('calculateCardDebtSummary', () => {
  it('returns zeroes when there are no movements', () => {
    expect(calculateCardDebtSummary([], 'ARS')).toEqual({
      creditAccrued: 0,
      applicablePayments: 0,
      legacyPayments: 0,
      pendingDebt: 0,
    })
  })

  it('uses credit accrued expenses as pending debt when there are no payments', () => {
    expect(
      calculateCardDebtSummary(
        [
          movement({ amount: 120, payment_method: 'CREDIT', category: 'Farmacia' }),
          movement({ amount: 80, payment_method: 'CREDIT', category: 'Supermercado' }),
        ],
        'ARS',
      ),
    ).toEqual({
      creditAccrued: 200,
      applicablePayments: 0,
      legacyPayments: 0,
      pendingDebt: 200,
    })
  })

  it('subtracts applicable card payments from pending debt', () => {
    expect(
      calculateCardDebtSummary(
        [
          movement({ amount: 300, payment_method: 'CREDIT', category: 'Indumentaria' }),
          movement({
            amount: 120,
            category: 'Pago de Tarjetas',
            payment_method: 'DEBIT',
            is_legacy_card_payment: false,
          }),
        ],
        'ARS',
      ),
    ).toEqual({
      creditAccrued: 300,
      applicablePayments: 120,
      legacyPayments: 0,
      pendingDebt: 180,
    })
  })

  it('clamps pending debt at zero when applicable payments exceed credit accrued', () => {
    expect(
      calculateCardDebtSummary(
        [
          movement({ amount: 100, payment_method: 'CREDIT', category: 'Servicios del Hogar' }),
          movement({
            amount: 150,
            category: 'Pago de Tarjetas',
            payment_method: 'TRANSFER',
            is_legacy_card_payment: false,
          }),
        ],
        'ARS',
      ).pendingDebt,
    ).toBe(0)
  })

  it('ignores legacy card payments for pending debt but reports them separately', () => {
    expect(
      calculateCardDebtSummary(
        [
          movement({ amount: 300, payment_method: 'CREDIT', category: 'Indumentaria' }),
          movement({
            amount: 250,
            category: 'Pago de Tarjetas',
            payment_method: 'DEBIT',
            is_legacy_card_payment: true,
          }),
        ],
        'ARS',
      ),
    ).toEqual({
      creditAccrued: 300,
      applicablePayments: 0,
      legacyPayments: 250,
      pendingDebt: 300,
    })
  })

  it('treats null card-payment legacy flag as applicable for compatibility', () => {
    expect(
      calculateCardDebtSummary(
        [
          movement({ amount: 300, payment_method: 'CREDIT', category: 'Indumentaria' }),
          movement({
            amount: 300,
            category: 'Pago de Tarjetas',
            payment_method: 'DEBIT',
            is_legacy_card_payment: null,
          }),
        ],
        'ARS',
      ).pendingDebt,
    ).toBe(0)
  })

  it('filters by selected currency before summing', () => {
    const movements = [
      movement({ amount: 100, currency: 'ARS', payment_method: 'CREDIT', category: 'Farmacia' }),
      movement({ amount: 50, currency: 'USD', payment_method: 'CREDIT', category: 'Farmacia' }),
      movement({
        amount: 30,
        currency: 'USD',
        category: 'Pago de Tarjetas',
        payment_method: 'DEBIT',
        is_legacy_card_payment: false,
      }),
    ]

    expect(calculateCardDebtSummary(movements, 'ARS')).toEqual({
      creditAccrued: 100,
      applicablePayments: 0,
      legacyPayments: 0,
      pendingDebt: 100,
    })
    expect(calculateCardDebtSummary(movements, 'USD')).toEqual({
      creditAccrued: 50,
      applicablePayments: 30,
      legacyPayments: 0,
      pendingDebt: 20,
    })
  })

  it('ignores cash-like non-card-payment movements', () => {
    expect(
      calculateCardDebtSummary(
        [
          movement({ amount: 100, payment_method: 'DEBIT', category: 'Supermercado' }),
          movement({ amount: 50, payment_method: 'TRANSFER', category: 'Servicios del Hogar' }),
        ],
        'ARS',
      ),
    ).toEqual({
      creditAccrued: 0,
      applicablePayments: 0,
      legacyPayments: 0,
      pendingDebt: 0,
    })
  })
})
