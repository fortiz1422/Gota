import { createHash } from 'node:crypto'
import { getMercadoPagoMovementObservations } from './server-repository'
import { readMercadoPagoDecisionHistory, previousDecisionFor } from './decision-history'
import { normalizeMercadoPagoMovement } from './provider-movement'
import { reconcileMercadoPagoMovements, observationFingerprint } from './reconciliation'
import { toFinancialEvent } from './financial-event'
import { decideProviderEvent } from './posting-decision'
import { backgroundDatabase } from './sync-lease'

export async function runMercadoPagoShadow(userId: string, connectionId: string, providerUserId: string, accountId: string | null) {
  const observations = await getMercadoPagoMovementObservations(userId, connectionId, 100)
  const history = await readMercadoPagoDecisionHistory(userId, connectionId)
  const candidates = reconcileMercadoPagoMovements(observations.map(o => {
    const movement = normalizeMercadoPagoMovement({ source: o.source, payload: o.payload, providerUserId, nativeKey: o.native_key })
    return { id: o.id, source: o.source, nativeId: movement.nativeId, nativeKey: o.native_key, lastSeenAt: o.last_seen_at, movement }
  }))
  const rows = candidates.map(c => {
    const fingerprint = createHash('sha256').update(c.evidence.map(observationFingerprint).sort().join('|')).digest('hex')
    const previous = previousDecisionFor(c, history)
    const decision = decideProviderEvent(toFinancialEvent(c), { linkedAccountId: accountId, alreadyPosted: previous === 'confirmed', alreadyDismissed: previous === 'dismissed', possibleLedgerDuplicate: false, ledgerDedupeChecked: false })
    return { user_id: userId, connection_id: connectionId, candidate_id: c.candidateId, candidate_fingerprint: fingerprint, rule_version: decision.ruleVersion, decision: decision.decision, reasons: decision.reasons, evaluated_at: new Date().toISOString() }
  })
  // Bounded writes. No raw payload or tokens duplicated into the decision audit.
  for (let offset = 0; offset < rows.length; offset += 100) {
    const { error } = await backgroundDatabase().from('mercadopago_shadow_decisions').upsert(rows.slice(offset, offset + 100), { onConflict: 'user_id,connection_id,candidate_id,candidate_fingerprint,rule_version' })
    if (error) throw new Error('shadow_persist_failed')
  }
  return rows.length
}
