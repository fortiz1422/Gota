import { describe, expect, it } from 'vitest'
import { __test__extractTrailingAmount, applyTextInputAmountFallback } from '@/lib/expense-parse-fallback'

describe('expense-parse-fallback', () => {
  it('extracts a simple trailing integer amount from text input', () => {
    expect(__test__extractTrailingAmount('Farmacia 4995')).toEqual({
      amount: 4995,
      description: 'Farmacia',
    })
  })

  it('extracts trailing amounts with AR thousands and decimals', () => {
    expect(__test__extractTrailingAmount('Farmacia 4.995')).toEqual({
      amount: 4995,
      description: 'Farmacia',
    })

    expect(__test__extractTrailingAmount('Farmacia $4.995,50')).toEqual({
      amount: 4995.5,
      description: 'Farmacia',
    })
  })

  it('salvages model outputs that classify correctly but leave amount at zero', () => {
    expect(
      applyTextInputAmountFallback('Farmacia 4995', {
        is_valid: true,
        amount: 0,
        currency: 'ARS',
        category: 'Farmacia',
        description: 'Farmacia 4995',
        is_want: false,
        payment_method: 'CASH',
        card_id: null,
        installments: null,
        date: '2026-06-22T00:00:00-03:00',
      }),
    ).toMatchObject({
      is_valid: true,
      amount: 4995,
      description: 'Farmacia',
      category: 'Farmacia',
    })
  })

  it('does not modify already valid parses', () => {
    expect(
      applyTextInputAmountFallback('Farmacia 4995', {
        is_valid: true,
        amount: 4995,
        currency: 'ARS',
        category: 'Farmacia',
        description: 'Farmacia',
        is_want: false,
        payment_method: 'CASH',
        card_id: null,
        installments: null,
        date: '2026-06-22T00:00:00-03:00',
      }),
    ).toMatchObject({
      amount: 4995,
      description: 'Farmacia',
    })
  })
})
