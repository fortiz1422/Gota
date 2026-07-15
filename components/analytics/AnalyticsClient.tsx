'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLineDown, CaretLeft, ChartLineUp, SquaresFour } from '@phosphor-icons/react'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { BlueHeaderZone } from '@/components/ui/BlueHeaderZone'
import { EmptyState } from '@/components/ui/EmptyState'
import { useIntelligenceHeroes } from '@/components/intelligence/IntelligenceHero'
import { getCurrentMonth } from '@/lib/dates'
import { FF_INTELLIGENCE } from '@/lib/flags'
import {
  resolveAnalysisPresentation,
  takeoverSubcopy,
} from '@/lib/intelligence/analysis-surface'
import { AnalysisView } from './AnalysisView'
import { AnalyticsEvolution } from './AnalyticsEvolution'
import { AnalyticsHero } from './AnalyticsHero'
import { AnalyticsModeToggle } from './AnalyticsModeToggle'
import { BudgetControlHero } from './BudgetControlHero'
import { BudgetsSection } from './BudgetsSection'
import { GoalsSection } from './GoalsSection'
import { CategoriaRow } from './CategoriaRow'
import { ExploreModal } from './ExploreModal'
import { AnalysisSectionTabs } from './AnalysisSectionTabs'
import { computeMetrics } from '@/lib/analytics/computeMetrics'
import {
  buildAnalyticsHref,
  type AnalyticsView,
} from '@/lib/analytics/analytics-route-state'
import type { BudgetSnapshot } from '@/lib/budgets/types'
import type { Metrics, HabitosDayEntry } from '@/lib/analytics/computeMetrics'
import type { CompromisosData } from '@/lib/analytics/computeCompromisos'
import {
  resolveAnalyticsEvolution,
  resolveAnalyticsHero,
  resolveAnalyticsMovers,
  type AnalyticsComparisonContext,
  type AnalyticsMode,
  type MonthlySeriesPoint,
} from '@/lib/analytics/analytics-overview'
import type { Card, Expense, Subscription } from '@/types/database'
import { CATEGORIES } from '@/lib/validation/schemas'
import { FF_ANALYTICS_WORKSPACE_V1 } from '@/lib/flags'

type Drill = 'estado_mes' | 'fuga' | 'habitos' | 'compromisos'

const drillTitles: Record<Drill, string> = {
  estado_mes: 'Estado del mes',
  fuga: 'Fuga Silenciosa',
  habitos: 'Mapa de Hábitos',
  compromisos: 'Compromisos',
}

interface Props {
  metrics: Metrics
  compromisos: CompromisosData
  rawExpenses: Expense[]
  subscriptions: Subscription[]
  cards: Card[]
  selectedMonth: string
  earliestDataMonth?: string
  monthlySeries: MonthlySeriesPoint[]
  comparisonContext: AnalyticsComparisonContext
  initialView: AnalyticsView
  initialDrill?: Drill | null
  budget: BudgetSnapshot
}

