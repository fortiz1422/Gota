'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { ChartLineUp } from '@phosphor-icons/react'
import { AnalyticsClient } from './AnalyticsClient'
import { AnalyticsWorkspaceStandalone } from './AnalyticsWorkspaceStandalone'
import { BudgetsSection } from './BudgetsSection'
import { GoalsSection } from './GoalsSection'
import { EmptyState } from '@/components/ui/EmptyState'
import { computeCompromisos } from '@/lib/analytics/computeCompromisos'
import { computeMetrics } from '@/lib/analytics/computeMetrics'
import { getCurrentMonth } from '@/lib/dates'
import { isApplicableCardPayment, isPerceivedExpense } from '@/lib/movement-classification'
import { buildEmptyBudgetSnapshot } from '@/lib/budgets/computeBudgetMetrics'
import type { BudgetSnapshot } from '@/lib/budgets/types'
import { buildCardCycleAmountsMap } from '@/lib/card-cycle-amounts'
import { FF_ANALYTICS_WORKSPACE_V1 } from '@/lib/flags'
import type { AnalyticsView } from '@/lib/analytics/analytics-route-state'
import type { PaceMovement } from '@/lib/web-panel/month-pace'
import type {
  AnalyticsComparisonContext,
  MonthlySeriesPoint,
} from '@/lib/analytics/analytics-overview'
import type { Card, CardCycle, CardCycleAmount, Expense, Subscription } from '@/types/database'
import { CATEGORIES } from '@/lib/validation/schemas'

export type AnalyticsApiData = {
  rawExpenses: Expense[]
  paceMovements: PaceMovement[]
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

export type BudgetApiData = BudgetSnapshot & { currency?: 'ARS' | 'USD' }

interface Props {
  selectedMonth: string
  initialView: AnalyticsView
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

function AnalyticsLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-[60vh] bg-bg-primary px-5 pt-safe">
      <EmptyState
        icon={ChartLineUp}
        title="No pudimos cargar Análisis"
        subtitle={message}
        ctaLabel="Reintentar"
        onCta={onRetry}
      />
    </div>
  )
}

