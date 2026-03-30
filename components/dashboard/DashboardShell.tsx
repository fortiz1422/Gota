'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { SaldoVivoSheet } from '@/components/dashboard/SaldoVivoSheet'
import { SmartInput } from '@/components/dashboard/SmartInput'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { CurrencyToggle } from '@/components/dashboard/CurrencyToggle'
import { SaldoVivo } from '@/components/dashboard/SaldoVivo'
import { FiltroEstoico } from '@/components/dashboard/FiltroEstoico'
import { Ultimos5 } from '@/components/dashboard/Ultimos5'
import { RolloverBanner } from '@/components/dashboard/RolloverBanner'
import { CierreMesModal } from '@/components/dashboard/CierreMesModal'
import { HomePlusButton } from '@/components/dashboard/HomePlusButton'
import { CardPaymentPrompt } from '@/components/dashboard/CardPaymentPrompt'
import { SubscriptionReviewBanner } from '@/components/subscriptions/SubscriptionReviewBanner'
import { useCardPaymentPrompts } from '@/hooks/useCardPaymentPrompts'
import type { Account, Card, DashboardData, Expense, IncomeEntry, Subscription, Transfer } from '@/types/database'
import type { PrevMonthSummary } from '@/lib/rollover'

type DashboardApiData = {
  dashboardData: DashboardData | null
  accounts: Account[]
  cards: Card[]
  currency: 'ARS' | 'USD'
  viewCurrency: 'ARS' | 'USD'
  hasIncomeAfterRollover: boolean
  autoRolloverAmount: number | null
  manualRolloverSummary: PrevMonthSummary | null
  activeSubscriptions: Subscription[]
  allUltimos: Expense[]
  incomeEntries: IncomeEntry[]
  transfers: Transfer[]
  earliestDataMonth: string | null
  hasUsdExpenses: boolean
  selectedMonth: string
  isCurrentMonth: boolean
  isProjected: boolean
}

interface Props {
  selectedMonth: string
  viewCurrency: 'ARS' | 'USD'
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <div
        className="mx-auto max-w-md px-4 pt-safe"
        style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 'calc(env(safe-area-inset-bottom) + 180px)' }}
      >
        <div className="grid grid-cols-3 items-center pt-5">
          <div className="h-8 w-20 skeleton rounded-full" />
          <div className="flex justify-center"><div className="h-6 w-16 skeleton rounded" /></div>
          <div className="flex justify-end"><div className="h-9 w-9 skeleton rounded-full" /></div>
        </div>
        <div className="h-44 skeleton rounded-card" />
        <div className="h-16 skeleton rounded-card" />
        <div className="h-36 skeleton rounded-card" />
      </div>
    </div>
  )
}

