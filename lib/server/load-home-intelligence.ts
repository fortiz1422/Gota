import { FF_HOME_AMBIENT_INTELLIGENCE_V1, FF_INTELLIGENCE_LIFECYCLE_V1 } from '@/lib/flags'
import { buildHomeIntelligence } from '@/lib/intelligence/home-orchestrator'
import type { HomeIntelligenceModel } from '@/lib/intelligence/home-model'
import {
  computeLifecycleSuppressions,
  type InsightEventRow,
} from '@/lib/intelligence/insight-lifecycle'
import { loadFinancialSnapshot } from '@/lib/intelligence/snapshot'
import { captureRouteError } from '@/lib/observability/sentry'
import type { createClient } from '@/lib/supabase/server'
import type { DashboardApiData } from './dashboard-queries'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/**
 * Adjunta el modelo ambiental al payload del dashboard (guía §19): reusa el
 * dashboard ya resuelto (sin repetir sus queries) y nunca rompe la carga del
 * Home — ante cualquier error devuelve null y el Home queda como está.
 */
export async function loadHomeIntelligence(params: {
  supabase: SupabaseClient
  userId: string
  dashboard: DashboardApiData
  valuationRate?: number | null
}): Promise<HomeIntelligenceModel | null> {
  if (!FF_HOME_AMBIENT_INTELLIGENCE_V1) return null
  const { supabase, userId, dashboard } = params

  try {
    const [snapshot, lifecycle] = await Promise.all([
      loadFinancialSnapshot({
        supabase,
        userId,
        month: dashboard.selectedMonth,
        dashboard,
      }),
      loadLifecycleSuppressions(supabase, userId),
    ])
    // El masking se aplica en el cliente (maskHomeIntelligence): el payload
    // del dashboard ya viaja con montos, esto no expone nada nuevo.
    return buildHomeIntelligence(
      snapshot,
      {
        heroBalanceMode: dashboard.heroBalanceMode,
        viewCurrency: dashboard.viewCurrency,
        valuationRate: params.valuationRate ?? null,
        amountsVisible: true,
      },
      { lifecycle },
    )
  } catch (error) {
    captureRouteError(error, {
      route: 'loadHomeIntelligence',
      operation: 'home_intelligence',
    })
    return null
  }
}

/** Supresiones activas del lifecycle; sin flag (o sin tabla) no suprime nada. */
async function loadLifecycleSuppressions(supabase: SupabaseClient, userId: string) {
  const empty = { suppressedKeys: [], suppressedUnlessRiskKeys: [] }
  if (!FF_INTELLIGENCE_LIFECYCLE_V1) return empty
  const { data, error } = await supabase
    .from('insight_events')
    .select('dedupe_key, insight_kind, shown_count, dismissed_until, acted_at, resolved_at, feedback, last_status')
    .eq('user_id', userId)
  // Tabla ausente (migración no aplicada) u otro error: no bloquear el Home.
  if (error || !data) return empty
  return computeLifecycleSuppressions(data as InsightEventRow[], {
    now: new Date().toISOString(),
  })
}
