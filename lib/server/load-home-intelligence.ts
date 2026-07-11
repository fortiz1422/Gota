import { FF_HOME_AMBIENT_INTELLIGENCE_V1 } from '@/lib/flags'
import { buildHomeIntelligence } from '@/lib/intelligence/home-orchestrator'
import type { HomeIntelligenceModel } from '@/lib/intelligence/home-model'
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
    const snapshot = await loadFinancialSnapshot({
      supabase,
      userId,
      month: dashboard.selectedMonth,
      dashboard,
    })
    // El masking se aplica en el cliente (maskHomeIntelligence): el payload
    // del dashboard ya viaja con montos, esto no expone nada nuevo.
    return buildHomeIntelligence(snapshot, {
      heroBalanceMode: dashboard.heroBalanceMode,
      viewCurrency: dashboard.viewCurrency,
      valuationRate: params.valuationRate ?? null,
      amountsVisible: true,
    })
  } catch (error) {
    captureRouteError(error, {
      route: 'loadHomeIntelligence',
      operation: 'home_intelligence',
    })
    return null
  }
}
