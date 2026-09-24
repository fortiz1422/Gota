import { createHash } from 'node:crypto'
import { normalizeMercadoPagoMovement } from './provider-movement'
import { reconcileMercadoPagoMovements, type ReconciledMercadoPagoMovement, type ReconciliationObservation } from './reconciliation'
import type { MercadoPagoConnection, MercadoPagoMovementObservation } from './server-repository'

const stableJson = (value: unknown) => JSON.stringify(value)
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export function candidateFingerprint(candidate: { evidence: Array<{ source: string; native_key?: string | null; last_seen_at?: string; movement: unknown }> }) {
  return sha256(stableJson(candidate.evidence.map((evidence) => [evidence.source, evidence.native_key ?? null, evidence.movement]).sort((a, b) => stableJson(a).localeCompare(stableJson(b)))))
}

export function buildCanonicalSemantics() {
  return { classification: 'human_confirmed_expense', provider_effect: 'balance_debit' } as const
}

export function buildConfirmationIntentHash(input: { description: string; category: string; isWant: boolean; cardId?: string; installments?: number }) {
  return sha256(stableJson({ description: input.description.trim(), category: input.category, isWant: input.isWant, ...(input.cardId ? { cardId: input.cardId, installments: input.installments ?? null } : {}) }))
}

export function isEligibleCreditCardPurchase(candidate: Pick<ReconciledMercadoPagoMovement, 'kind' | 'direction' | 'accountRole' | 'operation' | 'fundingSource' | 'amount' | 'occurredAt' | 'installments' | 'summary'>) {
  return candidate.kind === 'expense' && candidate.direction === 'outflow' && candidate.accountRole === 'payer'
    && ['regular_payment', 'recurring_payment'].includes(candidate.operation.type ?? '')
    && candidate.operation.status === 'approved' && !['charged_back', 'in_mediation', 'refunded'].includes(candidate.operation.statusDetail ?? '') && candidate.fundingSource.kind === 'card'
    && candidate.fundingSource.cardType === 'credit' && typeof candidate.amount.value === 'number'
    && Number.isFinite(candidate.amount.value) && candidate.amount.value > 0
    && ['ARS', 'USD'].includes(candidate.amount.currency ?? '')
    && Boolean(candidate.occurredAt && Number.isFinite(Date.parse(candidate.occurredAt)))
    && (candidate.summary.refunded === null || candidate.summary.refunded === 0) && candidate.installments === 1
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

export function publicMercadoPagoMovement(candidate: ReconciledMercadoPagoMovement, review?: { status: 'confirmed'; expense_id: string } | { status: 'dismissed' } | null) {
  const { evidence, settlement, nativeId, reasonCodes, accountRole, ...visible } = candidate
  void evidence; void settlement; void nativeId; void reasonCodes; void accountRole
  if (visible.fundingSource && 'issuerId' in visible.fundingSource) {
    const { issuerId, ...fundingSource } = visible.fundingSource
    void issuerId
    visible.fundingSource = fundingSource
  }
  return {
    ...visible,
    cardPurchaseEligible: isEligibleCreditCardPurchase(candidate),
    cardType: candidate.fundingSource.cardType ?? null,
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
  return candidate.balanceImpact.observed && candidate.balanceImpact.effect === 'debit' && typeof amount === 'number' && Number.isFinite(amount) && amount !== 0 && amount < 0 && (candidate.balanceImpact.amount.currency === 'ARS' || candidate.balanceImpact.amount.currency === 'USD') && Boolean(occurredAt && Number.isFinite(Date.parse(occurredAt)))
}

export function expectedObservations(candidate: ReconciledMercadoPagoMovement) {
  return [...candidate.evidence].sort((a, b) => (a.id ?? '').localeCompare(b.id ?? '')).map((observation) => ({ id: observation.id, source: observation.source, native_key: observation.nativeKey ?? observation.nativeId, last_seen_at: observation.lastSeenAt }))
}

export { sha256 }
