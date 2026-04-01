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
import type { InsightResult } from '@/lib/heroEngine'
import { computeMetrics } from '@/lib/analytics/computeMetrics'
import type { Metrics, HabitosDayEntry } from '@/lib/analytics/computeMetrics'
import type { CompromisosData } from '@/lib/analytics/computeCompromisos'
import type { Expense, Card, Subscription } from '@/types/database'

type Tab = 'diario' | 'analisis'
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
  const [activeTab, setActiveTab] = useState<Tab>('diario')
  const [soloPercibidos, setSoloPercibidos] = useState(false)
  const [drill, setDrill] = useState<Drill | null>(null)
  const [selDay, setSelDay] = useState<HabitosDayEntry | null>(null)
  const [hero, setHero] = useState<InsightResult | null>(null)

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

  function handleTabChange(t: Tab) {
    setActiveTab(t)
    setDrill(null)
    setSelDay(null)
  }

  return (
    <div>
      {/* Top row: period selector + toggle pill (or back button when drilling) */}
      {drill !== null ? (
        <div className="flex items-center gap-3 px-5 pt-5 mb-4">
          <button
            onClick={() => handleSetDrill(null)}
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(255,255,255,0.38)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.70)',
            }}
          >
            <CaretLeft weight="bold" size={18} className="text-text-primary" />
          </button>
          <h2 className="type-month text-text-primary">{drillTitles[drill]}</h2>
        </div>
      ) : (
        <div className="flex items-center justify-between px-5 pt-5 mb-4">
          <DashboardHeader
            month={selectedMonth}
            basePath="/analytics"
            earliestDataMonth={earliestDataMonth}
            className=""
          />
          <div
            className="p-1 flex"
            style={{
              background: 'rgba(255,255,255,0.50)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.70)',
              borderRadius: 12,
            }}
          >
            <button
              onClick={() => handleTabChange('diario')}
              className={`px-3 py-1.5 type-meta transition-colors ${
                activeTab === 'diario'
                  ? 'font-semibold text-white'
                  : 'bg-transparent text-[#4A6070]'
              }`}
              style={
                activeTab === 'diario'
                  ? { background: '#0D1829', borderRadius: 9 }
                  : undefined
              }
            >
              Diario
            </button>
            <button
              onClick={() => handleTabChange('analisis')}
              className={`px-3 py-1.5 type-meta transition-colors ${
                activeTab === 'analisis'
                  ? 'font-semibold text-white'
                  : 'bg-transparent text-[#4A6070]'
              }`}
              style={
                activeTab === 'analisis'
                  ? { background: '#0D1829', borderRadius: 9 }
                  : undefined
              }
            >
              Análisis
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {activeTab === 'diario' ? (
        <>
          {hero ? (
            <TitularHero titular={hero.titular} sentiment={hero.sentiment} />
          ) : (
            /* Skeleton while engine initializes */
            <div className="px-5 pt-4 pb-2">
              <div className="h-7 w-3/4 rounded-lg bg-bg-tertiary animate-pulse" />
              <div className="h-7 w-1/2 rounded-lg bg-bg-tertiary animate-pulse mt-2" />
            </div>
          )}

          {!metrics.esPrimerosDias && (
            <>
              {hero && <InsightChips chips={hero.chips} />}

              {!metrics.hasIngreso && (
                <div className="bg-warning/10 border border-warning/20 rounded-card px-4 py-3 mx-5 mb-3">
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
                  <div className="flex items-center justify-between mb-3">
                    <p className="type-label text-text-label">ESTE MES GASTASTE EN</p>
                    <button
                      onClick={() => { setSoloPercibidos(!soloPercibidos); setExpanded(false) }}
                      className="flex items-center gap-1.5"
                      aria-pressed={soloPercibidos}
                    >
                      <span
                        className="text-[11px] font-medium transition-colors"
                        style={{ color: soloPercibidos ? '#2178A8' : '#90A4B0' }}
                      >
                        Solo percibidos
                      </span>
                      {/* Track */}
                      <span
                        className="relative inline-flex shrink-0 rounded-full transition-colors duration-200"
                        style={{
                          width: 28,
                          height: 16,
                          backgroundColor: soloPercibidos ? '#2178A8' : '#C8D6DF',
                        }}
                      >
                        {/* Thumb */}
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
                    <div className="flex justify-center mt-2 mb-4">
                      <button
                        onClick={() => setExpanded(!expanded)}
                        className="glass-1 border border-border-ocean rounded-full px-3 py-1.5 type-meta text-text-secondary"
                      >
                        {expanded
                          ? 'Ver menos'
                          : `Ver todas (${displayCategorias.length})`}
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

      {/* Export button — visible when not drilling */}
      {drill === null && (
        <div className="px-5 pt-4 pb-2">
          <a
            href="/api/export"
            download
            className="flex w-full items-center justify-center gap-2 rounded-button py-3 type-meta text-text-tertiary hover:text-text-secondary transition-colors"
          >
            <ArrowLineDown weight="duotone" size={14} />
            Exportar gastos (CSV)
          </a>
        </div>
      )}
    </div>
  )
}
