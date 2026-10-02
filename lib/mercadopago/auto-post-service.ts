import { getMercadoPagoMovementObservations, getMercadoPagoConnection } from './server-repository'
import { readMercadoPagoDecisionHistory, previousDecisionFor } from './decision-history'
import { reconstructMercadoPagoCandidates, candidateFingerprint, expectedObservations, sha256 } from './confirm-expense'
import { readMercadoPagoDuplicateSnapshot } from './duplicate-resolution'
import { toFinancialEvent } from './financial-event'
import { decideProviderEvent } from './posting-decision'
import { backgroundDatabase } from './sync-lease'
import { getArgentinaBusinessDate } from './review'

/** Phase C only. Two deployment flags + explicit connection opt-in + SQL guard.
 * No card, transfer, refund, unknown or duplicate can enter this path.
 */
export async function runMercadoPagoAutoPost(userId: string, connectionId: string) {
  if (process.env.MERCADOPAGO_AUTO_POST_ENABLED !== 'true' || process.env.MERCADOPAGO_POSTING_ENABLED !== 'true') return { posted: 0, state: 'disabled' as const }
  const database = backgroundDatabase()
  const { data: state, error } = await database.from('mercadopago_connections').select('auto_post_enabled').eq('user_id', userId).eq('id', connectionId).single()
  if (error) throw new Error('posting_state_unavailable')
  if (!state?.auto_post_enabled) return { posted: 0, state: 'disabled' as const }
  const connection = await getMercadoPagoConnection(userId)
  if (!connection || connection.id !== connectionId || connection.status !== 'connected' || !connection.linked_account_id) return { posted: 0, state: 'ineligible' as const }
  const history = await readMercadoPagoDecisionHistory(userId, connectionId)
  const observations = await getMercadoPagoMovementObservations(userId, connectionId, 100)
  const candidates = reconstructMercadoPagoCandidates(connection, observations)
  let posted = 0
  for (const candidate of candidates) {
    if (previousDecisionFor(candidate, history)) continue
    const event = toFinancialEvent(candidate)
    // Avoid ledger queries for financial classes that cannot be posted.
    if (event.economicType !== 'expense' || event.funding !== 'mp_balance') continue
    const duplicate = await readMercadoPagoDuplicateSnapshot(database, userId, candidate, connection.linked_account_id)
    const decision = decideProviderEvent(event, { linkedAccountId: connection.linked_account_id, alreadyPosted: false, possibleLedgerDuplicate: duplicate.rows.length > 0, ledgerDedupeChecked: true })
    if (decision.decision !== 'auto_post') continue
    const description = (candidate.description || candidate.statementDescriptor || 'Compra Mercado Pago').trim().slice(0,100)
    const { data, error: postingError } = await database.rpc('post_mercadopago_balance_event', {
      p_user_id: userId, p_connection_id: connectionId, p_candidate_id: candidate.candidateId,
      p_candidate_fingerprint: candidateFingerprint(candidate),
      p_intent_hash: sha256(JSON.stringify({ source: 'auto', rule: decision.ruleVersion, description, category: 'Otros' })),
      p_expected_observations: expectedObservations(candidate), p_amount: event.amount.value,
      p_currency: event.amount.currency, p_date: getArgentinaBusinessDate(candidate.balanceOccurredAt),
      p_category: 'Otros', p_description: description, p_is_want: false,
      p_expected_linked_account_id: connection.linked_account_id, p_expected_linked_account_version: connection.linked_account_version,
      p_evidence_kind: 'balance_debit_known', p_canonical_semantics: { classification: 'automatic_expense', provider_effect: 'balance_debit' },
      p_action: 'post', p_existing_expense_id: null, p_expected_duplicates: duplicate.rows, p_decision_source: 'auto', p_rule_version: decision.ruleVersion,
    })
    if (postingError || !data) {
      // Stale evidence/link/duplicate: preserve RAW for next shadow run, no fallback.
      if (postingError && ['55000','23505','P0002','40P01','40001'].includes(postingError.code)) continue
      throw new Error('automatic_posting_failed')
    }
    posted++
  }
  return { posted, state: 'completed' as const }
}
