import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeMercadoPagoMovement, type NormalizedMercadoPagoMovement } from '@/lib/mercadopago/provider-movement'
import { getMercadoPagoConnection, getMercadoPagoMovementObservations } from '@/lib/mercadopago/server-repository'

const headers = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' }
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers })
const emptyAggregates = () => ({ total: 0, income: 0, expense: 0, transfer: 0, neutral: 0, unknown: 0, partial: 0, confirmed: 0 })

function aggregates(movements: NormalizedMercadoPagoMovement[]) {
  const result = emptyAggregates()
  result.total = movements.length
  for (const movement of movements) {
    result[movement.kind] += 1
    result[movement.confidence] += 1
  }
  return result
}

function newestFirst(left: NormalizedMercadoPagoMovement, right: NormalizedMercadoPagoMovement) {
  const timestamp = (occurredAt: string | null) => {
    const value = occurredAt ? Date.parse(occurredAt) : Number.NEGATIVE_INFINITY
    return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY
  }
  const leftTime = timestamp(left.occurredAt)
  const rightTime = timestamp(right.occurredAt)
  if (leftTime !== rightTime) return rightTime - leftTime
  const leftId = left.nativeId ?? ''
  const rightId = right.nativeId ?? ''
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return response({ error: 'unauthorized' }, 401)

  const connection = await getMercadoPagoConnection(user.id)
  if (!connection) return response({ aggregates: emptyAggregates(), movements: [] })
  const observations = await getMercadoPagoMovementObservations(user.id, connection.id, 100)
  const movements = observations.map((observation) => normalizeMercadoPagoMovement({ source: observation.source, payload: observation.payload, providerUserId: connection.provider_user_id ?? '', nativeKey: observation.native_key })).sort(newestFirst)
  return response({ aggregates: aggregates(movements), movements })
}
