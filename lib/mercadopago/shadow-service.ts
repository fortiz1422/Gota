import { getMercadoPagoMovementObservations } from './server-repository'
import { readMercadoPagoDecisionHistory, previousDecisionFor } from './decision-history'
import { normalizeMercadoPagoMovement } from './provider-movement'
import { reconcileMercadoPagoMovements } from './reconciliation'
import { toFinancialEvent } from './financial-event'
import { decideProviderEvent } from './posting-decision'
import { backgroundDatabase } from './sync-lease'
import { checkMercadoPagoLedgerDuplicate } from './ledger-matcher-repository'
import { candidateFingerprint } from './confirm-expense'

export async function runMercadoPagoShadow(userId: string, connectionId: string, providerUserId: string, accountId: string | null) {
  const observations = await getMercadoPagoMovementObservations(userId, connectionId, 100)
  const history = await readMercadoPagoDecisionHistory(userId, connectionId)
  const candidates = reconcileMercadoPagoMovements(observations.map(o => {
    const movement = normalizeMercadoPagoMovement({ source: o.source, payload: o.payload, providerUserId, nativeKey: o.native_key })
    return { id: o.id, source: o.source, nativeId: movement.nativeId, nativeKey: o.native_key, lastSeenAt: o.last_seen_at, movement }
  }))
  const rows = []
  const database = backgroundDatabase()
  // Sequential bounded reads avoid a request burst for large backfills.
  for (const c of candidates) {
    const fingerprint = candidateFingerprint(c)
    const previous = previousDecisionFor(c, history)
    const event = toFinancialEvent(c)
    const duplicate = previous ? { checked: false, matches: [] } : await checkMercadoPagoLedgerDuplicate(database, userId, event, accountId)
    const decision = decideProviderEvent(event, { linkedAccountId: accountId, alreadyPosted: previous === 'confirmed', alreadyDismissed: previous === 'dismissed', possibleLedgerDuplicate: duplicate.matches.length > 0, ledgerDedupeChecked: duplicate.checked })
    rows.push({ user_id: userId, connection_id: connectionId, candidate_id: c.candidateId, candidate_fingerprint: fingerprint, rule_version: decision.ruleVersion, decision: decision.decision, reasons: decision.reasons, evaluated_at: new Date().toISOString() })
  }
  // Bounded writes. No raw payload or tokens duplicated into the decision audit.
  for (let offset = 0; offset < rows.length; offset += 100) {
    const { error } = await database.from('mercadopago_shadow_decisions').upsert(rows.slice(offset, offset + 100), { onConflict: 'user_id,connection_id,candidate_id,candidate_fingerprint,rule_version' })
    if (error) throw new Error('shadow_persist_failed')
  }
  return rows.length
}
