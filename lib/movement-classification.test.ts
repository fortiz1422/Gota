import { describe, expect, it } from 'vitest'
import {
  isApplicableCardPayment,
  isCardPayment,
  isCreditAccruedExpense,
  isLegacyCardPayment,
  isPerceivedExpense,
} from './movement-classification'

describe('movement classification', () => {
  it('identifies card payments by category', () => {
    expect(
      isCardPayment({
        category: 'Pago de Tarjetas',
        payment_method: 'TRANSFER',
      }),
    ).toBe(true)

    expect(
      isCardPayment({
        category: 'Supermercado',
        payment_method: 'CREDIT',
      }),
    ).toBe(false)
  })

  it('separates applicable and legacy card payments', () => {
    const applicablePayment = {
      category: 'Pago de Tarjetas',
      payment_method: 'TRANSFER',
      is_legacy_card_payment: false,
    }
    const legacyPayment = {
      category: 'Pago de Tarjetas',
      payment_method: 'TRANSFER',
      is_legacy_card_payment: true,
    }

    expect(isCardPayment(applicablePayment)).toBe(true)
    expect(isCardPayment(legacyPayment)).toBe(true)
    expect(isApplicableCardPayment(applicablePayment)).toBe(true)
    expect(isApplicableCardPayment(legacyPayment)).toBe(false)
    expect(isLegacyCardPayment(applicablePayment)).toBe(false)
    expect(isLegacyCardPayment(legacyPayment)).toBe(true)
  })

  it('treats null legacy flag as an applicable card payment', () => {
    expect(
      isApplicableCardPayment({
        category: 'Pago de Tarjetas',
        payment_method: 'TRANSFER',
        is_legacy_card_payment: null,
      }),
    ).toBe(true)
  })

  it('treats missing legacy flag as an applicable card payment', () => {
    expect(
      isApplicableCardPayment({
        category: 'Pago de Tarjetas',
        payment_method: 'TRANSFER',
      }),
    ).toBe(true)
  })

  it('classifies credit accrued expenses excluding card payments', () => {
    expect(
      isCreditAccruedExpense({
        category: 'Indumentaria',
        payment_method: 'CREDIT',
      }),
    ).toBe(true)

    expect(
      isCreditAccruedExpense({
        category: 'Pago de Tarjetas',
        payment_method: 'CREDIT',
      }),
    ).toBe(false)
  })

  it('classifies perceived cash-like expenses excluding card payments', () => {
    expect(
      isPerceivedExpense({
        category: 'Supermercado',
        payment_method: 'DEBIT',
      }),
    ).toBe(true)

    expect(
      isPerceivedExpense({
        category: 'Pago de Tarjetas',
        payment_method: 'TRANSFER',
      }),
    ).toBe(false)

    expect(
      isPerceivedExpense({
        category: 'Farmacia',
        payment_method: 'CREDIT',
      }),
    ).toBe(false)
  })
})
