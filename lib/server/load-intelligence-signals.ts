import { buildSignalCenter, type SignalCenterModel } from '@/lib/intelligence/signal-center'
import { loadFinancialSnapshot } from '@/lib/intelligence/snapshot'
import type { FinancialSnapshot } from '@/lib/intelligence/types'
import { createSignalOccurrenceIdentity } from '@/lib/server/signal-occurrence-key'
import type { createClient } from '@/lib/supabase/server'
import { readWorkspaces, reconciliationEnabled } from '@/lib/reconciliation/repository'
import { balanceCheckTask } from '@/lib/reconciliation/tasks'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

type LoadIntelligenceSignalsParams = {
  supabase: SupabaseClient
  userId: string
}

type LoadIntelligenceSignalsDependencies = {
  loadSnapshot?: (params: LoadIntelligenceSignalsParams) => Promise<FinancialSnapshot>
  now?: () => Date
}

/**
 * Carga y compone el Signals Center actual sin persistir lifecycle ni eventos.
 * Las dependencias opcionales mantienen el camino de producción simple y hacen
 * explícitos el snapshot único y el reloj en tests.
 */
export async function loadIntelligenceSignals(
  params: LoadIntelligenceSignalsParams,
  dependencies: LoadIntelligenceSignalsDependencies = {},
): Promise<SignalCenterModel> {
  const loadSnapshot = dependencies.loadSnapshot ?? loadFinancialSnapshot
  const now = dependencies.now ?? (() => new Date())
  const snapshot = await loadSnapshot(params)

  const model = buildSignalCenter(
    snapshot,
    (candidate) => createSignalOccurrenceIdentity(params.userId, candidate),
    { generatedAt: now().toISOString() },
  )
  if (reconciliationEnabled() && process.env.BALANCE_RECONCILIATION_SCHEMA_READY === 'true') {
    const { data: accounts, error } = await params.supabase.from('accounts').select('id,name').eq('user_id', params.userId).eq('archived', false)
    if (error) throw new Error('reconciliation_accounts_unavailable')
    const workspaces = await readWorkspaces(params.userId)
    model.balanceChecks = (accounts ?? []).flatMap(account => {
      const row = workspaces.find(w => w.account_id === account.id && w.currency === snapshot.currency)
      const task = balanceCheckTask(account, snapshot.currency, row?.state ?? null, now())
      return task ? [task] : []
    })
  }
  return model
}
