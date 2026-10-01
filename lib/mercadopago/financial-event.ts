import type { ReconciledMercadoPagoMovement } from './reconciliation'

/** Nullable fields retain missing provider evidence; scores are deterministic evidence flags, not probabilities. */
export type FinancialEvent = {
  provider: 'mercadopago'
  providerEventId: string | null
  candidateId: string
  occurredAt: string | null
  economicType: 'expense' | 'transfer' | 'refund' | 'card_payment' | 'income' | 'yield' | 'adjustment' | 'unknown'
  direction: 'inflow' | 'outflow' | 'internal' | 'none' | 'unknown'
  amount: { value: number | null; currency: string | null }
  funding: 'mp_balance' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'unknown'
  channel: 'qr' | 'checkout' | 'subscription' | 'transfer' | 'unknown'
  installments: number | null
  confidence: { economicType: number; funding: number; merchant: number; category: number }
  evidence: ReconciledMercadoPagoMovement
}

export function toFinancialEvent(candidate: ReconciledMercadoPagoMovement): FinancialEvent {
  const funding = candidate.fundingSource
  const refunded = candidate.summary.refunded
  // Preserve uncertainty; the existing normalizer does not establish refund/reversal semantics.
  const economicType = refunded !== null && refunded > 0 ? 'adjustment' : candidate.kind === 'neutral' ? 'unknown' : candidate.kind
  const direction = candidate.direction === 'neutral' ? 'none' : candidate.direction
  return {
    provider: 'mercadopago', providerEventId: candidate.nativeId, candidateId: candidate.candidateId,
    occurredAt: candidate.occurredAt, economicType, direction, amount: candidate.amount,
    funding: funding.kind === 'mercadopago_balance' ? 'mp_balance' : funding.kind === 'bank_transfer' ? 'bank_transfer' : funding.kind === 'card' && funding.cardType ? funding.cardType === 'credit' ? 'credit_card' : 'debit_card' : 'unknown',
    // INSTORE does not establish QR: retain unknown until real provider evidence validates it.
    channel: candidate.channel === 'CHECKOUT' ? 'checkout' : candidate.channel === 'SUBSCRIPTIONS' ? 'subscription' : candidate.channel === 'PSP_TRANSFER' ? 'transfer' : 'unknown',
    installments: candidate.installments,
    confidence: { economicType: candidate.confidence === 'confirmed' && economicType !== 'unknown' ? 1 : 0, funding: funding.kind !== 'unknown' ? 1 : 0, merchant: 0, category: 0 },
    evidence: candidate,
  }
}
