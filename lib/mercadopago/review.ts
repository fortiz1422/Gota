export type MercadoPagoMovement = {
  candidateId: string
  occurredAt: string | null
  balanceOccurredAt: string | null
  amount: { value: number | null; currency: string | null }
  description: string | null
  statementDescriptor: string | null
  reviewStatus: 'pending' | 'confirmed' | 'dismissed'
  balanceImpact: { observed: boolean; effect: 'debit' | 'credit' | 'zero' | 'unknown'; amount: { value: number | null; currency: string | null } }
  fundingSource?: { kind?: string; brand?: string; lastFour?: string }
}
export type MercadoPagoDiagnostic = MercadoPagoMovement
export type ConfirmExpensePayload = { description: string; category: string; isWant: boolean; accountId: string }
export type MercadoPagoReviewBuckets = { eligible: MercadoPagoMovement[]; cardPending: MercadoPagoMovement[]; unknown: MercadoPagoMovement[] }

export function getMercadoPagoDisplayAmount(movement: MercadoPagoMovement) {
  if (typeof movement.amount.value === 'number' && Number.isFinite(movement.amount.value)) return movement.amount
  return movement.balanceImpact.amount
}
export function getDisplayExpenseDescription(movement: MercadoPagoMovement) {
  const description = movement.description ?? ''
  if (/^Producto genérico/.test(description) && movement.statementDescriptor) return movement.statementDescriptor.replace(/^MERPAGO\*/i, '').trim() || description
  return description
}
export function getInitialExpenseDescription(movement: MercadoPagoMovement) { return getDisplayExpenseDescription(movement) }
export function isReviewableMercadoPagoExpense(movement: MercadoPagoMovement) {
  const amount = movement.balanceImpact.amount
  return movement.reviewStatus === 'pending' && movement.balanceImpact.observed && movement.balanceImpact.effect === 'debit' && typeof amount.value === 'number' && Number.isFinite(amount.value) && amount.value < 0 && (amount.currency === 'ARS' || amount.currency === 'USD') && typeof movement.balanceOccurredAt === 'string' && Number.isFinite(Date.parse(movement.balanceOccurredAt))
}
export function classifyMercadoPagoMovements(movements: readonly MercadoPagoMovement[]): MercadoPagoReviewBuckets {
  const buckets: MercadoPagoReviewBuckets = { eligible: [], cardPending: [], unknown: [] }
  for (const movement of movements) {
    if (movement.reviewStatus !== 'pending') continue
    if (isReviewableMercadoPagoExpense(movement)) buckets.eligible.push(movement)
    else if (movement.fundingSource?.kind === 'card' && movement.reviewStatus === 'pending') buckets.cardPending.push(movement)
    else buckets.unknown.push(movement)
  }
  return buckets
}

export function pendingMercadoPagoMovementCount(movements: readonly MercadoPagoMovement[]) {
  return pendingMercadoPagoReviewBucketCount(classifyMercadoPagoMovements(movements))
}
export function pendingMercadoPagoReviewBucketCount(buckets: MercadoPagoReviewBuckets) {
  return buckets.eligible.length + buckets.cardPending.length + buckets.unknown.length
}
export function buildConfirmExpensePayload(input: ConfirmExpensePayload): ConfirmExpensePayload { return { description: input.description.trim(), category: input.category, isWant: input.isWant, accountId: input.accountId } }
