export type ExpensePreset = {
  cardId: string
}

export type PresetExpenseDraft = {
  payment_method: 'CASH' | 'DEBIT' | 'TRANSFER' | 'CREDIT'
  card_id: string | null
  amount?: number
}

/** The existing expense entry stays in charge of the amount. The preset only chooses credit and the card. */
export function applyExpensePreset<T extends PresetExpenseDraft>(draft: T, preset: ExpensePreset | null): T {
  if (!preset?.cardId) return draft
  return {
    ...draft,
    payment_method: 'CREDIT',
    card_id: preset.cardId,
  }
}
