import { describe, expect, it } from 'vitest'
import { applyExpensePreset } from './expense-preset'

describe('expense preset', () => {
  it('selects credit and the card without changing the amount', () => {
    const draft = applyExpensePreset(
      { payment_method: 'DEBIT' as const, card_id: null, amount: 1200 },
      { cardId: 'card-1' },
    )
    expect(draft).toEqual({ payment_method: 'CREDIT', card_id: 'card-1', amount: 1200 })
  })

  it('leaves the draft alone when there is no preset', () => {
    const draft = { payment_method: 'CASH' as const, card_id: null }
    expect(applyExpensePreset(draft, null)).toBe(draft)
  })
})
