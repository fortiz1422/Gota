'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLineDown, CaretLeft } from '@phosphor-icons/react'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { AnalysisView } from './AnalysisView'
import { AnalyticsEvolution } from './AnalyticsEvolution'
import { AnalyticsHero } from './AnalyticsHero'
import { AnalyticsModeToggle } from './AnalyticsModeToggle'
import { CategoriaRow } from './CategoriaRow'
import { computeMetrics } from '@/lib/analytics/computeMetrics'
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

type Drill = 'fuga' | 'habitos' | 'compromisos'

const drillTitles: Record<Drill, string> = {
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
}: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [mode, setMode] = useState<AnalyticsMode>('percibido_devengado')
  const [insightsOpen, setInsightsOpen] = useState(Boolean(initialDrill))
  const [drill, setDrill] = useState<Drill | null>(initialDrill ?? null)
  const [selDay, setSelDay] = useState<HabitosDayEntry | null>(null)

  const { currency } = metrics
  const isPercibido = mode === 'percibido'

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

  return (
    <div>
      {insightsOpen ? (
        <div className="mb-4 flex items-center justify-between px-5 pt-5">
          <button
            onClick={() => {
              setInsightsOpen(false)
              handleSetDrill(null)
            }}
            className="flex items-center gap-1 text-[15px] font-semibold text-primary"
          >
            <CaretLeft weight="bold" size={16} />
            Análisis
          </button>
          <h2 className="type-title text-text-primary">
            {drill !== null ? drillTitles[drill] : 'Insights'}
          </h2>
        </div>
      ) : (
        <div className="mb-4 flex items-center justify-between px-5 pt-5">
          <DashboardHeader
            month={selectedMonth}
            basePath="/analytics"
            earliestDataMonth={earliestDataMonth}
            className=""
          />
          <button
            onClick={() => setInsightsOpen(true)}
            className="rounded-pill border border-primary px-3 py-1.5 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/5"
          >
            Insights
          </button>
        </div>
      )}

      {!insightsOpen ? (
        <>
          <AnalyticsHero hero={hero} currency={currency} />

          <AnalyticsModeToggle
            mode={mode}
            onChange={(nextMode) => {
              setMode(nextMode)
              setExpanded(false)
            }}
          />

          <AnalyticsEvolution evolution={evolution} currency={currency} comparisonContext={comparisonContext} />

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
                <h3 className="type-title text-text-primary">
                  Qué movió el mes
                </h3>
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
        </>
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
      )}

      {!insightsOpen && (
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
      )}
    </div>
  )
}
