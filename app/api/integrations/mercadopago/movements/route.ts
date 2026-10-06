import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMercadoPagoConnection, getMercadoPagoMovementDismissals, getMercadoPagoMovementObservations, getMercadoPagoMovementReviews, getMercadoPagoOperationDecisions, getMercadoPagoShadowDecisions } from '@/lib/mercadopago/server-repository'
import { candidateFingerprint, getMercadoPagoOperationKey, reconstructMercadoPagoCandidates, publicMercadoPagoMovement } from '@/lib/mercadopago/confirm-expense'
import { MP_DECISION_RULE_VERSION } from '@/lib/mercadopago/posting-decision'

const headers = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' }
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers })
const emptyAggregates = () => ({ total: 0, observations: 0, crossSourceMatches: 0, paymentOnly: 0, balanceOnly: 0, income: 0, expense: 0, transfer: 0, neutral: 0, unknown: 0, partial: 0, confirmed: 0 })

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return response({ error: 'unauthorized' }, 401)
  try {
    const connection = await getMercadoPagoConnection(user.id)
    if (!connection) return response({ aggregates: emptyAggregates(), movements: [] })
    const observations = await getMercadoPagoMovementObservations(user.id, connection.id, 100)
    const reconciled = reconstructMercadoPagoCandidates(connection, observations)
    const [reviews, dismissals, operationDecisions, shadowDecisions] = await Promise.all([
      getMercadoPagoMovementReviews(user.id, connection.id),
      getMercadoPagoMovementDismissals(user.id, connection.id),
      getMercadoPagoOperationDecisions(user.id, connection.id),
      getMercadoPagoShadowDecisions(user.id, connection.id),
    ])
    type ProjectedReview = { status: 'confirmed'; expense_id: string } | { status: 'dismissed' }
    const byCandidate = new Map<string, ProjectedReview>([...reviews.map((review) => [review.candidate_id, review] as const), ...dismissals.map((dismissal) => [dismissal.candidate_id, dismissal] as const)])
    const byOperation = new Map<string, ProjectedReview>(operationDecisions.flatMap((decision) => {
      if (decision.status === 'confirmed' && decision.expense_id) return [[decision.operation_key, { status: 'confirmed' as const, expense_id: decision.expense_id }] as const]
      if (decision.status === 'dismissed') return [[decision.operation_key, { status: 'dismissed' as const }] as const]
      return []
    }))
    const duplicateFingerprints = new Set(shadowDecisions
      .filter((decision) => decision.rule_version === MP_DECISION_RULE_VERSION && decision.decision === 'review' && decision.reasons.includes('possible_ledger_duplicate'))
      .map((decision) => `${decision.candidate_id}:${decision.candidate_fingerprint}`))
    return response({ aggregates: reconciled.aggregates, movements: reconciled.map((candidate) => {
      const exactShadowKey = `${candidate.candidateId}:${candidateFingerprint(candidate)}`
      const operationKey = getMercadoPagoOperationKey(connection.id, candidate)
      const review = (operationKey ? byOperation.get(operationKey) : undefined) ?? byCandidate.get(candidate.candidateId) ?? null
      return publicMercadoPagoMovement(candidate, review, duplicateFingerprints.has(exactShadowKey) ? 'possible_duplicate' : null)
    }) })
  } catch { return response({ error: 'movements_unavailable' }, 500) }
}
