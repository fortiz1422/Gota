import { describe, expect, it } from 'vitest'
import { parseTextExpenseFallback } from './expense-text-parser'

describe('parseTextExpenseFallback', () => {
  it('parses a simple text expense when AI parsing is unavailable', () => {
    expect(parseTextExpenseFallback('cafe 2500', '2026-06-27')).toEqual({
      is_valid: true,
      amount: 2500,
      currency: 'ARS',
      category: 'Restaurantes',
      description: 'cafe',
      is_want: false,
      payment_method: 'DEBIT',
      card_id: null,
      installments: null,
      date: '2026-06-27',
    })
  })

  it('parses Argentine decimal/thousand formats and USD marker', () => {
    expect(parseTextExpenseFallback('amazon usd 1.305,50', '2026-06-27')).toMatchObject({
      is_valid: true,
      amount: 1305.5,
      currency: 'USD',
      category: 'Entretenimiento',
      description: 'amazon',
    })
  })

  it('returns invalid when text has no trailing amount', () => {
    expect(parseTextExpenseFallback('solo cafe', '2026-06-27')).toEqual({
      is_valid: false,
      reason: 'No pude detectar un monto. Probá con algo como "cafe 2500".',
    })
  })
})
