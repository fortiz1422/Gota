import type { FinancialEvent } from './financial-event'

export const MP_DECISION_RULE_VERSION = 4
export type PostingDecision = {
  decision: 'auto_post' | 'review' | 'ignore' | 'wait_for_reconciliation'
  reasons: string[]
  ruleVersion: number
}
export type PostingContext = {
  linkedAccountId: string | null
  alreadyPosted: boolean
  alreadyDismissed?: boolean
  possibleLedgerDuplicate: boolean
  /** A completed search against manual/provider ledger entries is required. */
  ledgerDedupeChecked: boolean
}

/** Shadow policy only. This module never calls the ledger. */
export function decideProviderEvent(event: FinancialEvent, context: PostingContext): PostingDecision {
  const result = (decision: PostingDecision['decision'], reasons: string[]): PostingDecision => ({ decision, reasons, ruleVersion: MP_DECISION_RULE_VERSION })
  const c = event.evidence
  if (context.alreadyPosted) return result('ignore', ['already_posted'])
  if (context.alreadyDismissed) return result('ignore', ['already_dismissed'])
  if (c.kind === 'neutral' && c.operation.type === 'card_validation' && c.operation.status === 'approved' && c.amount.value === 0 && c.evidence.every(e => e.movement.amount.value === 0 && !(e.movement.summary.refunded! > 0))) return result('ignore', ['zero_card_validation'])
  const statuses = c.evidence.map(e => e.movement.operation.status).filter(Boolean)
  if (statuses.length > 0 && statuses.every(s => ['rejected', 'cancelled'].includes(s!))) return result('ignore', ['not_approved'])
  const reasons: string[] = []
  if (!event.providerEventId || event.providerEventId.startsWith('sha256:')) reasons.push('native_id_missing')
  if (event.economicType !== 'expense') reasons.push('economic_type_requires_review')
  if (c.accountRole !== 'payer') reasons.push('payer_unresolved')
  if (c.operation.status !== 'approved') reasons.push('approval_unresolved')
  if (event.funding !== 'mp_balance') reasons.push('funding_requires_review')
  if (!context.linkedAccountId) reasons.push('account_not_linked')
  if (event.amount.value === null || !Number.isFinite(event.amount.value) || event.amount.value <= 0) reasons.push('amount_invalid')
  if (!['ARS', 'USD'].includes(event.amount.currency ?? '')) reasons.push('currency_unresolved')
  if (!event.occurredAt || !Number.isFinite(Date.parse(event.occurredAt))) reasons.push('date_unresolved')
  if (c.balanceImpact.observed && (!c.balanceOccurredAt || !Number.isFinite(Date.parse(c.balanceOccurredAt)))) reasons.push('balance_date_unresolved')
  if (c.summary.refunded !== 0) reasons.push('refund_state_unresolved')
  if (!context.ledgerDedupeChecked) reasons.push('ledger_dedupe_pending')
  if (context.possibleLedgerDuplicate) reasons.push('possible_ledger_duplicate')
  // Every exact-ID source must agree on amount/currency/funding. Never mask provider conflicts.
  if (c.evidence.some(e => e.movement.amount.currency !== event.amount.currency || e.movement.amount.value === null || Math.abs(e.movement.amount.value) !== event.amount.value || e.movement.fundingSource.kind !== c.fundingSource.kind)) reasons.push('source_conflict')
  if (c.balanceImpact.observed && (c.balanceImpact.effect !== 'debit' || c.balanceImpact.amount.currency !== event.amount.currency || c.balanceImpact.amount.value === null || Math.abs(c.balanceImpact.amount.value) !== event.amount.value)) reasons.push('balance_conflict')
  if (reasons.length) return result('review', reasons)
  if (!c.balanceImpact.observed) return result('wait_for_reconciliation', ['balance_effect_unverified'])
  return result('auto_post', ['approved_mp_balance_expense'])
}
