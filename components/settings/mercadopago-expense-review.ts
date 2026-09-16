export type MercadoPagoDiagnostic = {
  candidateId: string
  occurredAt: string | null
  balanceOccurredAt: string | null
  amount: { value: number | null; currency: string | null }
  description: string | null
  statementDescriptor: string | null
  reviewStatus: 'pending' | 'confirmed'
  balanceImpact: {
    observed: boolean
    effect: 'debit' | 'credit' | 'zero' | 'unknown'
    amount: { value: number | null; currency: string | null }
  }
}

export type ConfirmExpensePayload = {
  description: string
  category: string
  isWant: boolean
  accountId: string
}

export function getInitialExpenseDescription(movement: MercadoPagoDiagnostic) {
  return getDisplayExpenseDescription(movement)
}

export function getMercadoPagoDisplayAmount(movement: MercadoPagoDiagnostic) {
  const primary = movement.amount
  if (typeof primary.value === 'number' && Number.isFinite(primary.value))
    return primary
  return movement.balanceImpact.amount
}

export function getDisplayExpenseDescription(movement: MercadoPagoDiagnostic) {
  const description = movement.description ?? ''
  if (/^Producto genérico/.test(description) && movement.statementDescriptor) {
    return (
      movement.statementDescriptor.replace(/^MERPAGO\*/i, '').trim() ||
      description
    )
  }
  return description
}

export function isReviewableMercadoPagoExpense(
  movement: MercadoPagoDiagnostic
) {
  const amount = movement.balanceImpact.amount
  return (
    movement.reviewStatus === 'pending' &&
    movement.balanceImpact.observed &&
    movement.balanceImpact.effect === 'debit' &&
    typeof amount.value === 'number' &&
    Number.isFinite(amount.value) &&
    amount.value < 0 &&
    (amount.currency === 'ARS' || amount.currency === 'USD') &&
    typeof movement.balanceOccurredAt === 'string' &&
    Number.isFinite(Date.parse(movement.balanceOccurredAt))
  )
}

export function buildConfirmExpensePayload(
  input: ConfirmExpensePayload
): ConfirmExpensePayload {
  return {
    description: input.description.trim(),
    category: input.category,
    isWant: input.isWant,
    accountId: input.accountId,
  }
}
