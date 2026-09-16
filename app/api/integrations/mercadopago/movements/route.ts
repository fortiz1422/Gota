import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeMercadoPagoMovement } from '@/lib/mercadopago/provider-movement'
import { getMercadoPagoConnection, getMercadoPagoMovementObservations } from '@/lib/mercadopago/server-repository'
import { reconcileMercadoPagoMovements } from '@/lib/mercadopago/reconciliation'

const headers = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' }
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers })
const emptyAggregates = () => ({ total: 0, observations: 0, crossSourceMatches: 0, paymentOnly: 0, balanceOnly: 0, income: 0, expense: 0, transfer: 0, neutral: 0, unknown: 0, partial: 0, confirmed: 0 })

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return response({ error: 'unauthorized' }, 401)

  const connection = await getMercadoPagoConnection(user.id)
  if (!connection) return response({ aggregates: emptyAggregates(), movements: [] })
  const observations = await getMercadoPagoMovementObservations(user.id, connection.id, 100)
  const reconciled = reconcileMercadoPagoMovements(observations.map((observation) => ({
    source: observation.source,
    nativeId: observation.native_key?.trim() || null,
    lastSeenAt: observation.last_seen_at,
    movement: normalizeMercadoPagoMovement({ source: observation.source, payload: observation.payload, providerUserId: connection.provider_user_id ?? '', nativeKey: observation.native_key }),
  })))
  return response({ aggregates: reconciled.aggregates, movements: reconciled })
}
