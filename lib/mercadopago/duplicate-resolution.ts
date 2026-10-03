import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReconciledMercadoPagoMovement } from './reconciliation'
import { toFinancialEvent } from './financial-event'
import { ledgerMatchWindow } from './ledger-matcher'
import { checkMercadoPagoLedgerDuplicate } from './ledger-matcher-repository'

export type DuplicateExpenseSnapshot = { id: string; amount: number; currency: string; date: string; description: string; category: string; is_want: boolean; account_id: string | null; payment_method: string }
export async function readMercadoPagoDuplicateSnapshot(database: SupabaseClient, userId: string, candidate: ReconciledMercadoPagoMovement, accountId: string | null) {
  const event = { ...toFinancialEvent(candidate), economicType: 'expense' as const, funding: 'mp_balance' as const,
    amount: { value: Math.abs(candidate.balanceImpact.amount.value!), currency: candidate.balanceImpact.amount.currency }, occurredAt: candidate.balanceOccurredAt }
  const check = await checkMercadoPagoLedgerDuplicate(database, userId, event, accountId)
  if (!check.checked) throw new Error('dedupe_unavailable')
  let rows: DuplicateExpenseSnapshot[] = []
  if (check.matches.length) {
    const ids = check.matches.map(match => match.expenseId).sort()
    const { data, error, count } = await database.from('expenses').select('id,amount,currency,date,description,category,is_want,account_id,payment_method', { count: 'exact' })
      .eq('user_id', userId).in('id', ids).order('id')
    if (error || !data || count !== ids.length || data.length !== ids.length) throw new Error('dedupe_unavailable')
    rows = data.map(row => ({ ...row, date: row.date.slice(0,10) })) as DuplicateExpenseSnapshot[]
  }
  const fingerprint = createHash('sha256').update(JSON.stringify(rows)).digest('hex')
  return { rows, fingerprint, window: ledgerMatchWindow(event) }
}
