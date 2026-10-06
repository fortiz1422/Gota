import { createHash } from 'node:crypto'
import { normalizeMercadoPagoMovement } from './provider-movement'
import { observationFingerprint, reconcileMercadoPagoMovements, type ReconciledMercadoPagoMovement, type ReconciliationObservation } from './reconciliation'
import type { MercadoPagoConnection, MercadoPagoMovementObservation } from './server-repository'

const stableJson = (value: unknown) => JSON.stringify(value)
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export function candidateFingerprint(candidate: { evidence: Array<{ source: string; movement: unknown; native_key?: string | null; last_seen_at?: string }> }) {
  // This is also the shadow-decision identity. Keep one canonical algorithm so
  // an exception shown in the inbox can only refer to the exact evidence that
  // the classifier evaluated.
  return sha256(candidate.evidence.map((evidence) => observationFingerprint(evidence as ReconciliationObservation)).sort().join('|'))
}

export function buildCanonicalSemantics() {
  return { classification: 'human_confirmed_expense', provider_effect: 'balance_debit' } as const
}

export function buildConfirmationIntentHash(input: { description: string; category: string; isWant: boolean; cardId?: string; installments?: number }) {
  return sha256(stableJson({ description: input.description.trim(), category: input.category, isWant: input.isWant, ...(input.cardId ? { cardId: input.cardId, installments: input.installments ?? null } : {}) }))
}

export function getMercadoPagoCardPurchaseAmount(candidate: Pick<ReconciledMercadoPagoMovement, 'amount' | 'summary'>) {
  // An explicit total paid includes financing costs; never multiply a payment
  // amount by the count or fall back from a malformed explicit total.
  const total = candidate.summary.totalPaid ?? candidate.amount.value
  return typeof total === 'number' && Number.isFinite(total) && total > 0 && Number.isSafeInteger(Math.round(total * 100)) ? total : null
}

export function isEligibleCreditCardPurchase(candidate: Pick<ReconciledMercadoPagoMovement, 'kind' | 'direction' | 'accountRole' | 'operation' | 'fundingSource' | 'amount' | 'occurredAt' | 'installments' | 'summary'>) {
  return candidate.kind === 'expense' && candidate.direction === 'outflow' && candidate.accountRole === 'payer'
    && ['regular_payment', 'recurring_payment'].includes(candidate.operation.type ?? '')
    && candidate.operation.status === 'approved' && !['charged_back', 'in_mediation', 'refunded'].includes(candidate.operation.statusDetail ?? '') && candidate.fundingSource.kind === 'card'
    && candidate.fundingSource.cardType === 'credit' && typeof candidate.amount.value === 'number'
    && Number.isFinite(candidate.amount.value) && candidate.amount.value > 0
    && ['ARS', 'USD'].includes(candidate.amount.currency ?? '')
    && Boolean(candidate.occurredAt && Number.isFinite(Date.parse(candidate.occurredAt)))
    && (candidate.summary.refunded === null || candidate.summary.refunded === 0) && Number.isInteger(candidate.installments) && candidate.installments! >= 1 && candidate.installments! <= 72
    && getMercadoPagoCardPurchaseAmount(candidate) !== null
}

export function getMercadoPagoOperationKey(connectionId: string, candidate: Pick<ReconciledMercadoPagoMovement, 'evidence'>) {
  const keys = new Set(candidate.evidence
    .map((observation) => (observation.nativeKey ?? observation.nativeId)?.trim() ?? '')
    .filter((key) => Boolean(key) && !/^sha256:[a-f0-9]{64}$/i.test(key)))
  if (!connectionId || keys.size !== 1) return null
  return sha256(`${connectionId}:${[...keys][0]}`)
}

export function isEligibleMercadoPagoWalletPayment(candidate: Pick<ReconciledMercadoPagoMovement, 'kind' | 'direction' | 'accountRole' | 'operation' | 'fundingSource' | 'amount' | 'occurredAt' | 'installments' | 'summary' | 'balanceImpact'>) {
  const amount = candidate.amount.value
  const balance = candidate.balanceImpact
  return candidate.kind === 'expense' && candidate.direction === 'outflow' && candidate.accountRole === 'payer'
    && ['regular_payment', 'recurring_payment'].includes(candidate.operation.type ?? '')
    && candidate.operation.status === 'approved' && candidate.operation.statusDetail === 'accredited'
    && candidate.fundingSource.kind === 'mercadopago_balance'
    && typeof amount === 'number' && Number.isFinite(amount) && amount > 0
    && ['ARS', 'USD'].includes(candidate.amount.currency ?? '')
    && Boolean(candidate.occurredAt && Number.isFinite(Date.parse(candidate.occurredAt)))
    && candidate.installments === 1
    && candidate.summary.totalPaid === amount
    && candidate.summary.refunded === 0
    && (!balance.observed || (
      balance.effect === 'debit'
      && balance.amount.value === -amount
      && balance.amount.currency === candidate.amount.currency
    ))
}

