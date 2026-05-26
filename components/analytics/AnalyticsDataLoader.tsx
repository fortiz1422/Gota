'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { ChartLineUp } from '@phosphor-icons/react'
import { AnalyticsClient } from './AnalyticsClient'
import { EmptyState } from '@/components/ui/EmptyState'
import { computeCompromisos } from '@/lib/analytics/computeCompromisos'
import { computeMetrics } from '@/lib/analytics/computeMetrics'
import { buildEmptyBudgetSnapshot } from '@/lib/budgets/computeBudgetMetrics'
import type { BudgetSnapshot } from '@/lib/budgets/types'
import { buildCardCycleAmountsMap } from '@/lib/card-cycle-amounts'
import type {
  AnalyticsComparisonContext,
  MonthlySeriesPoint,
} from '@/lib/analytics/analytics-overview'
import type { Card, CardCycle, CardCycleAmount, Expense, Subscription } from '@/types/database'

export type AnalyticsApiData = {
  rawExpenses: Expense[]
  compromisoExpenses: Expense[]
  ingresoMes: number | null
  subscriptions: Subscription[]
  cardCycles: CardCycle[]
  cardCycleAmounts: CardCycleAmount[]
  cards: Card[]
  currency: 'ARS' | 'USD'
  earliestDataMonth: string | null
  selectedMonth: string
  monthlySeries: MonthlySeriesPoint[]
  comparisonContext: AnalyticsComparisonContext
}

export type BudgetApiData = BudgetSnapshot

interface Props {
  selectedMonth: string
  initialDrill?: 'estado_mes' | 'fuga' | 'habitos' | 'compromisos'
}

function AnalyticsSkeleton() {
  return (
    <div className="bg-bg-primary">
      <div
        className="blue-zone px-[22px] pb-10"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between pt-4">
          <div
            className="h-8 w-24 rounded-pill"
            style={{ background: 'rgba(255,255,255,0.20)' }}
          />
          <div
            className="h-8 w-20 rounded-pill"
            style={{ background: 'rgba(255,255,255,0.20)' }}
          />
        </div>
        <div
          className="mt-5 h-5 w-48 rounded"
          style={{ background: 'rgba(255,255,255,0.16)' }}
        />
        <div
          className="mt-3 h-10 w-36 rounded"
          style={{ background: 'rgba(255,255,255,0.20)' }}
        />
      </div>
      <div
        className="relative px-5"
        style={{
          marginTop: -24,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)',
        }}
      >
        <div className="skeleton h-10 rounded-pill" />
        <div className="skeleton h-32 rounded-card" />
        <div className="skeleton h-48 rounded-card" />
      </div>
    </div>
  )
}

export function AnalyticsDataLoader({ selectedMonth, initialDrill }: Props) {
  const queryClient = useQueryClient()

  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: ['dashboard', selectedMonth, 'ARS'],
      queryFn: () =>
        fetch(`/api/dashboard?month=${selectedMonth}&currency=ARS`).then((r) => r.json()),
    })
  }, [selectedMonth, queryClient])

  const { data, isLoading } = useQuery<AnalyticsApiData>({
    queryKey: ['analytics', selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/analytics-data?month=${selectedMonth}`)
      if (!res.ok) throw new Error('analytics fetch failed')
      return res.json()
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  const { data: budgetData, isLoading: isBudgetLoading } = useQuery<BudgetApiData>({
    queryKey: ['budgets', selectedMonth, data?.currency ?? 'ARS'],
    queryFn: async () => {
      const currency = data?.currency ?? 'ARS'
      const res = await fetch(`/api/budgets/current?month=${selectedMonth}&currency=${currency}`)
      if (!res.ok) throw new Error('budgets fetch failed')
      return res.json()
    },
    enabled: Boolean(data?.currency),
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  if (isLoading || !data || isBudgetLoading) return <AnalyticsSkeleton />

  if (data.rawExpenses.length === 0 && data.compromisoExpenses.length === 0) {
    return (
      <div className="bg-bg-primary">
        <div
          className="blue-zone px-[22px] pb-8"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="pt-4">
            <span className="text-[18px] font-extrabold text-white">Análisis</span>
          </div>
        </div>
        <div className="relative px-5 pt-4" style={{ marginTop: -24 }}>
          <EmptyState
            icon={ChartLineUp}
            title="Sin datos para analizar"
            subtitle="Cuando registres gastos acá vas a ver patrones y tendencias"
          />
        </div>
      </div>
    )
  }

  const {
    rawExpenses,
    compromisoExpenses,
    ingresoMes,
    subscriptions,
    cardCycles,
    cardCycleAmounts,
    cards,
    currency,
    earliestDataMonth,
    monthlySeries,
    comparisonContext,
  } = data

  const today = new Date()
  const [ymYear, ymMonth] = selectedMonth.split('-').map(Number)
  const isCurrentMonth = today.getFullYear() === ymYear && today.getMonth() + 1 === ymMonth

  const metrics = computeMetrics(rawExpenses, ingresoMes, currency, selectedMonth)

  const compromisos = computeCompromisos(
    compromisoExpenses,
    cards,
    cardCycles,
    ingresoMes,
    selectedMonth,
    isCurrentMonth,
    subscriptions,
    currency,
    buildCardCycleAmountsMap(cardCycleAmounts),
  )

  return (
    <AnalyticsClient
      metrics={metrics}
      compromisos={compromisos}
      rawExpenses={rawExpenses}
      subscriptions={subscriptions}
      cards={cards}
      selectedMonth={selectedMonth}
      earliestDataMonth={earliestDataMonth ?? undefined}
      monthlySeries={monthlySeries}
      comparisonContext={comparisonContext}
      initialDrill={initialDrill}
      budget={budgetData ?? buildEmptyBudgetSnapshot()}
    />
  )
}
