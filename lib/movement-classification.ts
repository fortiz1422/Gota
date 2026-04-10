type ExpenseLike = {
  category: string
  payment_method: string
  is_legacy_card_payment?: boolean | null
}

export function isCardPayment(expense: ExpenseLike): boolean {
  return expense.category === 'Pago de Tarjetas'
}

export function isLegacyCardPayment(expense: ExpenseLike): boolean {
  return isCardPayment(expense) && expense.is_legacy_card_payment === true
}

export function isApplicableCardPayment(expense: ExpenseLike): boolean {
  return isCardPayment(expense) && !isLegacyCardPayment(expense)
}

export function isCreditAccruedExpense(expense: ExpenseLike): boolean {
  return expense.payment_method === 'CREDIT' && !isCardPayment(expense)
}

export function isPerceivedExpense(expense: ExpenseLike): boolean {
  return ['CASH', 'DEBIT', 'TRANSFER'].includes(expense.payment_method) && !isCardPayment(expense)
}