export function reconstructMercadoPagoCandidates(connection: MercadoPagoConnection, observations: MercadoPagoMovementObservation[]) {
  const internal: ReconciliationObservation[] = observations.map((observation) => ({
    id: observation.id,
    nativeKey: observation.native_key,
    source: observation.source,
    nativeId: observation.native_key?.trim() || null,
    lastSeenAt: observation.last_seen_at,
    movement: normalizeMercadoPagoMovement({ source: observation.source, payload: observation.payload, providerUserId: connection.provider_user_id ?? '', nativeKey: observation.native_key }),
  }))
  return reconcileMercadoPagoMovements(internal)
}

export function publicMercadoPagoMovement(candidate: ReconciledMercadoPagoMovement, review?: { status: 'confirmed'; expense_id: string } | { status: 'dismissed' } | null, attention?: 'possible_duplicate' | null) {
  const { evidence, settlement, nativeId, reasonCodes, accountRole, ...visible } = candidate
  void evidence; void settlement; void nativeId; void reasonCodes; void accountRole
  if (visible.fundingSource && 'issuerId' in visible.fundingSource) {
    const { issuerId, ...fundingSource } = visible.fundingSource
    void issuerId
    visible.fundingSource = fundingSource
  }
  return {
    ...visible,
    cardPurchaseEligible: isEligibleCreditCardPurchase(candidate) && ((candidate.installments === 1 && getMercadoPagoCardPurchaseAmount(candidate) === candidate.amount.value) || process.env.MERCADOPAGO_CARD_INSTALLMENTS_ENABLED === 'true'),
    cardPurchaseAmount: getMercadoPagoCardPurchaseAmount(candidate),
    cardType: candidate.fundingSource.cardType ?? null,
    ...(attention ? { attention } : {}),
    reviewStatus: review?.status ?? 'pending',
    ...(review?.status === 'confirmed' ? { expenseId: review.expense_id } : {}),
    reviewSnapshot: review ? undefined : {
      fingerprint: candidateFingerprint(candidate),
      observations: expectedObservations(candidate).map((observation) => ({ id: observation.id, source: observation.source, key: observation.native_key, seenAt: observation.last_seen_at })),
    },
  }
}

export function eligibleMercadoPagoExpense(candidate: ReconciledMercadoPagoMovement) {
  const amount = candidate.balanceImpact.amount.value
  const occurredAt = candidate.balanceOccurredAt
  const forbiddenFinancialType = ['income', 'neutral'].includes(candidate.kind)
    || (candidate.kind === 'transfer' && (candidate.direction !== 'outflow' || candidate.fundingSource.kind === 'card' || (candidate.installments ?? 1) > 1))
  const reversal = (candidate.summary.refunded ?? 0) > 0
    || ['refunded', 'charged_back', 'in_mediation'].includes(candidate.operation.statusDetail ?? '')
    || ['refunded', 'charged_back', 'in_mediation'].includes(candidate.operation.status ?? '')
  return !forbiddenFinancialType && !reversal && candidate.balanceImpact.observed && candidate.balanceImpact.effect === 'debit' && typeof amount === 'number' && Number.isFinite(amount) && amount !== 0 && amount < 0 && (candidate.balanceImpact.amount.currency === 'ARS' || candidate.balanceImpact.amount.currency === 'USD') && Boolean(occurredAt && Number.isFinite(Date.parse(occurredAt)))
}

export function expectedObservations(candidate: ReconciledMercadoPagoMovement) {
  return [...candidate.evidence].sort((a, b) => (a.id ?? '').localeCompare(b.id ?? '')).map((observation) => ({ id: observation.id, source: observation.source, native_key: observation.nativeKey ?? observation.nativeId, last_seen_at: observation.lastSeenAt }))
}

export { sha256 }