export function DashboardShell({ selectedMonth, viewCurrency }: Props) {
  const queryClient = useQueryClient()
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [keyboardOffset, setKeyboardOffset] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return
    const vv = window.visualViewport
    const handleViewportChange = () => {
      const offset = window.innerHeight - vv.height - vv.offsetTop
      setKeyboardOffset(Math.max(0, offset))
    }
    vv.addEventListener('resize', handleViewportChange)
    vv.addEventListener('scroll', handleViewportChange)
    return () => {
      vv.removeEventListener('resize', handleViewportChange)
      vv.removeEventListener('scroll', handleViewportChange)
    }
  }, [])

  const { data, isLoading } = useQuery<DashboardApiData>({
    queryKey: ['dashboard', selectedMonth, viewCurrency],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard?month=${selectedMonth}&currency=${viewCurrency}`)
      if (!res.ok) throw new Error('dashboard fetch failed')
      return res.json()
    },
  })

  const invalidateDashboard = () =>
    queryClient.invalidateQueries({ queryKey: ['dashboard', selectedMonth, viewCurrency] })

  const { activePrompt } = useCardPaymentPrompts(
    data?.cards ?? [],
    data?.isCurrentMonth ?? false,
    viewCurrency,
    data?.accounts ?? [],
  )

  // Prefetch Analytics in background so the tab is instant on first visit
  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: ['analytics', selectedMonth],
      queryFn: () =>
        fetch(`/api/analytics-data?month=${selectedMonth}`).then((r) => r.json()),
    })
  }, [selectedMonth, queryClient])

  if (isLoading || !data) return <DashboardSkeleton />

  const {
    dashboardData,
    accounts,
    cards,
    currency,
    hasIncomeAfterRollover,
    autoRolloverAmount,
    manualRolloverSummary,
    activeSubscriptions,
    allUltimos,
    incomeEntries,
    transfers,
    earliestDataMonth,
    isCurrentMonth,
    isProjected,
  } = data

  // Cross-currency transfers shift per-currency balance
  // e.g. ARS→USD: reduces ARS saldo, increases USD saldo
  const transferCurrencyAdjustment = transfers
    .filter((t) => t.currency_from !== t.currency_to)
    .reduce((sum, t) => {
      if (t.currency_from === viewCurrency) return sum - t.amount_from
      if (t.currency_to === viewCurrency) return sum + t.amount_to
      return sum
    }, 0)

  return (
    <div className="min-h-screen bg-bg-primary">
      <div
        className="mx-auto max-w-md px-4 pt-safe"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 180px)',
        }}
      >
        <div className="grid grid-cols-3 items-center pt-5">
          <div>
            <CurrencyToggle viewCurrency={viewCurrency} selectedMonth={selectedMonth} />
          </div>
          <div className="flex justify-center">
            <DashboardHeader
              month={selectedMonth}
              earliestDataMonth={earliestDataMonth ?? undefined}
              viewCurrency={viewCurrency}
              className=""
            />
          </div>
          <div className="flex justify-end">
            <HomePlusButton accounts={accounts} currency={currency} cards={cards} month={selectedMonth} />
          </div>
        </div>

        {autoRolloverAmount !== null && (
          <RolloverBanner amount={autoRolloverAmount} currency={currency} />
        )}

        <SaldoVivo
          data={dashboardData?.saldo_vivo ?? null}
          currency={viewCurrency}
          gastosTarjeta={dashboardData?.gastos_tarjeta ?? 0}
          transferAdjustment={transferCurrencyAdjustment}
          onBreakdownOpen={accounts.length > 0 ? () => setBreakdownOpen(true) : undefined}
          selectedMonth={selectedMonth}
          isProjected={isProjected}
        />

        {accounts.length > 0 && (
          <SaldoVivoSheet
            open={breakdownOpen}
            onClose={() => setBreakdownOpen(false)}
            selectedMonth={selectedMonth}
            currency={viewCurrency}
            isProjected={isProjected}
          />
        )}

        {(allUltimos.length > 0 || (dashboardData?.ultimos_5?.length ?? 0) > 0) && (
          <FiltroEstoico data={dashboardData!.filtro_estoico} />
        )}

        {activeSubscriptions.length > 0 && (
          <SubscriptionReviewBanner subscriptions={activeSubscriptions} currency={currency} cards={cards} />
        )}

        <Ultimos5
          expenses={allUltimos.length > 0 ? allUltimos : (dashboardData?.ultimos_5 ?? null)}
          incomeEntries={incomeEntries}
          transfers={transfers}
          accounts={accounts}
          month={selectedMonth}
        />
      </div>

      {/* Fade abisal */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 180,
          zIndex: 46,
          pointerEvents: 'none',
          background: 'linear-gradient(to bottom, transparent, var(--color-bg-primary))',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      />

      {/* Command Input */}
      <div
        style={{
          position: 'fixed',
          bottom: keyboardOffset > 0
            ? keyboardOffset + 8
            : 'calc(env(safe-area-inset-bottom) + 76px)',
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
          transition: keyboardOffset > 0 ? 'none' : 'bottom 0.25s ease',
        }}
      >
        <div style={{ width: '100%', maxWidth: 448, padding: '0 16px', pointerEvents: 'auto' }}>
          <SmartInput cards={cards} accounts={accounts} onAfterSave={invalidateDashboard} />
        </div>
      </div>

      {activePrompt && !manualRolloverSummary && (
        <CardPaymentPrompt
          card={activePrompt.card}
          amount={activePrompt.amount}
          currency={viewCurrency}
          periodoDesde={activePrompt.periodoDesde}
          periodoHasta={activePrompt.periodoHasta}
          accounts={accounts}
          onConfirm={(finalAmount) =>
            activePrompt.onConfirm(finalAmount).then(invalidateDashboard)
          }
          onDismiss={activePrompt.onDismiss}
        />
      )}

      {manualRolloverSummary && (
        <CierreMesModal
          summary={manualRolloverSummary}
          toMonth={selectedMonth}
          currency={currency}
          accounts={accounts}
        />
      )}
    </div>
  )
}
