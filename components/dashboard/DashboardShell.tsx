'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SaldoVivoSheet } from '@/components/dashboard/SaldoVivoSheet'
import { SaldoVivo } from '@/components/dashboard/SaldoVivo'
import { CommitmentsSummary } from '@/components/dashboard/CommitmentsSummary'
import { CuentaSheet } from '@/components/settings/CuentaSheet'
import { CuentasSubSheet } from '@/components/settings/CuentasSubSheet'
import { Ultimos5 } from '@/components/dashboard/Ultimos5'
import { HomePlusButton } from '@/components/dashboard/HomePlusButton'
import { BottomZone } from '@/components/dashboard/BottomZone'
import { CardPaymentPrompt } from '@/components/dashboard/CardPaymentPrompt'
import { SubscriptionReviewBanner } from '@/components/subscriptions/SubscriptionReviewBanner'
import { InstrumentosCard } from '@/components/instruments/InstrumentosCard'
import { RecurringIncomeBanner } from '@/components/dashboard/RecurringIncomeBanner'
import { useCardPaymentPrompts } from '@/hooks/useCardPaymentPrompts'
import { computeCompromisos } from '@/lib/analytics/computeCompromisos'
import { FF_INSTRUMENTS } from '@/lib/flags'
import { trackEvent } from '@/lib/product-analytics/client'
import type { AnalyticsApiData } from '@/components/analytics/AnalyticsDataLoader'
import type { DashboardApiData } from '@/lib/server/dashboard-queries'
import type { HeroBalanceMode } from '@/types/database'

interface Props {
  selectedMonth: string
  viewCurrency: 'ARS' | 'USD'
  userEmail: string
  initialData: DashboardApiData
}

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

const HERO_BALANCE_MODE_STORAGE_KEY = 'gota.hero_balance_mode'

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <div
        className="mx-auto max-w-md px-4 pt-safe"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 168px)',
        }}
      >
        <div className="flex items-center justify-between pt-5">
          <div className="h-9 w-9 rounded-full skeleton" />
          <div className="h-9 w-9 rounded-full skeleton" />
        </div>
        <div className="h-44 rounded-card skeleton" />
        <div className="h-16 rounded-card skeleton" />
        <div className="h-36 rounded-card skeleton" />
      </div>
    </div>
  )
}

