import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMercadoPagoConnection, getMercadoPagoMovementObservations } from '@/lib/mercadopago/server-repository'
import { candidateFingerprint, eligibleMercadoPagoExpense, reconstructMercadoPagoCandidates } from '@/lib/mercadopago/confirm-expense'
import { readMercadoPagoDuplicateSnapshot } from '@/lib/mercadopago/duplicate-resolution'
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
export async function GET(_request: Request, { params }: { params: Promise<{ candidateId: string }> }) {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)
  if (process.env.MERCADOPAGO_POSTING_ENABLED !== 'true') return json({ error: 'resolution_not_enabled' }, 503)
  try {
    const connection = await getMercadoPagoConnection(user.id)
    if (!connection) return json({ error: 'not_found' }, 404)
    const { candidateId } = await params
    const observations = await getMercadoPagoMovementObservations(user.id, connection.id, 100)
    const candidate = reconstructMercadoPagoCandidates(connection, observations).find(item => item.candidateId === candidateId)
    if (!candidate || !eligibleMercadoPagoExpense(candidate)) return json({ error: 'ineligible' }, 422)
    const result = await readMercadoPagoDuplicateSnapshot(createAdminClient(), user.id, candidate, connection.linked_account_id)
    return json({ expenses: result.rows, fingerprint: result.fingerprint, candidateFingerprint: candidateFingerprint(candidate) })
  } catch { return json({ error: 'dedupe_unavailable' }, 503) }
}
