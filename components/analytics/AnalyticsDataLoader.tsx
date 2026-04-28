'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { AnalyticsClient } from './AnalyticsClient'
import { computeCompromisos } from '@/lib/analytics/computeCompromisos'
import { computeMetrics } from '@/lib/analytics/computeMetrics'
import type {
  AnalyticsComparisonContext,
  MonthlySeriesPoint,
} from '@/lib/analytics/analytics-overview'
import type { Card, CardCycle, Expense, Subscription } from '@/types/database'

export type AnalyticsApiData = {
  rawExpenses: Expense[]
  compromisoExpenses: Expense[]
  ingresoMes: number | null
  subscriptions: Subscription[]
  cardCycles: CardCycle[]
  cards: Card[]
  currency: 'ARS' | 'USD'
  earliestDataMonth: string | null
  selectedMonth: string
  monthlySeries: MonthlySeriesPoint[]
  comparisonContext: AnalyticsComparisonContext
}

interface Props {
  selectedMonth: string
  initialDrill?: 'fuga' | 'habitos' | 'compromisos'
}

function AnalyticsSkeleton() {
  return (
    <div className="px-5 pt-safe" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="mt-5 h-10 w-32 rounded skeleton" />
      <div className="h-48 rounded-card skeleton" />
      <div className="h-32 rounded-card skeleton" />
      <div className="h-64 rounded-card skeleton" />
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

  if (isLoading || !data) return <AnalyticsSkeleton />

  const {
    rawExpenses,
    compromisoExpenses,
    ingresoMes,
    subscriptions,
    cardCycles,
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
    />
  )
}
