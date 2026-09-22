import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMercadoPagoConnection, getMercadoPagoMovementObservations } from '@/lib/mercadopago/server-repository'
import { candidateFingerprint, expectedObservations, reconstructMercadoPagoCandidates } from '@/lib/mercadopago/confirm-expense'

const headers = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' }
const snapshotSchema = z.object({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  observations: z.array(z.object({
    id: z.string().uuid(), source: z.enum(['payments_search', 'account_settlement_report']),
    key: z.string().nullable(), seenAt: z.string(),
  }).strict()).min(1).max(10),
}).strict()
const bodySchema = z.object({
  candidates: z.array(z.object({ candidateId: z.string().regex(/^sha256:[a-f0-9]{64}$/), snapshot: snapshotSchema }).strict()).min(1).max(50),
}).strict()
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers })

export async function POST(request: Request) {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)
  let parsed: z.infer<typeof bodySchema>
  try { parsed = bodySchema.parse(await request.json()) } catch { return json({ error: 'invalid_bulk_dismissal' }, 422) }
  const ids = parsed.candidates.map((candidate) => candidate.candidateId)
  if (new Set(ids).size !== ids.length) return json({ error: 'duplicate_candidate_ids' }, 422)
  try {
    const connection = await getMercadoPagoConnection(user.id)
    if (!connection) return json({ error: 'not_found' }, 404)
    const observations = await getMercadoPagoMovementObservations(user.id, connection.id, 100)
    const byId = new Map(reconstructMercadoPagoCandidates(connection, observations).map((candidate) => [candidate.candidateId, candidate]))
    const candidates = parsed.candidates.map(({ candidateId, snapshot }) => {
      const expectedFromSnapshot = snapshot.observations.map((observation) => ({ id: observation.id, source: observation.source, native_key: observation.key, last_seen_at: observation.seenAt }))
      const candidate = byId.get(candidateId)
      if (!candidate) return { candidateId, fingerprint: snapshot.fingerprint, expectedObservations: expectedFromSnapshot, invalid: true }
      const expected = expectedObservations(candidate)
      const sameEvidence = JSON.stringify(expected) === JSON.stringify(expectedFromSnapshot)
      return { candidateId, fingerprint: snapshot.fingerprint, expectedObservations: expectedFromSnapshot, invalid: candidateFingerprint(candidate) !== snapshot.fingerprint || !sameEvidence }
    })
    const admin = createAdminClient() as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> }
    const { data, error } = await admin.rpc('dismiss_mercadopago_movements_bulk', {
      p_user_id: user.id, p_connection_id: connection.id, p_candidates: candidates,
    })
    if (error) return json({ error: 'bulk_dismissal_failed' }, 500)
    return json({ results: data ?? [] })
  } catch { return json({ error: 'bulk_dismissal_failed' }, 500) }
}