export function DashboardShell({
  selectedMonth,
  viewCurrency,
  userEmail,
  initialData,
}: Props) {
  const queryClient = useQueryClient()
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [cuentaSheetOpen, setCuentaSheetOpen] = useState(false)
  const [cuentasOpen, setCuentasOpen] = useState(false)
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const [amountsVisible, setAmountsVisible] = useState(true)
  const [focusSignal, setFocusSignal] = useState(0)
  const [heroBalanceModeOverride, setHeroBalanceModeOverride] = useState<HeroBalanceMode | null>(() => {
    if (typeof window === 'undefined') return null
    const storedMode = window.localStorage.getItem(HERO_BALANCE_MODE_STORAGE_KEY)
    if (
      storedMode === 'combined_ars' ||
      storedMode === 'combined_usd' ||
      storedMode === 'default_currency'
    ) {
      return storedMode
    }
    return null
  })
  const dashboardLoadedTrackedRef = useRef(false)

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

  const analyticsQuery = useQuery<AnalyticsApiData>({
    queryKey: ['analytics', selectedMonth],
    queryFn: async () => {
      const res = await fetch(`/api/analytics-data?month=${selectedMonth}`)
      if (!res.ok) throw new Error('analytics fetch failed')
      return res.json()
    },
    staleTime: 60_000,
  })

  const cotizacionQuery = useQuery<CotizacionApiData | null>({
    queryKey: ['cotizacion-bna'],
    queryFn: async () => {
      const res = await fetch('/api/cotizaciones')
      if (!res.ok) return null
      return res.json()
    },
    staleTime: 300_000,
  })

  useEffect(() => {
    if (dashboardLoadedTrackedRef.current || !data) return
    const hasData =
      data.accounts.length > 0 ||
      data.allUltimos.length > 0 ||
      data.incomeEntries.length > 0 ||
      data.cards.length > 0
    if (!hasData) return

    dashboardLoadedTrackedRef.current = true
    trackEvent('dashboard_loaded_with_data', {
      currency: viewCurrency,
      has_accounts: data.accounts.length > 0,
      has_cards: data.cards.length > 0,
      has_expenses:
        data.allUltimos.length > 0 || Boolean(data.dashboardData?.ultimos_5?.length),
      has_income: data.incomeEntries.length > 0,
    })
  }, [data, viewCurrency])

  const invalidateDashboardData = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', selectedMonth, viewCurrency] })
    queryClient.invalidateQueries({ queryKey: ['account-breakdown'] })
    queryClient.invalidateQueries({ queryKey: ['analytics', selectedMonth] })
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

  useEffect(() => {
    const otherCurrency = viewCurrency === 'ARS' ? 'USD' : 'ARS'
    queryClient.prefetchQuery({
      queryKey: ['dashboard', selectedMonth, otherCurrency],
      queryFn: () =>
        fetch(`/api/dashboard?month=${selectedMonth}&currency=${otherCurrency}`).then((r) => r.json()),
      staleTime: 60_000,
    })
  }, [selectedMonth, viewCurrency, queryClient])

  const compromisos = useMemo(() => {
    if (!analyticsQuery.data || !data) return null
    return computeCompromisos(
      analyticsQuery.data.compromisoExpenses,
      analyticsQuery.data.cards,
      analyticsQuery.data.cardCycles,
      analyticsQuery.data.ingresoMes,
      selectedMonth,
      data.isCurrentMonth,
      analyticsQuery.data.subscriptions,
    )
  }, [analyticsQuery.data, data, selectedMonth])

  if (isLoading || !data) return <DashboardSkeleton />

  const {
    dashboardData,
    heroBalanceMode,
    heroBreakdown,
    availableBreakdown,
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

  const effectiveHeroBalanceMode = heroBalanceModeOverride ?? (heroBalanceMode as HeroBalanceMode)

  const hasAnyMovement =
    allUltimos.length > 0 ||
    incomeEntries.length > 0 ||
    transfers.length > 0 ||
    yieldAccumulators.length > 0

  const promptCreateAccount = () => setCuentasOpen(true)
  const promptFirstExpense = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    setFocusSignal((signal) => signal + 1)
  }

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
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
              <span className="text-sm font-bold text-white">
                {userEmail.charAt(0).toUpperCase()}
              </span>
            </div>
          </button>
          <HomePlusButton accounts={accounts} currency={currency} cards={cards} month={selectedMonth} />
        </div>

        {accounts.length === 0 ? (
          <section className="rounded-card border border-border-subtle bg-bg-secondary/70 px-5 py-6">
            <p className="type-label text-text-secondary">Home</p>
            <h1 className="mt-3 text-[30px] font-extrabold tracking-[-0.03em] text-text-primary">
              Empezá con tu primera cuenta
            </h1>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              Configurá una cuenta para que Saldo Vivo tenga una base real y después cargá tu primer movimiento.
            </p>
            <button
              type="button"
              onClick={promptCreateAccount}
              className="mt-5 rounded-button bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:brightness-105"
            >
              Crear cuenta
            </button>
          </section>
        ) : (
          <>
            <SaldoVivo
              data={dashboardData?.saldo_vivo ?? null}
              currency={currency}
              heroBalanceMode={effectiveHeroBalanceMode}
              heroBreakdown={heroBreakdown}
              availableBreakdown={availableBreakdown}
              valuationRate={cotizacionQuery.data?.rate ?? null}
              valuationDate={cotizacionQuery.data?.effectiveDate ?? null}
              gastosTarjeta={dashboardData?.gastos_tarjeta ?? 0}
              transferAdjustment={transferCurrencyAdjustment}
              capitalInstrumentos={FF_INSTRUMENTS ? capitalInstrumentosMes : 0}
              onBreakdownOpen={
                effectiveHeroBalanceMode === 'default_currency'
                  ? () => setBreakdownOpen(true)
                  : undefined
              }
              selectedMonth={selectedMonth}
              isProjected={isProjected}
              amountsVisible={amountsVisible}
              onToggleAmounts={() => setAmountsVisible((visible) => !visible)}
            />

            {compromisos && (
              <CommitmentsSummary
                compromisos={compromisos}
                totalCommitments={dashboardData?.gastos_tarjeta ?? 0}
                pendingStatements={compromisos.totalDebt}
                currentSpend={Math.max((dashboardData?.gastos_tarjeta ?? 0) - compromisos.totalDebt, 0)}
                currency={viewCurrency}
                selectedMonth={selectedMonth}
                amountsVisible={amountsVisible}
              />
            )}

            {!hasAnyMovement && (
              <section className="rounded-card border border-border-subtle bg-bg-secondary/60 px-4 py-5">
                <p className="type-label text-text-secondary">Primer movimiento</p>
                <h2 className="mt-2 text-[20px] font-bold tracking-[-0.02em] text-text-primary">
                  Cargá tu primer gasto
                </h2>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  Probá con algo corto y directo. Cuando lo guardes, el Home ya se empieza a llenar con datos reales.
                </p>
                <button
                  type="button"
                  onClick={promptFirstExpense}
                  className="mt-4 rounded-button border border-primary/20 bg-primary/8 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/12"
                >
                  Cargar primer gasto
                </button>
              </section>
            )}
          </>
        )}

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

        {activeSubscriptions.length > 0 && (
          <SubscriptionReviewBanner subscriptions={activeSubscriptions} cards={cards} />
        )}

        {accounts.length > 0 && (
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
        )}
      </div>

      <BottomZone
        accounts={accounts}
        cards={cards}
        keyboardOffset={keyboardOffset}
        onAfterSave={invalidateDashboardData}
        focusSignal={focusSignal}
      />

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
        heroBalanceMode={effectiveHeroBalanceMode}
        onHeroBalanceModeChange={setHeroBalanceModeOverride}
      />
      <CuentasSubSheet
        open={cuentasOpen}
        onClose={() => {
          setCuentasOpen(false)
          invalidateDashboardData()
        }}
      />
    </div>
  )
}
