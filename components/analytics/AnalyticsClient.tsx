'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLineDown, CaretLeft } from '@phosphor-icons/react'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { TitularHero } from './TitularHero'
import { InsightChips } from './InsightChips'
import { CategoriaRow } from './CategoriaRow'
import { AnalysisView } from './AnalysisView'
import { buildHeroOutput } from '@/lib/heroEngine'
import { readHeroCache } from '@/lib/heroEngine/cache'
import type { InsightResult } from '@/lib/heroEngine'
import { computeMetrics } from '@/lib/analytics/computeMetrics'
import type { Metrics, HabitosDayEntry } from '@/lib/analytics/computeMetrics'
import type { CompromisosData } from '@/lib/analytics/computeCompromisos'
import type { Expense, Card, Subscription } from '@/types/database'

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
}

export function AnalyticsClient({
  metrics,
  compromisos,
  rawExpenses,
  subscriptions,
  cards,
  selectedMonth,
  earliestDataMonth,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [soloPercibidos, setSoloPercibidos] = useState(false)
  const [insightsOpen, setInsightsOpen] = useState(false)
  const [drill, setDrill] = useState<Drill | null>(null)
  const [selDay, setSelDay] = useState<HabitosDayEntry | null>(null)
  const [hero, setHero] = useState<InsightResult | null>(() => {
    const cached = readHeroCache()
    return cached
      ? { titular: cached.titular, sentiment: cached.sentiment, chips: cached.chips }
      : null
  })

  useEffect(() => {
    const result = buildHeroOutput(metrics, rawExpenses, cards, subscriptions, compromisos)
    setHero(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth])

  const { currency } = metrics

  const displayCategorias = useMemo(() => {
    if (!soloPercibidos) return metrics.categorias
    const filtered = rawExpenses.filter((e) => e.payment_method !== 'CREDIT')
    return computeMetrics(filtered, metrics.ingresoMes, metrics.currency, selectedMonth).categorias
  }, [soloPercibidos, rawExpenses, metrics, selectedMonth])

  const visibleCategorias = expanded ? displayCategorias : displayCategorias.slice(0, 5)
  const maxCatTotal =
    displayCategorias.length > 0
      ? Math.max(...displayCategorias.map((c) => c.total))
      : 0

  function handleSetDrill(d: Drill | null) {
    setDrill(d)
    if (d !== 'habitos') setSelDay(null)
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
            Diario
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
          {hero ? (
            <TitularHero titular={hero.titular} sentiment={hero.sentiment} />
          ) : (
            <div className="px-5 pb-2 pt-4">
              <div className="mt-2 h-7 w-3/4 animate-pulse rounded-lg bg-bg-tertiary" />
              <div className="mt-2 h-7 w-1/2 animate-pulse rounded-lg bg-bg-tertiary" />
            </div>
          )}

          {!metrics.esPrimerosDias && (
            <>
              {hero && <InsightChips chips={hero.chips} />}

              {!metrics.hasIngreso && (
                <div className="mx-5 mb-3 rounded-card border border-warning/20 bg-warning/10 px-4 py-3">
                  <p className="type-meta text-text-primary">
                    Cargá tu ingreso del mes para ver métricas de ahorro.{' '}
                    <Link href="/settings" className="underline">
                      Ir a configuración
                    </Link>
                  </p>
                </div>
              )}

              {displayCategorias.length > 0 && (
                <section className="mt-2 px-5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="type-label text-text-secondary">Este mes gastaste en</p>
                    <button
                      onClick={() => {
                        setSoloPercibidos(!soloPercibidos)
                        setExpanded(false)
                      }}
                      className="flex items-center gap-1.5"
                      aria-pressed={soloPercibidos}
                    >
                      <span
                        className="text-[11px] font-medium transition-colors"
                        style={{ color: soloPercibidos ? '#2178A8' : '#90A4B0' }}
                      >
                        Solo percibidos
                      </span>
                      <span
                        className="relative inline-flex shrink-0 rounded-full transition-colors duration-200"
                        style={{
                          width: 28,
                          height: 16,
                          backgroundColor: soloPercibidos ? '#2178A8' : '#C8D6DF',
                        }}
                      >
                        <span
                          className="absolute top-px rounded-full bg-white shadow transition-transform duration-200"
                          style={{
                            width: 14,
                            height: 14,
                            transform: soloPercibidos ? 'translateX(13px)' : 'translateX(1px)',
                          }}
                        />
                      </span>
                    </button>
                  </div>

                  {visibleCategorias.map((cat, idx) => (
                    <div
                      key={cat.category}
                      className={idx >= 5 ? 'slide-up' : undefined}
                      style={
                        idx >= 5 ? { animationDelay: `${(idx - 5) * 40}ms` } : undefined
                      }
                    >
                      <CategoriaRow cat={cat} currency={currency} maxTotal={maxCatTotal} />
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
