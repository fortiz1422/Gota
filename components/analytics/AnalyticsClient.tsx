'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLineDown, CaretLeft } from '@phosphor-icons/react'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { TitularHero } from './TitularHero'
import { InsightChips } from './InsightChips'
import { CategoriaRow } from './CategoriaRow'
import { AnalysisView } from './AnalysisView'
import type { Metrics, HabitosDayEntry } from '@/lib/analytics/computeMetrics'
import type { InsightResult } from '@/lib/analytics/insights'
import type { CompromisosData } from '@/lib/analytics/computeCompromisos'

type Tab = 'diario' | 'analisis'
type Drill = 'fuga' | 'habitos' | 'compromisos'

const drillTitles: Record<Drill, string> = {
  fuga: 'Fuga Silenciosa',
  habitos: 'Mapa de Hábitos',
  compromisos: 'Compromisos',
}

interface Props {
  metrics: Metrics
  insight: InsightResult
  compromisos: CompromisosData
  selectedMonth: string
  earliestDataMonth?: string
}

export function AnalyticsClient({ metrics, insight, compromisos, selectedMonth, earliestDataMonth }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('diario')
  const [drill, setDrill] = useState<Drill | null>(null)
  const [selDay, setSelDay] = useState<HabitosDayEntry | null>(null)

  const { currency } = metrics
  const visibleCategorias = expanded ? metrics.categorias : metrics.categorias.slice(0, 5)

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
            className="w-10 h-10 rounded-full bg-bg-tertiary border border-border-ocean flex items-center justify-center shrink-0"
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
          <div className="bg-bg-tertiary rounded-full p-[3px] flex border border-border-ocean">
            <button
              onClick={() => handleTabChange('diario')}
              className={`rounded-full px-3 py-1.5 type-meta transition-colors ${
                activeTab === 'diario'
                  ? 'bg-bg-secondary font-semibold text-text-primary'
                  : 'bg-transparent text-text-tertiary'
              }`}
            >
              Diario
            </button>
            <button
              onClick={() => handleTabChange('analisis')}
              className={`rounded-full px-3 py-1.5 type-meta transition-colors ${
                activeTab === 'analisis'
                  ? 'bg-bg-secondary font-semibold text-text-primary'
                  : 'bg-transparent text-text-tertiary'
              }`}
            >
              Análisis
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {activeTab === 'diario' ? (
        <>
          <TitularHero titular={insight.titular} sentiment={insight.sentiment} />

          {!metrics.esPrimerosDias && (
            <>
              <InsightChips chips={insight.chips} />

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

              {metrics.categorias.length > 0 && (
                <section className="mt-2 px-5">
                  <p className="type-label text-text-label mb-3">ESTE MES GASTASTE EN</p>

                  {visibleCategorias.map((cat, idx) => (
                    <div
                      key={cat.category}
                      className={idx >= 5 ? 'slide-up' : undefined}
                      style={
                        idx >= 5 ? { animationDelay: `${(idx - 5) * 40}ms` } : undefined
                      }
                    >
                      <CategoriaRow cat={cat} currency={currency} />
                    </div>
                  ))}

                  {metrics.categorias.length > 5 && (
                    <div className="flex justify-center mt-2 mb-4">
                      <button
                        onClick={() => setExpanded(!expanded)}
                        className="glass-1 border border-border-ocean rounded-full px-3 py-1.5 type-meta text-text-secondary"
                      >
                        {expanded
                          ? 'Ver menos'
                          : `Ver todas (${metrics.categorias.length})`}
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
