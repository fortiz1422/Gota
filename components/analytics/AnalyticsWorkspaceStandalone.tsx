'use client'

import type { ReactNode } from 'react'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { BlueHeaderZone } from '@/components/ui/BlueHeaderZone'
import type { BudgetSnapshot } from '@/lib/budgets/types'
import type { AnalyticsDrill, AnalyticsView } from '@/lib/analytics/analytics-route-state'
import { AnalysisSectionTabs } from './AnalysisSectionTabs'
import { BudgetControlHero } from './BudgetControlHero'

const VIEW_COPY: Record<AnalyticsView, { eyebrow: string; title: string }> = {
  summary: { eyebrow: 'Lectura del mes', title: 'Resumen' },
  insights: { eyebrow: 'Entender el mes', title: 'Insights' },
  budget: { eyebrow: 'Control del mes', title: 'Presupuesto' },
  goals: { eyebrow: 'Objetivos de ahorro', title: 'Metas' },
}

const DRILL_TITLES: Record<AnalyticsDrill, string> = {
  estado_mes: 'Estado del mes',
  fuga: 'Fuga Silenciosa',
  habitos: 'Mapa de Hábitos',
  compromisos: 'Compromisos',
}

interface Props {
  activeView: AnalyticsView
  selectedMonth: string
  drill?: AnalyticsDrill
  budget?: BudgetSnapshot
  currency?: 'ARS' | 'USD'
  children: ReactNode
}

export function AnalyticsWorkspaceStandalone({
  activeView,
  selectedMonth,
  drill,
  budget,
  currency = 'ARS',
  children,
}: Props) {
  const copy = VIEW_COPY[activeView]
  const activeTitle = activeView === 'insights' && drill ? DRILL_TITLES[drill] : copy.title
  const alertCount = budget?.plan
    ? budget.summary.overBudgetCount + budget.summary.nearLimitCount
    : 0

  return (
    <div className="bg-bg-primary">
      <BlueHeaderZone style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center justify-between px-[22px] pt-4">
          <h1 className="text-[18px] font-extrabold tracking-[-0.01em] text-white">
            Análisis<span className="sr-only"> — {activeTitle}</span>
          </h1>
          <DashboardHeader
            month={selectedMonth}
            basePath="/analytics"
            className=""
            variant="in-header"
            preserveParams={{
              view: activeView === 'summary' ? undefined : activeView,
              drill: activeView === 'insights' ? drill : undefined,
            }}
          />
        </div>

        {activeView === 'budget' && budget ? (
          <BudgetControlHero
            summary={budget.summary}
            currency={currency}
            totalCategories={budget.items.length}
            planExists={budget.plan !== null}
          />
        ) : (
          <div className="px-[22px] pb-10 pt-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/65">
              {copy.eyebrow}
            </p>
            <h2 className="mt-1 text-[24px] font-extrabold tracking-[-0.02em] text-white">
              {activeTitle}
            </h2>
          </div>
        )}
      </BlueHeaderZone>

      <div
        className="relative"
        style={{
          marginTop: -24,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)',
        }}
      >
        <AnalysisSectionTabs
          active={activeView}
          month={selectedMonth}
          budgetAlertCount={alertCount}
        />
        {children}
      </div>
    </div>
  )
}
