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

export function buildConfirmationIntentHash(input: { description: string; category: string; isWant: boolean; accountId: string }) {
  return sha256(stableJson({ description: input.description.trim(), category: input.category, isWant: input.isWant, accountId: input.accountId }))
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

export function publicMercadoPagoMovement(candidate: ReconciledMercadoPagoMovement, review?: { status: 'confirmed'; expense_id: string } | null) {
  const { evidence, settlement, nativeId, reasonCodes, ...visible } = candidate
  void evidence; void settlement; void nativeId; void reasonCodes
  if (visible.fundingSource && 'issuerId' in visible.fundingSource) {
    const { issuerId, ...fundingSource } = visible.fundingSource
    void issuerId
    visible.fundingSource = fundingSource
  }
  return { ...visible, reviewStatus: review?.status ?? 'pending', ...(review ? { expenseId: review.expense_id } : {}) }
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
