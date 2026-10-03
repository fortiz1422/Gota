import type { SupabaseClient } from '@supabase/supabase-js'
import type { FinancialEvent } from './financial-event'
import { ledgerMatchWindow, matchLedgerExpenses, type LedgerDuplicateCheck, type LedgerExpense } from './ledger-matcher'

const MAX_MATCH_ROWS = 100
/** Read-only and ownership-scoped even when called with the background client. */
export async function checkMercadoPagoLedgerDuplicate(database: SupabaseClient, userId: string, event: FinancialEvent, accountId: string | null): Promise<LedgerDuplicateCheck> {
  const unchecked: LedgerDuplicateCheck = { checked: false, matches: [] }
  const window = ledgerMatchWindow(event)
  if (!window || !matchLedgerExpenses(event, accountId, []).checked) return unchecked
  const exclusiveEnd = new Date(Date.parse(`${window.through}T00:00:00Z`) + 86400000).toISOString()
  try {
    const { data, error, count } = await database.from('expenses')
      .select('id, amount, currency, date, description, account_id, card_id, payment_method, is_legacy_card_payment', { count: 'exact' })
      .eq('user_id', userId).eq('amount', event.amount.value!).eq('currency', event.amount.currency!)
      .gte('date', `${window.from}T00:00:00Z`).lt('date', exclusiveEnd)
      .order('id', { ascending: true }).limit(MAX_MATCH_ROWS + 1)
    // Exact count also catches a server-side row cap below our requested limit.
    if (error || !data || count === null || count !== data.length || data.length > MAX_MATCH_ROWS) return unchecked
    return matchLedgerExpenses(event, accountId, data as LedgerExpense[])
  } catch {
    // Provider capture may continue, but incomplete dedupe must never enable posting.
    return unchecked
  }
}
