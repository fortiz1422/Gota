import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMercadoPagoConnection, getMercadoPagoMovementObservations } from '@/lib/mercadopago/server-repository'
import { candidateFingerprint, expectedObservations, reconstructMercadoPagoCandidates } from '@/lib/mercadopago/confirm-expense'

const headers = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' }
const json = (body: unknown, status: number) => NextResponse.json(body, { status, headers })
type Params = { params: Promise<{ candidateId: string }> }

export async function POST(request: Request, { params }: Params) {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)
  if ((await request.text()) !== '') return json({ error: 'invalid_dismissal' }, 422)
  try {
    const { candidateId } = await params
    if (!/^sha256:[a-f0-9]{64}$/.test(candidateId)) return json({ error: 'invalid_dismissal' }, 422)
    const connection = await getMercadoPagoConnection(user.id)
    if (!connection) return json({ error: 'not_found' }, 404)
    const observations = await getMercadoPagoMovementObservations(user.id, connection.id, 100)
    const candidate = reconstructMercadoPagoCandidates(connection, observations).find((item) => item.candidateId === candidateId)
    if (!candidate) return json({ error: 'not_found' }, 404)
    const admin = createAdminClient() as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: string | null; error: unknown }> }
    const { data, error } = await admin.rpc('dismiss_mercadopago_movement', {
      p_user_id: user.id,
      p_connection_id: connection.id,
      p_candidate_id: candidateId,
      p_candidate_fingerprint: candidateFingerprint(candidate),
      p_expected_observations: expectedObservations(candidate),
    })
    if (error || data !== 'dismissed') {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
      if (code === 'P0002') return json({ error: 'not_found' }, 404)
      if (code === '23505' || code === '55000') return json({ error: 'conflict' }, 409)
      if (code === '22023') return json({ error: 'invalid_dismissal' }, 422)
      return json({ error: 'dismissal_failed' }, 500)
    }
    return json({ status: 'dismissed' }, 200)
  } catch {
    return json({ error: 'dismissal_failed' }, 500)
  }
}
