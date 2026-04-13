'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { SaldoVivoSheet } from '@/components/dashboard/SaldoVivoSheet'
import { SmartInput } from '@/components/dashboard/SmartInput'
import { SaldoVivo } from '@/components/dashboard/SaldoVivo'
import { CuentaSheet } from '@/components/settings/CuentaSheet'
import { FiltroEstoico } from '@/components/dashboard/FiltroEstoico'
import { Ultimos5 } from '@/components/dashboard/Ultimos5'
import { HomePlusButton } from '@/components/dashboard/HomePlusButton'
import { CardPaymentPrompt } from '@/components/dashboard/CardPaymentPrompt'
import { SubscriptionReviewBanner } from '@/components/subscriptions/SubscriptionReviewBanner'
import { InstrumentosCard } from '@/components/instruments/InstrumentosCard'
import { RecurringIncomeBanner } from '@/components/dashboard/RecurringIncomeBanner'
import { useCardPaymentPrompts } from '@/hooks/useCardPaymentPrompts'
import { FF_INSTRUMENTS } from '@/lib/flags'
import type { DashboardApiData } from '@/lib/server/dashboard-queries'

interface Props {
  selectedMonth: string
  viewCurrency: 'ARS' | 'USD'
  userEmail: string
  initialData: DashboardApiData
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <div
        className="mx-auto max-w-md px-4 pt-safe"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 96px)',
        }}
      >
        <div className="flex items-center justify-between pt-5">
          <div className="h-9 w-9 skeleton rounded-full" />
          <div className="h-9 w-9 skeleton rounded-full" />
        </div>
        <div className="h-44 skeleton rounded-card" />
        <div className="h-16 skeleton rounded-card" />
        <div className="h-36 skeleton rounded-card" />
      </div>
    </div>
  )
}

export function DashboardShell({ selectedMonth, viewCurrency, userEmail, initialData }: Props) {
  const queryClient = useQueryClient()
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [cuentaSheetOpen, setCuentaSheetOpen] = useState(false)
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
    initialData,
  })

  const invalidateDashboardData = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', selectedMonth, viewCurrency] })
    queryClient.invalidateQueries({ queryKey: ['account-breakdown'] })
  }

  const { activePrompt } = useCardPaymentPrompts(
    data?.cards ?? [],
    data?.isCurrentMonth ?? false,
    viewCurrency,
    data?.accounts ?? [],
  )

  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: ['analytics', selectedMonth],
      queryFn: () => fetch(`/api/analytics-data?month=${selectedMonth}`).then((r) => r.json()),
    })
  }, [selectedMonth, queryClient])

  if (isLoading || !data) return <DashboardSkeleton />

  const {
    dashboardData,
    accounts,
    cards,
    currency,
    activeSubscriptions,
    allUltimos,
    incomeEntries,
    transfers,
    transferCurrencyAdjustment,
    isCurrentMonth,
    isProjected,
    yieldAccumulators,
    activeInstruments,
    capitalInstrumentosMes,
    recurringPending,
    activeRecurring,
  } = data

  return (
    <div className="min-h-screen bg-bg-primary">
      <div
        className="mx-auto max-w-md px-4 pt-safe"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 96px)',
        }}
      >
        <div className="flex items-center justify-between pt-5">
          <button
            onClick={() => setCuentaSheetOpen(true)}
            aria-label="Abrir configuracion de cuenta"
            className="transition-opacity hover:opacity-70 active:opacity-50"
          >
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
              <span className="text-sm font-bold text-white">
                {userEmail.charAt(0).toUpperCase()}
              </span>
            </div>
          </button>
          <HomePlusButton accounts={accounts} currency={currency} cards={cards} month={selectedMonth} />
        </div>

        <SaldoVivo
          data={dashboardData?.saldo_vivo ?? null}
          currency={viewCurrency}
          gastosTarjeta={dashboardData?.gastos_tarjeta ?? 0}
          transferAdjustment={transferCurrencyAdjustment}
          capitalInstrumentos={FF_INSTRUMENTS ? capitalInstrumentosMes : 0}
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

        {isCurrentMonth && recurringPending.length > 0 && (
          <RecurringIncomeBanner pending={recurringPending} accounts={accounts} />
        )}

        {FF_INSTRUMENTS && (
          <InstrumentosCard instruments={activeInstruments} currency={viewCurrency} />
        )}

        {(allUltimos.length > 0 || (dashboardData?.ultimos_5?.length ?? 0) > 0) && (
          <FiltroEstoico data={dashboardData!.filtro_estoico} />
        )}

        {activeSubscriptions.length > 0 && (
          <SubscriptionReviewBanner subscriptions={activeSubscriptions} cards={cards} />
        )}

        <Ultimos5
          expenses={allUltimos.length > 0 ? allUltimos : (dashboardData?.ultimos_5 ?? null)}
          incomeEntries={incomeEntries}
          transfers={transfers}
          accounts={accounts}
          cards={cards}
          month={selectedMonth}
          yieldAccumulators={yieldAccumulators}
          isCurrentMonth={isCurrentMonth}
          recurringIncomes={activeRecurring}
        />
        <div
          style={{
            marginBottom: keyboardOffset > 0 ? keyboardOffset : 0,
            transition: keyboardOffset > 0 ? 'none' : 'margin-bottom 0.25s ease',
          }}
        >
          <SmartInput cards={cards} accounts={accounts} onAfterSave={invalidateDashboardData} />
        </div>
      </div>

      {activePrompt && (
        <CardPaymentPrompt
          card={activePrompt.card}
          amount={activePrompt.amount}
          currency={viewCurrency}
          periodoDesde={activePrompt.periodoDesde}
          periodoHasta={activePrompt.periodoHasta}
          accounts={accounts}
          onConfirm={(finalAmount) => activePrompt.onConfirm(finalAmount).then(invalidateDashboardData)}
          onDismiss={activePrompt.onDismiss}
        />
      )}

      <CuentaSheet
        open={cuentaSheetOpen}
        onClose={() => setCuentaSheetOpen(false)}
        userEmail={userEmail}
      />
    </div>
  )
}
