export type MercadoPagoMovement = {
  candidateId: string
  occurredAt: string | null
  balanceOccurredAt: string | null
  amount: { value: number | null; currency: string | null }
  kind?: string
  direction?: string
  accountRole?: string
  installments?: number | null
  operation?: { type: string | null; status: string | null; statusDetail?: string | null }
  summary?: { refunded: number | null }
  description: string | null
  statementDescriptor: string | null
  reviewStatus: 'pending' | 'confirmed' | 'dismissed'
  balanceImpact: { observed: boolean; effect: 'debit' | 'credit' | 'zero' | 'unknown'; amount: { value: number | null; currency: string | null } }
  fundingSource?: { kind?: string; brand?: string; lastFour?: string; cardType?: 'credit' | 'debit' }
  cardPurchaseEligible?: boolean
  cardType?: 'credit' | 'debit' | null
  reviewSnapshot?: { fingerprint: string; observations: Array<{ id: string; source: string; key: string | null; seenAt: string }> }
}
export type MercadoPagoDiagnostic = MercadoPagoMovement
export type ConfirmExpensePayload = { description: string; category: string; isWant: boolean; expectedLinkedAccountId: string; expectedLinkedAccountVersion: number; cardId?: string; installments?: number }
export type MercadoPagoReviewBuckets = { eligible: MercadoPagoMovement[]; cardPending: MercadoPagoMovement[]; unknown: MercadoPagoMovement[] }
export type MercadoPagoReviewCapability = { mode: 'confirmable' | 'evidence-only'; reason: 'complete_balance_debit' | 'complete_credit_card_purchase' | 'card_funding_incomplete' | 'financial_class_unresolved' }

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
export function isReviewableMercadoPagoCardPurchase(movement: MercadoPagoMovement) {
  return movement.reviewStatus === 'pending' && movement.cardPurchaseEligible === true && movement.kind === 'expense' && movement.direction === 'outflow'
    && ['regular_payment', 'recurring_payment'].includes(movement.operation?.type ?? '')
    && movement.operation?.status === 'approved' && !['charged_back', 'in_mediation', 'refunded'].includes(movement.operation.statusDetail ?? '') && movement.fundingSource?.kind === 'card'
    && movement.cardType === 'credit' && typeof movement.amount.value === 'number' && movement.amount.value > 0
    && ['ARS', 'USD'].includes(movement.amount.currency ?? '')
    && Boolean(movement.occurredAt && Number.isFinite(Date.parse(movement.occurredAt))) && movement.installments === 1
    && (movement.summary?.refunded === null || movement.summary?.refunded === 0)
}

export function getMercadoPagoReviewCapability(movement: MercadoPagoMovement): MercadoPagoReviewCapability {
  if (isReviewableMercadoPagoExpense(movement)) return { mode: 'confirmable', reason: 'complete_balance_debit' }
  if (isReviewableMercadoPagoCardPurchase(movement)) return { mode: 'confirmable', reason: 'complete_credit_card_purchase' }
  if (movement.fundingSource?.kind === 'card') return { mode: 'evidence-only', reason: 'card_funding_incomplete' }
  return { mode: 'evidence-only', reason: 'financial_class_unresolved' }
}
export function getMercadoPagoReviewDate(movement: MercadoPagoMovement) {
  // A confirmable movement must always be shown and bulk-selected by the same
  // provider balance date the authoritative endpoint writes to the ledger.
  return isReviewableMercadoPagoExpense(movement)
    ? movement.balanceOccurredAt
    : movement.occurredAt ?? movement.balanceOccurredAt
}
export function sortMercadoPagoPendingMovements(movements: readonly MercadoPagoMovement[]) {
  return [...movements].filter((movement) => movement.reviewStatus === 'pending').sort((left, right) => {
    const toTime = (movement: MercadoPagoMovement) => {
      const value = getMercadoPagoReviewDate(movement)
      const parsed = value ? Date.parse(value) : Number.NaN
      return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY
    }
    const leftTime = toTime(left)
    const rightTime = toTime(right)
    if (leftTime !== rightTime) return rightTime - leftTime
    return left.candidateId.localeCompare(right.candidateId)
  })
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
export function buildConfirmExpensePayload(input: ConfirmExpensePayload): ConfirmExpensePayload | Omit<ConfirmExpensePayload, 'expectedLinkedAccountId' | 'expectedLinkedAccountVersion' | 'cardId' | 'installments'> & { cardId: string; installments: number } {
  const base = { description: input.description.trim(), category: input.category, isWant: input.isWant }
  if (input.cardId !== undefined) return { ...base, cardId: input.cardId, installments: input.installments ?? 1 }
  return { ...base, expectedLinkedAccountId: input.expectedLinkedAccountId, expectedLinkedAccountVersion: input.expectedLinkedAccountVersion }
}

export function getArgentinaBusinessDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return null
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(value))
}

export function selectMovementsOnOrBefore(movements: readonly MercadoPagoMovement[], cutoff: string) {
  return movements.filter((movement) => {
    const date = getArgentinaBusinessDate(getMercadoPagoReviewDate(movement))
    return date !== null && date <= cutoff
  })
}
