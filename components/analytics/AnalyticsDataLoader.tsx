'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { AnalyticsClient } from './AnalyticsClient'
import { computeMetrics } from '@/lib/analytics/computeMetrics'
import { computeCompromisos } from '@/lib/analytics/computeCompromisos'
import type { Card, Expense, Subscription } from '@/types/database'

type AnalyticsApiData = {
  rawExpenses: Expense[]
  ingresoMes: number | null
  subscriptions: Subscription[]
  cards: Card[]
  currency: 'ARS' | 'USD'
  earliestDataMonth: string | null
  selectedMonth: string
}

interface Props {
  selectedMonth: string
}

function AnalyticsSkeleton() {
  return (
    <div className="px-5 pt-safe" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="h-10 w-32 skeleton rounded mt-5" />
      <div className="h-48 skeleton rounded-card" />
      <div className="h-32 skeleton rounded-card" />
      <div className="h-64 skeleton rounded-card" />
    </div>
  )
}

export function AnalyticsDataLoader({ selectedMonth }: Props) {
  const queryClient = useQueryClient()

  // Prefetch Home dashboard in background so the tab is instant on return
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
  })

  if (isLoading || !data) return <AnalyticsSkeleton />

  const { rawExpenses, ingresoMes, subscriptions, cards, currency, earliestDataMonth } = data

  const today = new Date()
  const [ymYear, ymMonth] = selectedMonth.split('-').map(Number)
  const isCurrentMonth = today.getFullYear() === ymYear && today.getMonth() + 1 === ymMonth
  const daysInMonth = new Date(ymYear, ymMonth, 0).getDate()
  const dayOfMonth = isCurrentMonth ? today.getDate() : daysInMonth

  const metrics = computeMetrics(rawExpenses, ingresoMes, currency, selectedMonth)
  const compromisos = computeCompromisos(rawExpenses, cards, dayOfMonth, ingresoMes)

  return (
    <AnalyticsClient
      metrics={metrics}
      compromisos={compromisos}
      rawExpenses={rawExpenses}
      subscriptions={subscriptions}
      cards={cards}
      selectedMonth={selectedMonth}
      earliestDataMonth={earliestDataMonth ?? undefined}
    />
  )
}
