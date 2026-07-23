'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import type { AnalyticsApiData } from '@/components/analytics/AnalyticsDataLoader'
import { DesktopDashboardShell } from '@/components/dashboard/desktop/DesktopDashboardShell'
import type { NavId } from '@/components/dashboard/desktop/desktop-chrome'
import { WebPanelBriefV1 } from '@/components/dashboard/web-panel/WebPanelBriefV1'
import { computeCompromisos } from '@/lib/analytics/computeCompromisos'
import { buildCardCycleAmountsMap } from '@/lib/card-cycle-amounts'
import type { DashboardApiData } from '@/lib/server/dashboard-queries'
import type { BudgetSnapshot } from '@/lib/budgets/types'
import { FF_WEB_PANEL_BRIEF_V1 } from '@/lib/flags'
import { buildWebNavHref, resolveWebPanelNav } from '@/lib/web-panel/navigation'

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
  initialView: NavId
}

export function WebDashboardRoute({
  selectedMonth,
  viewCurrency,
  userEmail,
  initialData,
  initialQuote,
  initialView,
}: Props) {
  const router = useRouter()
  const [webNav, setWebNav] = useState<NavId>(initialView)
  const analyticsQuery = useQuery<AnalyticsApiData>({
    queryKey: ['analytics', selectedMonth, viewCurrency, 'web'],
    queryFn: async () => {
      const res = await fetch(`/api/analytics-data?month=${selectedMonth}&currency=${viewCurrency}`)
      if (!res.ok) throw new Error('analytics fetch failed')
      return res.json()
    },
    staleTime: 60_000,
  })

  const budgetQuery = useQuery<BudgetSnapshot>({
    queryKey: ['budgets', selectedMonth, viewCurrency],
    queryFn: async () => {
      const res = await fetch(`/api/budgets/current?month=${selectedMonth}&currency=${viewCurrency}`)
      if (!res.ok) throw new Error('budgets fetch failed')
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

  const navigateWeb = (nav: NavId, month = selectedMonth) => {
    setWebNav(nav)
    router.push(buildWebNavHref(nav, { month, currency: viewCurrency }))
  }

  const openWebHref = (href: string) => {
    const nav = resolveWebPanelNav(href)
    if (nav) {
      navigateWeb(nav)
      return
    }
    router.push(href)
  }

  if (FF_WEB_PANEL_BRIEF_V1 && webNav === 'inicio') {
    return (
      <WebPanelBriefV1
        selectedMonth={selectedMonth}
        viewCurrency={viewCurrency}
        userEmail={userEmail}
        data={initialData}
        analyticsData={analyticsQuery.data}
        analyticsLoading={analyticsQuery.isLoading}
        analyticsError={analyticsQuery.isError}
        budget={budgetQuery.data ?? null}
        budgetLoading={budgetQuery.isLoading}
        budgetError={budgetQuery.isError}
        compromisos={compromisos}
        quote={initialQuote}
        onNav={navigateWeb}
        onSelectMonth={(month) => navigateWeb(webNav, month)}
        onOpenSettings={() => router.push('/web/settings')}
        onNavigate={openWebHref}
      />
    )
  }

  if (FF_WEB_PANEL_BRIEF_V1) {
    return (
      <DesktopDashboardShell
        selectedMonth={selectedMonth}
        viewCurrency={viewCurrency}
        userEmail={userEmail}
        data={initialData}
        analyticsData={analyticsQuery.data}
        budget={budgetQuery.data ?? null}
        compromisos={compromisos}
        heroBreakdown={initialData.heroBreakdown}
        availableBreakdown={initialData.availableBreakdown}
        quote={initialQuote}
        amountsVisible
        initialNav={webNav}
        onNavChange={navigateWeb}
        onOpenSettings={() => router.push('/web/settings')}
        onSelectMonth={(month) => navigateWeb(webNav, month)}
      />
    )
  }

  return (
    <DesktopDashboardShell
      selectedMonth={selectedMonth}
      viewCurrency={viewCurrency}
      userEmail={userEmail}
      data={initialData}
      analyticsData={analyticsQuery.data}
      budget={budgetQuery.data ?? null}
      compromisos={compromisos}
      heroBreakdown={initialData.heroBreakdown}
      availableBreakdown={initialData.availableBreakdown}
      quote={initialQuote}
      amountsVisible
      onOpenSettings={() => router.push('/settings')}
      onSelectMonth={(month) => router.push(`/web?month=${month}&currency=${viewCurrency}`)}
    />
  )
}
