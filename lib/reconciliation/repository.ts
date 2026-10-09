import { createAdminClient } from '@/lib/supabase/admin'
import type { SupabaseClient } from '@supabase/supabase-js'
import { balanceCorrection, type Workspace } from './domain'
export type WorkspaceRow = {
  id: string
  user_id: string
  account_id: string
  currency: 'ARS' | 'USD'
  version: number
  state: Workspace
}
// Types are scoped here until the additive migration is applied and generated types refreshed.
function database() {
  return createAdminClient() as unknown as SupabaseClient
}
export const reconciliationEnabled = () =>
  process.env.BALANCE_RECONCILIATION_ENABLED === 'true'
export async function readWorkspaces(userId: string): Promise<WorkspaceRow[]> {
  const { data, error } = await database()
    .from('balance_reconciliation_workspaces')
    .select('*')
    .eq('user_id', userId)
  if (error) throw new Error('reconciliation_unavailable')
  return (data ?? []) as WorkspaceRow[]
}
export async function readReceipt(userId: string, requestId: string) {
  const { data, error } = await database()
    .from('balance_reconciliation_audit')
    .select('intent_hash')
    .eq('user_id', userId)
    .eq('request_id', requestId)
    .maybeSingle()
  if (error) throw new Error('reconciliation_unavailable')
  return data as { intent_hash: string } | null
}
export async function readCorrections(userId: string) {
  // Write rollout can be disabled; recognized money must never disappear on rollback.
  if (process.env.BALANCE_RECONCILIATION_SCHEMA_READY !== 'true') return []
  return (await readWorkspaces(userId))
    .map((row) => ({
      account_id: row.account_id,
      currency: row.currency,
      amount: balanceCorrection(row.state) / 100,
    }))
    .filter((row) => row.amount !== 0)
}
export async function ledgerSnapshot(
  userId: string
): Promise<{ fingerprint: string; movementIds: string[] }> {
  const { data, error } = await database().rpc(
    'balance_reconciliation_ledger_snapshot',
    { p_user_id: userId }
  )
  if (error || !data?.fingerprint) throw new Error('ledger_unavailable')
  return data
}
export async function saveWorkspace(input: {
  userId: string
  accountId: string
  currency: string
  version: number
  fingerprint: string
  requestId: string
  intentHash: string
  state: Workspace
  expense?: Record<string, unknown>
  income?: Record<string, unknown>
}) {
  const { data, error } = await database().rpc('save_balance_reconciliation', {
    p_user_id: input.userId,
    p_account_id: input.accountId,
    p_currency: input.currency,
    p_expected_version: input.version,
    p_ledger_fingerprint: input.fingerprint,
    p_request_id: input.requestId,
    p_intent_hash: input.intentHash,
    p_state: input.state,
    p_expense: input.expense ?? null,
    p_income: input.income ?? null,
  })
  if (error)
    throw new Error(error.code === '55000' ? 'state_changed' : 'save_failed')
  return data as WorkspaceRow
}