export function AnalyticsClient({
  metrics,
  compromisos,
  rawExpenses,
  selectedMonth,
  earliestDataMonth,
  monthlySeries,
  comparisonContext,
  initialView,
  initialDrill,
  budget,
}: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [mode, setMode] = useState<AnalyticsMode>('percibido_devengado')
  const [insightsOpen, setInsightsOpen] = useState(initialView === 'insights')
  const [legacyDrill, setLegacyDrill] = useState<Drill | null>(initialDrill ?? null)
  const [controlOpen, setControlOpen] = useState(initialView === 'budget')
  const [metasOpen, setMetasOpen] = useState(initialView === 'goals')
  const [exploreOpen, setExploreOpen] = useState(false)
  const [selDay, setSelDay] = useState<HabitosDayEntry | null>(null)

  const { currency } = metrics
  const isPercibido = mode === 'percibido'
  const workspaceEnabled = FF_ANALYTICS_WORKSPACE_V1
  const drill = workspaceEnabled ? initialDrill ?? null : legacyDrill
  const showInsights = workspaceEnabled ? initialView === 'insights' : insightsOpen
  const showControl = workspaceEnabled ? initialView === 'budget' : controlOpen
  const showMetas = workspaceEnabled ? initialView === 'goals' : metasOpen
  const hasCommitmentData =
    compromisos.hasCards ||
    compromisos.hasCreditExpenses ||
    compromisos.totalComprometido > 0

  const alertCount = budget.plan
    ? budget.summary.overBudgetCount + budget.summary.nearLimitCount
    : 0

  const displayCategorias = useMemo(() => {
    if (!isPercibido) return metrics.categorias
    const filtered = rawExpenses.filter((expense) => expense.payment_method !== 'CREDIT')
    return computeMetrics(filtered, metrics.ingresoMes, metrics.currency, selectedMonth).categorias
  }, [isPercibido, rawExpenses, metrics, selectedMonth])

  const visibleCategorias = expanded ? displayCategorias : displayCategorias.slice(0, 5)

  const hero = useMemo(
    () =>
      resolveAnalyticsHero({
        mode,
        monthlySeries,
        comparisonContext,
        metrics,
        compromisos,
      }),
    [mode, monthlySeries, comparisonContext, metrics, compromisos],
  )

  // Señales inteligentes: solo una señal risk toma el headline del hero azul.
  // Las demás no agregan elementos acá (llegan por el chat); same_day queda
  // fuera de esta superficie porque el hero azul ya narra gasto vs promedio.
  const isCurrentMonth = selectedMonth === getCurrentMonth()
  const { data: intelligence } = useIntelligenceHeroes(FF_INTELLIGENCE && isCurrentMonth)
  const { takeover } = useMemo(
    () => resolveAnalysisPresentation(intelligence?.heroes ?? []),
    [intelligence],
  )
  const displayHero = useMemo(() => {
    if (!takeover) return hero
    return {
      ...hero,
      headline: takeover.title,
      subcopy: takeoverSubcopy(takeover),
      driver: null,
      visualTone: 'warning' as const,
    }
  }, [hero, takeover])

  const evolution = useMemo(
    () =>
      resolveAnalyticsEvolution({
        mode,
        monthlySeries,
        comparisonContext,
      }),
    [mode, monthlySeries, comparisonContext],
  )

  const movers = useMemo(
    () =>
      resolveAnalyticsMovers({
        metrics,
        rows: displayCategorias,
        compromisos,
      }),
    [metrics, displayCategorias, compromisos],
  )

  function handleSetDrill(nextDrill: Drill | null) {
    if (nextDrill !== 'habitos') setSelDay(null)
    if (workspaceEnabled) {
      router.push(
        buildAnalyticsHref({
          month: selectedMonth,
          view: 'insights',
          drill: nextDrill,
        }),
      )
      return
    }
    setLegacyDrill(nextDrill)
  }

  function openInsights() {
    setInsightsOpen(true)
    setControlOpen(false)
  }

  function openControl() {
    setControlOpen(true)
    setInsightsOpen(false)
    setMetasOpen(false)
  }

  function openMetas() {
    setMetasOpen(true)
    setInsightsOpen(false)
    setControlOpen(false)
  }

  function closeSecondaryView() {
    setInsightsOpen(false)
    setControlOpen(false)
    setMetasOpen(false)
    handleSetDrill(null)
  }

  const isSecondaryView = !workspaceEnabled && (insightsOpen || controlOpen || metasOpen)

  return (
    <div className="bg-bg-primary">
      {/* ── Blue zone ── */}
      {workspaceEnabled ? (
        <BlueHeaderZone style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="flex items-center justify-between px-[22px] pt-4">
            <h1 className="text-[18px] font-extrabold tracking-[-0.01em] text-white">
              Análisis
              <span className="sr-only">
                {' — '}
                {initialView === 'summary'
                  ? 'Resumen'
                  : initialView === 'insights'
                    ? drill
                      ? drillTitles[drill]
                      : 'Insights'
                    : initialView === 'budget'
                      ? 'Presupuesto'
                      : 'Metas'}
              </span>
            </h1>
            <DashboardHeader
              month={selectedMonth}
              basePath="/analytics"
              earliestDataMonth={earliestDataMonth}
              className=""
              variant="in-header"
              preserveParams={{
                view: initialView === 'summary' ? undefined : initialView,
                drill: initialView === 'insights' ? initialDrill ?? undefined : undefined,
              }}
            />
          </div>
          {initialView === 'summary' ? (
            <AnalyticsHero hero={displayHero} currency={currency} variant="in-header" />
          ) : initialView === 'budget' ? (
            <BudgetControlHero
              summary={budget.summary}
              currency={currency}
              totalCategories={budget.items.length}
              planExists={budget.plan !== null}
            />
          ) : (
            <div className="px-[22px] pb-10 pt-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/65">
                {initialView === 'insights' ? 'Entender el mes' : 'Objetivos de ahorro'}
              </p>
              <h2 className="mt-1 text-[24px] font-extrabold tracking-[-0.02em] text-white">
                {initialView === 'insights'
                  ? drill
                    ? drillTitles[drill]
                    : 'Insights'
                  : 'Metas'}
              </h2>
            </div>
          )}
        </BlueHeaderZone>
      ) : isSecondaryView ? (
        controlOpen ? (
          <BlueHeaderZone style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="flex items-center justify-between px-[22px] pt-4">
              <button
                onClick={closeSecondaryView}
                className="header-glass flex items-center gap-1.5 rounded-pill px-3 py-1.5 transition-opacity hover:opacity-80 active:opacity-60"
              >
                <CaretLeft weight="bold" size={14} style={{ color: 'rgba(255,255,255,0.85)' }} />
                <span className="text-[14px] font-semibold text-white">Análisis</span>
              </button>
              <h2 className="text-[16px] font-bold text-white">Control</h2>
              <div className="h-9 w-9 shrink-0" />
            </div>
            <BudgetControlHero
              summary={budget.summary}
              currency={currency}
              totalCategories={budget.items.length}
              planExists={budget.plan !== null}
            />
          </BlueHeaderZone>
        ) : (
          <BlueHeaderZone style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="flex items-center justify-between px-[22px] pt-4 pb-8">
              <button
                onClick={closeSecondaryView}
                className="header-glass flex items-center gap-1.5 rounded-pill px-3 py-1.5 transition-opacity hover:opacity-80 active:opacity-60"
              >
                <CaretLeft weight="bold" size={14} style={{ color: 'rgba(255,255,255,0.85)' }} />
                <span className="text-[14px] font-semibold text-white">Análisis</span>
              </button>
              <h2 className="text-[16px] font-bold text-white">
                {insightsOpen
                  ? drill !== null
                    ? drillTitles[drill]
                    : 'Insights'
                  : 'Metas'}
              </h2>
            </div>
          </BlueHeaderZone>
        )
      ) : (
        <BlueHeaderZone style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="flex items-center justify-between px-[22px] pt-4">
            <DashboardHeader
              month={selectedMonth}
              basePath="/analytics"
              earliestDataMonth={earliestDataMonth}
              className=""
              variant="in-header"
            />
            <button
              onClick={() => setExploreOpen(true)}
              className="header-glass flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-80 active:opacity-60"
            >
              <SquaresFour weight="regular" size={14} style={{ color: 'rgba(255,255,255,0.85)' }} />
              Explorar
              {alertCount > 0 && (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
                  {alertCount}
                </span>
              )}
            </button>
          </div>
          <AnalyticsHero hero={displayHero} currency={currency} variant="in-header" />
        </BlueHeaderZone>
      )}

      {/* ── White zone ── */}
      <div
        className="relative"
        style={{
          marginTop: -24,
          paddingTop: isSecondaryView ? 16 : 0,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)',
        }}
      >
        {workspaceEnabled ? (
          <AnalysisSectionTabs
            active={initialView}
            month={selectedMonth}
            budgetAlertCount={alertCount}
          />
        ) : null}

        {showInsights ? (
          metrics.cantidadTransacciones === 0 && !hasCommitmentData ? (
            <div className="px-5 pt-4">
              <EmptyState
                icon={ChartLineUp}
                title="Todavía no hay patrones para mostrar"
                subtitle="Cuando registres movimientos, Gota va a encontrar hábitos y cambios en tu mes."
              />
            </div>
          ) : (
          <AnalysisView
            metrics={metrics}
            compromisos={compromisos}
            drill={drill}
            setDrill={handleSetDrill}
            selDay={selDay}
            setSelDay={setSelDay}
            selectedMonth={selectedMonth}
          />
          )
        ) : showControl ? (
          <BudgetsSection
            budget={budget}
            currency={currency}
            selectedMonth={selectedMonth}
            categories={[...CATEGORIES]}
          />
        ) : showMetas ? (
          <GoalsSection selectedMonth={selectedMonth} />
        ) : (
          <>
            <AnalyticsModeToggle
              mode={mode}
              onChange={(nextMode) => {
                setMode(nextMode)
                setExpanded(false)
              }}
            />

            <AnalyticsEvolution
              evolution={evolution}
              currency={currency}
              comparisonContext={comparisonContext}
            />

            {workspaceEnabled && metrics.cantidadTransacciones === 0 ? (
              <div className="mx-5 mt-4 rounded-card border border-primary/15 bg-primary/5 px-4 py-4">
                <h2 className="text-[15px] font-bold text-text-primary">
                  Tu análisis empieza con el primer movimiento
                </h2>
                <p className="mt-1 text-[13px] leading-5 text-text-secondary">
                  Registrá un gasto o ingreso para empezar a ver evolución, categorías y comparaciones.
                </p>
                <Link
                  href="/"
                  className="mt-3 inline-flex min-h-11 items-center text-[13px] font-bold text-primary"
                >
                  Registrar movimiento
                </Link>
              </div>
            ) : null}

            {!metrics.hasIngreso && (
              <div className="mx-5 mt-4 rounded-card border border-warning/20 bg-warning/10 px-4 py-3">
                <p className="type-meta text-text-primary">
                  Cargá tu ingreso del mes para ver métricas de ahorro.{' '}
                  <Link href="/settings" className="underline">
                    Ir a configuración
                  </Link>
                </p>
              </div>
            )}

            {displayCategorias.length > 0 && (
              <section className="mt-6 px-5">
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="type-title text-text-primary">Qué movió el mes</h3>
                  {movers.featuredInsight ? (
                    <span
                      className="ml-auto flex-shrink-0"
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--color-warning)',
                        background: 'var(--color-warning-soft)',
                        borderRadius: 20,
                        padding: '3px 8px',
                      }}
                    >
                      {movers.featuredInsight.label}
                    </span>
                  ) : null}
                </div>

                {visibleCategorias.map((cat, idx) => (
                  <div
                    key={cat.category}
                    className={idx >= 5 ? 'slide-up' : undefined}
                    style={idx >= 5 ? { animationDelay: `${(idx - 5) * 40}ms` } : undefined}
                  >
                    <CategoriaRow
                      cat={cat}
                      currency={currency}
                      mode={mode}
                      onClick={() =>
                        router.push(
                          `/movimientos?month=${selectedMonth}&categoria=${encodeURIComponent(cat.category)}&soloPercibidos=${isPercibido}`,
                        )
                      }
                    />
                  </div>
                ))}

                {displayCategorias.length > 5 && (
                  <div className="mb-4 mt-2 flex justify-center">
                    <button
                      onClick={() => setExpanded(!expanded)}
                      className="rounded-button border border-primary/20 px-3 py-1.5 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/5"
                    >
                      {expanded ? 'Ver menos' : `Ver todas (${displayCategorias.length})`}
                    </button>
                  </div>
                )}
              </section>
            )}

            <div className="px-5 pb-2 pt-4">
              <a
                href="/api/export"
                download
                className="flex w-full items-center justify-center gap-2 rounded-button py-3 type-meta text-text-tertiary transition-colors hover:text-text-secondary"
              >
                <ArrowLineDown weight="duotone" size={14} />
                Exportar gastos (CSV)
              </a>
            </div>
          </>
        )}
      </div>

      {!workspaceEnabled ? (
        <ExploreModal
          open={exploreOpen}
          alertCount={alertCount}
          onClose={() => setExploreOpen(false)}
          onInsights={openInsights}
          onPresupuesto={openControl}
          onMetas={openMetas}
        />
      ) : null}
    </div>
  )
}