export function AnalyticsDataLoader({ selectedMonth, initialView, initialDrill }: Props) {
  const queryClient = useQueryClient()
  const analyticsEnabled =
    !FF_ANALYTICS_WORKSPACE_V1 || initialView === 'summary' || initialView === 'insights'

  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: ['dashboard', selectedMonth, 'ARS'],
      queryFn: () =>
        fetch(`/api/dashboard?month=${selectedMonth}&currency=ARS`).then((r) => r.json()),
    })
  }, [selectedMonth, queryClient])

  const { data, isLoading, isError, refetch } = useQuery<AnalyticsApiData>({
    queryKey: ['analytics', selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/analytics-data?month=${selectedMonth}`)
      if (!res.ok) throw new Error('analytics fetch failed')
      return res.json()
    },
    enabled: analyticsEnabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  const {
    data: budgetData,
    isLoading: isBudgetLoading,
    isError: isBudgetError,
    refetch: refetchBudget,
  } = useQuery<BudgetApiData>({
    queryKey: FF_ANALYTICS_WORKSPACE_V1
      ? ['budgets', selectedMonth]
      : ['budgets', selectedMonth, data?.currency ?? 'ARS'],
    queryFn: async () => {
      const params = new URLSearchParams({ month: selectedMonth })
      if (!FF_ANALYTICS_WORKSPACE_V1 && data?.currency) {
        params.set('currency', data.currency)
      }
      const res = await fetch(`/api/budgets/current?${params.toString()}`)
      if (!res.ok) throw new Error('budgets fetch failed')
      return res.json()
    },
    enabled: FF_ANALYTICS_WORKSPACE_V1
      ? initialView !== 'goals'
      : Boolean(data?.currency),
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  if (FF_ANALYTICS_WORKSPACE_V1 && initialView === 'goals') {
    return (
      <AnalyticsWorkspaceStandalone activeView="goals" selectedMonth={selectedMonth}>
        <GoalsSection selectedMonth={selectedMonth} />
      </AnalyticsWorkspaceStandalone>
    )
  }

  if (FF_ANALYTICS_WORKSPACE_V1 && initialView === 'budget') {
    if (isBudgetLoading) {
      return (
        <AnalyticsWorkspaceStandalone activeView="budget" selectedMonth={selectedMonth}>
          <div className="mx-5 skeleton h-48 rounded-card" />
        </AnalyticsWorkspaceStandalone>
      )
    }
    if (isBudgetError || !budgetData) {
      return (
        <AnalyticsWorkspaceStandalone activeView="budget" selectedMonth={selectedMonth}>
          <AnalyticsLoadError
            message="No pudimos cargar tu presupuesto. Tus datos no cambiaron."
            onRetry={() => { void refetchBudget() }}
          />
        </AnalyticsWorkspaceStandalone>
      )
    }
    const budgetCurrency = budgetData.currency ?? budgetData.plan?.baseCurrency ?? 'ARS'
    return (
      <AnalyticsWorkspaceStandalone
        activeView="budget"
        selectedMonth={selectedMonth}
        budget={budgetData}
        currency={budgetCurrency}
      >
        <BudgetsSection
          budget={budgetData}
          currency={budgetCurrency}
          selectedMonth={selectedMonth}
          categories={[...CATEGORIES]}
        />
      </AnalyticsWorkspaceStandalone>
    )
  }

  if (FF_ANALYTICS_WORKSPACE_V1 && isLoading) {
    return (
      <AnalyticsWorkspaceStandalone
        activeView={initialView}
        selectedMonth={selectedMonth}
        drill={initialDrill}
      >
        <div className="mx-5 skeleton h-48 rounded-card" />
      </AnalyticsWorkspaceStandalone>
    )
  }

  if (FF_ANALYTICS_WORKSPACE_V1 && (isError || !data)) {
    return (
      <AnalyticsWorkspaceStandalone
        activeView={initialView}
        selectedMonth={selectedMonth}
        drill={initialDrill}
      >
        <AnalyticsLoadError
          message="Revisá tu conexión e intentá nuevamente."
          onRetry={() => { void refetch() }}
        />
      </AnalyticsWorkspaceStandalone>
    )
  }

  if (isLoading || !data || (!FF_ANALYTICS_WORKSPACE_V1 && isBudgetLoading)) return <AnalyticsSkeleton />
  if (isError || !data) {
    return (
      <AnalyticsLoadError
        message="Revisá tu conexión e intentá nuevamente."
        onRetry={() => { void refetch() }}
      />
    )
  }
  if (!FF_ANALYTICS_WORKSPACE_V1 && isBudgetError) {
    return (
      <AnalyticsLoadError
        message="No pudimos cargar tu presupuesto. Tus datos no cambiaron."
        onRetry={() => { void refetchBudget() }}
      />
    )
  }

  if (!FF_ANALYTICS_WORKSPACE_V1 && data.rawExpenses.length === 0 && data.compromisoExpenses.length === 0) {
    return (
      <div className="bg-bg-primary">
        <div
          className="blue-zone px-[22px] pb-8"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="pt-4">
            <span className="text-[18px] font-extrabold text-white">AnÃ¡lisis</span>
          </div>
        </div>
        <div className="relative px-5 pt-4" style={{ marginTop: -24 }}>
          <EmptyState
            icon={ChartLineUp}
            title="Sin datos para analizar"
            subtitle="Cuando registres gastos acÃ¡ vas a ver patrones y tendencias"
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

  const isCurrentMonth = selectedMonth === getCurrentMonth()

  const pagoTarjetasMes = compromisoExpenses
    .filter((e) => isApplicableCardPayment(e) && e.date.startsWith(selectedMonth))
    .reduce((s, e) => s + e.amount, 0)
  const percibidosTotal = rawExpenses
    .filter(isPerceivedExpense)
    .reduce((s, e) => s + e.amount, 0)

  const metrics = computeMetrics(
    rawExpenses,
    ingresoMes,
    currency,
    selectedMonth,
    percibidosTotal + pagoTarjetasMes,
  )

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
      initialView={initialView}
      initialDrill={initialDrill}
      budget={budgetData ?? buildEmptyBudgetSnapshot()}
    />
  )
}
