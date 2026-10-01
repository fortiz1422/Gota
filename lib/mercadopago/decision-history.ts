import type { ReconciledMercadoPagoMovement } from './reconciliation'
import { backgroundDatabase } from './sync-lease'

export type PreviousProviderDecision = { candidate_id: string; status: 'confirmed' | 'dismissed'; evidence: unknown }

/** Read the existing, owned snapshots; no dependency on optional production-only RPCs/tables. */
export async function readMercadoPagoDecisionHistory(userId: string, connectionId: string): Promise<PreviousProviderDecision[]> {
  const rows: PreviousProviderDecision[] = []
  for (const table of ['mercadopago_movement_reviews', 'mercadopago_movement_dismissals']) {
    let complete = false
    for (let page = 0; page < 100; page++) {
      const { data, error } = await backgroundDatabase().from(table).select('candidate_id,status,evidence')
        .eq('user_id', userId).eq('connection_id', connectionId).order('id').range(page * 100, page * 100 + 99)
      if (error || !data) throw new Error('decision_history_read_failed')
      rows.push(...data as PreviousProviderDecision[])
      if (data.length < 100) { complete = true; break }
    }
    if (!complete) throw new Error('decision_history_limit_exceeded')
  }
  return rows
}

function nativeKeys(evidence: unknown): Set<string> {
  if (!evidence || typeof evidence !== 'object' || !('observations' in evidence) || !Array.isArray(evidence.observations)) return new Set()
  return new Set(evidence.observations.flatMap(o => {
    const key = o && typeof o === 'object' ? o.native_key : null
    return typeof key === 'string' && key.trim() && !key.startsWith('sha256:') ? [key] : []
  }))
}

/** Candidate IDs change when Settlement arrives. Native keys in owned decision snapshots remain stable. */
export function previousDecisionFor(candidate: ReconciledMercadoPagoMovement, history: PreviousProviderDecision[]): 'confirmed' | 'dismissed' | null {
  const keys = new Set(candidate.evidence.map(e => e.nativeKey ?? e.nativeId).filter((k): k is string => Boolean(k) && !k!.startsWith('sha256:')))
  const matched = history.filter(row => row.candidate_id === candidate.candidateId || [...nativeKeys(row.evidence)].some(k => keys.has(k)))
  // Either prior action blocks a new posting; prefer the actual ledger write if both exist.
  return matched.some(row => row.status === 'confirmed') ? 'confirmed' : matched.some(row => row.status === 'dismissed') ? 'dismissed' : null
}
