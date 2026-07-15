import { buildSignalCenter, type SignalCenterModel } from '@/lib/intelligence/signal-center'
import { loadFinancialSnapshot } from '@/lib/intelligence/snapshot'
import type { FinancialSnapshot } from '@/lib/intelligence/types'
import { createSignalOccurrenceIdentity } from '@/lib/server/signal-occurrence-key'
import type { createClient } from '@/lib/supabase/server'

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

  return buildSignalCenter(
    snapshot,
    (candidate) => createSignalOccurrenceIdentity(params.userId, candidate),
    { generatedAt: now().toISOString() },
  )
}
