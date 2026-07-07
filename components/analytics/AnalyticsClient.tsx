'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLineDown, CaretLeft, SquaresFour } from '@phosphor-icons/react'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { BlueHeaderZone } from '@/components/ui/BlueHeaderZone'
import {
  IntelligenceSignalChips,
  useIntelligenceHeroes,
} from '@/components/intelligence/IntelligenceHero'
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
import { computeMetrics } from '@/lib/analytics/computeMetrics'
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
  initialDrill,
  budget,
}: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [mode, setMode] = useState<AnalyticsMode>('percibido_devengado')
  const [insightsOpen, setInsightsOpen] = useState(Boolean(initialDrill))
  const [drill, setDrill] = useState<Drill | null>(initialDrill ?? null)
  const [controlOpen, setControlOpen] = useState(false)
  const [metasOpen, setMetasOpen] = useState(false)
  const [exploreOpen, setExploreOpen] = useState(false)
  const [selDay, setSelDay] = useState<HabitosDayEntry | null>(null)

  const { currency } = metrics
  const isPercibido = mode === 'percibido'

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

  // Señales inteligentes: una señal risk toma el headline del hero azul;
  // el resto se muestra como chips. same_day queda fuera (ya lo narra el hero).
  const isCurrentMonth = selectedMonth === getCurrentMonth()
  const { data: intelligence } = useIntelligenceHeroes(FF_INTELLIGENCE && isCurrentMonth)
  const { takeover, chips } = useMemo(
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
    setDrill(nextDrill)
    if (nextDrill !== 'habitos') setSelDay(null)
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

  const isSecondaryView = insightsOpen || controlOpen || metasOpen

  return (
    <div className="bg-bg-primary">
      {/* ── Blue zone ── */}
      {isSecondaryView ? (
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
        {insightsOpen ? (
          <AnalysisView
            metrics={metrics}
            compromisos={compromisos}
            drill={drill}
            setDrill={handleSetDrill}
            selDay={selDay}
            setSelDay={setSelDay}
            selectedMonth={selectedMonth}
          />
        ) : controlOpen ? (
          <BudgetsSection
            budget={budget}
            currency={currency}
            selectedMonth={selectedMonth}
            categories={[...CATEGORIES]}
          />
        ) : metasOpen ? (
          <GoalsSection selectedMonth={selectedMonth} />
        ) : (
          <>
            <IntelligenceSignalChips heroes={chips} />

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

      <ExploreModal
        open={exploreOpen}
        alertCount={alertCount}
        onClose={() => setExploreOpen(false)}
        onInsights={openInsights}
        onPresupuesto={openControl}
        onMetas={openMetas}
      />
    </div>
  )
}
