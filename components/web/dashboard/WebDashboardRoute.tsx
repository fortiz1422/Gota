'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import type { AnalyticsApiData } from '@/components/analytics/AnalyticsDataLoader'
import { DesktopDashboardShell } from '@/components/dashboard/desktop/DesktopDashboardShell'
import { computeCompromisos } from '@/lib/analytics/computeCompromisos'
import { buildCardCycleAmountsMap } from '@/lib/card-cycle-amounts'
import type { DashboardApiData } from '@/lib/server/dashboard-queries'

type CotizacionApiData = {
  compra: number
  venta: number
  fechaActualizacion: string
  rate: number
  effectiveDate: string
  updatedAt: string
  source: 'dolarapi'
  kind: 'oficial'
  stale: boolean
}

type Props = {
  selectedMonth: string
  viewCurrency: 'ARS' | 'USD'
  userEmail: string
  initialData: DashboardApiData
  initialQuote: CotizacionApiData | null
}

export function WebDashboardRoute({
  selectedMonth,
  viewCurrency,
  userEmail,
  initialData,
  initialQuote,
}: Props) {
  const router = useRouter()
  const analyticsQuery = useQuery<AnalyticsApiData>({
    queryKey: ['analytics', selectedMonth, viewCurrency, 'web'],
    queryFn: async () => {
      const res = await fetch(`/api/analytics-data?month=${selectedMonth}&currency=${viewCurrency}`)
      if (!res.ok) throw new Error('analytics fetch failed')
      return res.json()
    },
    staleTime: 60_000,
  })

  const compromisos = useMemo(() => {
    if (!analyticsQuery.data) return null
    return computeCompromisos(
      analyticsQuery.data.compromisoExpenses,
      analyticsQuery.data.cards,
      analyticsQuery.data.cardCycles,
      analyticsQuery.data.ingresoMes,
      selectedMonth,
      initialData.isCurrentMonth,
      analyticsQuery.data.subscriptions,
      analyticsQuery.data.currency,
      buildCardCycleAmountsMap(analyticsQuery.data.cardCycleAmounts),
    )
  }, [analyticsQuery.data, initialData.isCurrentMonth, selectedMonth])

  return (
    <DesktopDashboardShell
      selectedMonth={selectedMonth}
      viewCurrency={viewCurrency}
      userEmail={userEmail}
      data={initialData}
      analyticsData={analyticsQuery.data}
      compromisos={compromisos}
      heroBreakdown={initialData.heroBreakdown}
      availableBreakdown={initialData.availableBreakdown}
      quote={initialQuote}
      amountsVisible
      onOpenSettings={() => router.push('/settings')}
    />
  )
}
