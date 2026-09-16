import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMercadoPagoConnection, getMercadoPagoMovementObservations, getMercadoPagoMovementReviews } from '@/lib/mercadopago/server-repository'
import { reconstructMercadoPagoCandidates, publicMercadoPagoMovement } from '@/lib/mercadopago/confirm-expense'

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
    const reviews = await getMercadoPagoMovementReviews(user.id, connection.id)
    const byCandidate = new Map(reviews.map((review) => [review.candidate_id, review]))
    return response({ aggregates: reconciled.aggregates, movements: reconciled.map((candidate) => publicMercadoPagoMovement(candidate, byCandidate.get(candidate.candidateId) ?? null)) })
  } catch { return response({ error: 'movements_unavailable' }, 500) }
}
