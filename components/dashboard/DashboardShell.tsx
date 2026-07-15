'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CaretRight, Wallet } from '@phosphor-icons/react'
import { SaldoVivoSheet } from '@/components/dashboard/SaldoVivoSheet'
import { SaldoVivo } from '@/components/dashboard/SaldoVivo'
import { DisponibleRealSheet } from '@/components/dashboard/DisponibleRealSheet'
import { CommitmentsSummary } from '@/components/dashboard/CommitmentsSummary'
import { CuentaSheet } from '@/components/settings/CuentaSheet'
import { CuentasSubSheet } from '@/components/settings/CuentasSubSheet'
import { Ultimos5 } from '@/components/dashboard/Ultimos5'
import { HomeActivationState } from '@/components/dashboard/HomeActivationState'
import { HomePlusButton } from '@/components/dashboard/HomePlusButton'
import { BottomZone } from '@/components/dashboard/BottomZone'
import { CardPaymentPrompt } from '@/components/dashboard/CardPaymentPrompt'
import { SubscriptionReviewBanner } from '@/components/subscriptions/SubscriptionReviewBanner'
import { InstrumentosCard } from '@/components/instruments/InstrumentosCard'
import { RecurringIncomeBanner } from '@/components/dashboard/RecurringIncomeBanner'
import { PendingSharedReceiptBanner } from '@/components/share-target/PendingSharedReceiptBanner'
import { SharedReceiptPreviewModal } from '@/components/share-target/SharedReceiptPreviewModal'
import { useAnonymousBannerTone } from '@/components/anonymous-banner/AnonymousBannerToneProvider'
import { BlueHeaderZone } from '@/components/ui/BlueHeaderZone'
import { HomeActionSlotRow } from '@/components/intelligence/HomeActionSlotRow'
import { HomeAmbientLine } from '@/components/intelligence/HomeAmbientLine'
import { SignalsBellButton } from '@/components/signals/SignalsBellButton'
import { SignalsSheet } from '@/components/signals/SignalsSheet'
import { useCardPaymentPrompts } from '@/hooks/useCardPaymentPrompts'
import { useSignalsCenter } from '@/hooks/useSignalsCenter'
import {
  FF_HOME_AMBIENT_INTELLIGENCE_V1,
  FF_HOME_TRANSIENT_ACTION_V1,
  FF_INSTRUMENTS,
  FF_INTELLIGENCE_LIFECYCLE_V1,
  FF_MOVEMENT_ANNOTATIONS_V1,
  FF_SIGNALS_CENTER_V1,
} from '@/lib/flags'
import { requestAssistantOpen } from '@/lib/assistant/events'
import { maskHomeIntelligence } from '@/lib/intelligence/home-orchestrator'
import type { HomeAction } from '@/lib/intelligence/home-model'
import type { SignalOccurrence } from '@/lib/intelligence/signal-center'
import {
  highestUnreadSignalTone,
  loadReadSignalVersions,
  markSignalVersionsRead,
} from '@/lib/intelligence/signals-read-state'
import { trackEvent } from '@/lib/product-analytics/client'
import { getHomeEmptyState } from '@/lib/home-empty-state'
import { readPendingSharedReceipt, type PendingSharedReceipt } from '@/lib/share-target'
import { formatAmount } from '@/lib/format'
import type { DashboardApiData } from '@/lib/server/dashboard-queries'
import type { HeroBalanceMode } from '@/types/database'

/** Registra un evento de lifecycle (best-effort, nunca bloquea la UI). */
function recordLifecycleEvent(
  action: HomeAction,
  type: 'shown' | 'snoozed' | 'acted',
  until?: string,
) {
  if (!FF_INTELLIGENCE_LIFECYCLE_V1) return
  void fetch('/api/intelligence/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      dedupeKey: action.dedupeKey,
      insightKind: action.kind,
      status: action.status,
      surface: 'home',
      until,
    }),
  }).catch(() => {})
}

interface Props {
  selectedMonth: string
  viewCurrency: 'ARS' | 'USD'
  userEmail: string
  isAnonymous: boolean
  initialData: DashboardApiData
  initialQuote: CotizacionApiData | null
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

function formatHomeMonth(ym: string): string {
  const raw = new Date(ym + '-15').toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })
  const normalized = raw.replace(' de ', ' ')
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function DashboardSkeleton() {
  return (
    <div className="min-h-app bg-bg-primary">
      <BlueHeaderZone style={{ paddingTop: 'env(safe-area-inset-top)', minHeight: 220 }}>
        <div className="mx-auto max-w-md px-5 pt-2">
          <div className="flex h-12 items-center justify-between">
            <div className="h-9 w-9 rounded-full" style={{ background: 'rgba(255,255,255,0.20)' }} />
            <div className="h-5 w-24 rounded-pill" style={{ background: 'rgba(255,255,255,0.20)' }} />
            <div className="h-9 w-9 rounded-full" style={{ background: 'rgba(255,255,255,0.20)' }} />
          </div>
          <div className="px-1 pb-5 pt-4">
            <div className="h-3 w-16 rounded" style={{ background: 'rgba(255,255,255,0.20)' }} />
            <div className="mt-3 h-10 w-44 rounded" style={{ background: 'rgba(255,255,255,0.20)' }} />
            <div className="mt-3 h-3 w-32 rounded" style={{ background: 'rgba(255,255,255,0.15)' }} />
          </div>
        </div>
      </BlueHeaderZone>
      <div className="mx-auto max-w-md px-[22px]" style={{ marginTop: -24 }}>
        <div className="flex flex-col gap-3">
          <div className="h-16 rounded-[18px] skeleton" />
          <div className="h-28 rounded-[18px] skeleton" />
          <div className="h-40 rounded-[18px] skeleton" />
        </div>
      </div>
    </div>
  )
}

export function DashboardShell({
  selectedMonth,
  viewCurrency,
  userEmail,
  isAnonymous,
  initialData,
  initialQuote,
}: Props) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [disponibleSheetOpen, setDisponibleSheetOpen] = useState(false)
  const [disponibleSheetMode, setDisponibleSheetMode] = useState<'real' | 'libre'>('real')
  const [cuentaSheetOpen, setCuentaSheetOpen] = useState(false)
  const [cuentasOpen, setCuentasOpen] = useState(false)
  const [signalsOpen, setSignalsOpen] = useState(false)
  const [readSignalVersions, setReadSignalVersions] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      return loadReadSignalVersions(window.localStorage)
    } catch {
      return []
    }
  })
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const [amountsVisible, setAmountsVisible] = useState(true)
  const [snoozedActionKeys, setSnoozedActionKeys] = useState<string[]>([])
  const [focusSignal, setFocusSignal] = useState(0)
  const [sharedReceiptPreviewOpen, setSharedReceiptPreviewOpen] = useState(false)
  const [sharedReceiptPreview, setSharedReceiptPreview] = useState<PendingSharedReceipt | null>(null)
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
  const signalsBellRef = useRef<HTMLButtonElement>(null)
  const { setTone: setAnonymousBannerTone } = useAnonymousBannerTone()

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

  const cotizacionQuery = useQuery<CotizacionApiData | null>({
    queryKey: ['cotizacion-bna'],
    queryFn: async () => {
      const res = await fetch('/api/cotizaciones')
      if (!res.ok) return null
      return res.json()
    },
    staleTime: 300_000,
    initialData: initialQuote,
  })

  // Consulta en background y nunca bloquea Home; así el punto de la campana
  // representa unread real antes de abrir el centro.
  const signalsQuery = useSignalsCenter({
    enabled: FF_SIGNALS_CENTER_V1,
    currency: viewCurrency,
  })
  const signalsTone = highestUnreadSignalTone(
    signalsQuery.data?.signals ?? [],
    readSignalVersions,
  )

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
    queryClient.invalidateQueries({ queryKey: ['analytics', selectedMonth, viewCurrency] })
  }

  const { activePrompt } = useCardPaymentPrompts(
    data?.cardPaymentPrompts ?? [],
    data?.accounts ?? [],
  )

  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: ['analytics', selectedMonth, viewCurrency],
      queryFn: () => fetch(`/api/analytics-data?month=${selectedMonth}&currency=${viewCurrency}`).then((r) => r.json()),
    })
  }, [selectedMonth, viewCurrency, queryClient])

  useEffect(() => {
    const otherCurrency = viewCurrency === 'ARS' ? 'USD' : 'ARS'
    queryClient.prefetchQuery({
      queryKey: ['dashboard', selectedMonth, otherCurrency],
      queryFn: () =>
        fetch(`/api/dashboard?month=${selectedMonth}&currency=${otherCurrency}`).then((r) => r.json()),
      staleTime: 60_000,
    })
  }, [selectedMonth, viewCurrency, queryClient])

  // ── Inteligencia ambiental (guía v1.1): edita módulos, no agrega capas ────
  // Antes del early return: los hooks deben ejecutarse en todo render.
  const homeIntelligence = useMemo(() => {
    if (!FF_HOME_AMBIENT_INTELLIGENCE_V1 || !data?.isCurrentMonth) return null
    const model = data.homeIntelligence ?? null
    if (!model) return null
    return amountsVisible ? model : maskHomeIntelligence(model)
  }, [data?.homeIntelligence, data?.isCurrentMonth, amountsVisible])

  const movementAnnotations = useMemo(() => {
    if (!FF_MOVEMENT_ANNOTATIONS_V1 || !homeIntelligence) return undefined
    return new Map(
      homeIntelligence.ambient.movementAnnotations.map((item) => [item.movementId, item.label]),
    )
  }, [homeIntelligence])

  // Impresiones (una vez por señal y sesión): usefulness se mide sobre lo visto.
  const seenIntelligenceKeys = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!homeIntelligence) return
    const action = homeIntelligence.actionSlot
    if (action && !seenIntelligenceKeys.current.has(action.dedupeKey)) {
      seenIntelligenceKeys.current.add(action.dedupeKey)
      trackEvent('home_action_seen', {
        insight_kind: action.kind,
        status: action.status,
        surface: 'home',
        has_native_action: action.action.type !== 'ask',
      })
      recordLifecycleEvent(action, 'shown')
    }
    const ambients = [
      ['disponible_real', homeIntelligence.ambient.disponibleReal],
      ['commitments', homeIntelligence.ambient.commitments],
    ] as const
    for (const [surface, modifier] of ambients) {
      if (!modifier) continue
      const key = `${surface}:${modifier.sourceInsightIds[0] ?? modifier.status}`
      if (seenIntelligenceKeys.current.has(key)) continue
      seenIntelligenceKeys.current.add(key)
      trackEvent('ambient_modifier_seen', {
        insight_kind: modifier.sourceInsightIds[0]?.split(':')[0] ?? 'none',
        status: modifier.status,
        surface,
      })
    }
  }, [homeIntelligence])

  const hasAnyMovement =
    (data?.allUltimos.length ?? 0) > 0 ||
    (data?.incomeEntries.length ?? 0) > 0 ||
    (data?.transfers.length ?? 0) > 0 ||
    (data?.yieldAccumulators.length ?? 0) > 0
  const hasCurrentMonthMovement = hasAnyMovement
  const hasHistoricalMovement = hasAnyMovement || (data?.earliestDataMonth ?? null) !== null
  const homeEmptyState = data
    ? getHomeEmptyState({
        isAnonymous,
        hasAnyMovement,
        hasCurrentMonthMovement,
        hasHistoricalMovement,
      })
    : null
  const anonymousBannerTone = homeEmptyState?.deemphasizeAnonymousBanner ? 'supporting' : 'default'

  useEffect(() => {
    setAnonymousBannerTone(anonymousBannerTone)

    return () => setAnonymousBannerTone('default')
  }, [anonymousBannerTone, setAnonymousBannerTone])

  if (isLoading || !data || !homeEmptyState) return <DashboardSkeleton />

  const {
    dashboardData,
    heroBalanceMode,
    heroBreakdown,
    availableBreakdown,
    goalCommitmentsBreakdown,
    freeBreakdown,
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
    compromisos,
  } = data

  const effectiveHeroBalanceMode = heroBalanceModeOverride ?? (heroBalanceMode as HeroBalanceMode)
  const valuationRate = cotizacionQuery.data?.rate ?? null

  // Compute display values needed by the DisponibleReal card
  const displayCurrency: 'ARS' | 'USD' =
    effectiveHeroBalanceMode === 'combined_ars' && valuationRate && valuationRate > 0
      ? 'ARS'
      : effectiveHeroBalanceMode === 'combined_usd' && valuationRate && valuationRate > 0
        ? 'USD'
        : currency

  const heroValue =
    effectiveHeroBalanceMode === 'combined_ars' && valuationRate && valuationRate > 0
      ? heroBreakdown.ARS + heroBreakdown.USD * valuationRate
      : effectiveHeroBalanceMode === 'combined_usd' && valuationRate && valuationRate > 0
        ? heroBreakdown.USD + heroBreakdown.ARS / valuationRate
        : heroBreakdown[currency]

  const availableDisplayValue =
    effectiveHeroBalanceMode === 'combined_ars' && valuationRate && valuationRate > 0
      ? availableBreakdown.ARS + availableBreakdown.USD * valuationRate
      : effectiveHeroBalanceMode === 'combined_usd' && valuationRate && valuationRate > 0
        ? availableBreakdown.USD + availableBreakdown.ARS / valuationRate
        : availableBreakdown[currency]

  const gastosTarjeta = Math.max(0, heroValue - availableDisplayValue)

  const disponibleAmbient = homeIntelligence?.ambient.disponibleReal ?? null
  const commitmentsAmbient = homeIntelligence?.ambient.commitments ?? null

  // El slot transitorio no duplica módulos propietarios: si el ingreso
  // esperado ya tiene su banner nativo, la señal queda en ese banner.
  const homeAction =
    FF_HOME_TRANSIENT_ACTION_V1 &&
    homeIntelligence?.actionSlot &&
    !snoozedActionKeys.includes(homeIntelligence.actionSlot.dedupeKey) &&
    !(homeIntelligence.actionSlot.kind === 'income_missing' && recurringPending.length > 0)
      ? homeIntelligence.actionSlot
      : null

  const handleHomeAction = (action: HomeAction) => {
    trackEvent('home_action_clicked', {
      insight_kind: action.kind,
      status: action.status,
      surface: 'home',
      has_native_action: action.action.type !== 'ask',
    })
    recordLifecycleEvent(action, 'acted')
    const commitmentsHref = `/analytics?month=${selectedMonth}&drill=compromisos`
    switch (action.action.type) {
      case 'navigate':
        router.push(action.action.href)
        break
      case 'review_card':
        router.push(commitmentsHref)
        break
      case 'review_subscription':
        router.push(commitmentsHref)
        break
      case 'review_movement':
        router.push('/movimientos')
        break
      case 'ask':
        requestAssistantOpen({ question: action.action.question })
        break
      default:
        router.push('/analytics')
    }
  }

  const handleSnoozeAction = (action: HomeAction) => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    trackEvent('home_action_snoozed', {
      insight_kind: action.kind,
      status: action.status,
      surface: 'home',
    })
    recordLifecycleEvent(action, 'snoozed', tomorrow)
    setSnoozedActionKeys((keys) => [...keys, action.dedupeKey])
  }
  const committedGoalsDisplayValue =
    effectiveHeroBalanceMode === 'combined_ars' && valuationRate && valuationRate > 0
      ? goalCommitmentsBreakdown.ARS + goalCommitmentsBreakdown.USD * valuationRate
      : effectiveHeroBalanceMode === 'combined_usd' && valuationRate && valuationRate > 0
        ? goalCommitmentsBreakdown.USD + goalCommitmentsBreakdown.ARS / valuationRate
        : goalCommitmentsBreakdown[currency]
  const freeDisplayValue =
    effectiveHeroBalanceMode === 'combined_ars' && valuationRate && valuationRate > 0
      ? freeBreakdown.ARS + freeBreakdown.USD * valuationRate
      : effectiveHeroBalanceMode === 'combined_usd' && valuationRate && valuationRate > 0
        ? freeBreakdown.USD + freeBreakdown.ARS / valuationRate
        : freeBreakdown[currency]
  const hasCommittedGoals = committedGoalsDisplayValue > 0

  function openDisponibleSheet(mode: 'real' | 'libre') {
    setDisponibleSheetMode(mode)
    setDisponibleSheetOpen(true)
  }

  const monthLabel = formatHomeMonth(selectedMonth)

  const promptCreateAccount = () => setCuentasOpen(true)
  const promptFirstExpense = () => {
    setSharedReceiptPreviewOpen(false)
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    setFocusSignal((signal) => signal + 1)
  }
  const openSharedReceiptPreview = () => {
    setSharedReceiptPreview(readPendingSharedReceipt())
    setSharedReceiptPreviewOpen(true)
  }
  const handleSharedReceiptCleared = () => {
    setSharedReceiptPreview(null)
    setSharedReceiptPreviewOpen(false)
  }

  const hasUnreadSignals = signalsTone !== 'none'
  const signalsError =
    signalsQuery.error instanceof Error
      ? signalsQuery.error.message
      : signalsQuery.isError
        ? 'No pudimos cargar tus señales.'
        : null

  const openSignals = () => {
    trackEvent('signals_bell_clicked', { surface: 'home', has_unread: hasUnreadSignals })
    trackEvent('signals_center_opened', {
      source: 'bell',
      surface: 'home',
      has_unread: hasUnreadSignals,
    })
    setSignalsOpen(true)
  }

  const markSignalsViewed = (versions: string[]) => {
    try {
      setReadSignalVersions(markSignalVersionsRead(window.localStorage, versions))
    } catch {
      setReadSignalVersions((current) => [...new Set([...versions, ...current])].slice(0, 100))
    }
  }

  const trackSignalOpened = (signal: SignalOccurrence) => {
    trackEvent('signals_signal_opened', {
      signal_kind: signal.kind,
      severity: signal.severity,
      source: 'center',
    })
  }

  const navigateFromSignal = (href: string, signal: SignalOccurrence) => {
    trackEvent('signals_action_clicked', {
      signal_kind: signal.kind,
      action_type: 'navigate',
      source: 'center',
    })
    setSignalsOpen(false)
    router.push(href)
  }

  const askFromSignal = (question: string, signal: SignalOccurrence) => {
    trackEvent('signals_action_clicked', {
      signal_kind: signal.kind,
      action_type: 'ask',
      source: 'center',
    })
    setSignalsOpen(false)
    window.setTimeout(() => requestAssistantOpen({ question }), 0)
  }

  return (
    <div className="min-h-app bg-bg-primary">
      {/* ── BLUE ZONE ── */}
      <BlueHeaderZone style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto max-w-md">
          {/* Header row: Signals | month label | plus */}
          <div className="flex h-12 items-center justify-between px-5 pt-2">
            {FF_SIGNALS_CENTER_V1 ? (
              <SignalsBellButton
                ref={signalsBellRef}
                tone={signalsTone}
                onClick={openSignals}
              />
            ) : (
              <button
                onClick={() => setCuentaSheetOpen(true)}
                aria-label="Abrir configuración de cuenta"
                className="flex h-9 w-9 items-center justify-center rounded-full header-glass transition-opacity hover:opacity-80 active:opacity-50"
              >
                <span className="text-sm font-bold text-white">
                  {userEmail.charAt(0).toUpperCase()}
                </span>
              </button>
            )}
            <span
              className="text-[14px] font-semibold"
              style={{ color: 'rgba(255,255,255,0.85)' }}
            >
              {monthLabel}
            </span>
            <HomePlusButton
              accounts={accounts}
              currency={currency}
              cards={cards}
              month={selectedMonth}
              onBlue
            />
          </div>

          {/* Saldo Vivo hero — only when accounts exist */}
          {accounts.length > 0 && (
            <SaldoVivo
              variant="in-header"
              data={dashboardData?.saldo_vivo ?? null}
              currency={currency}
              heroBalanceMode={effectiveHeroBalanceMode}
              heroBreakdown={heroBreakdown}
              availableBreakdown={availableBreakdown}
              goalCommitmentsBreakdown={goalCommitmentsBreakdown}
              freeBreakdown={freeBreakdown}
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
              onToggleAmounts={() => setAmountsVisible((v) => !v)}
            />
          )}
        </div>
      </BlueHeaderZone>

      {/* ── WHITE ZONE ── */}
      <div
        className="relative mx-auto max-w-md px-[22px]"
        style={{
          marginTop: accounts.length > 0 ? -24 : 16,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 200px)',
        }}
      >
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
          <div className="flex flex-col gap-3">
            <PendingSharedReceiptBanner
              canOpenComposer={accounts.length > 0}
              onOpenComposer={promptFirstExpense}
              onOpenPreview={openSharedReceiptPreview}
            />

            {/* Disponible real card */}
            <div className="card-s5 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                  <Wallet size={20} weight="regular" className="text-primary" />
                </div>
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left transition-opacity active:opacity-70"
                  onClick={() => openDisponibleSheet('real')}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-[500] text-text-secondary">Disponible real</p>
                    {disponibleAmbient ? (
                      <div className="mt-0.5">
                        <HomeAmbientLine modifier={disponibleAmbient} compact />
                      </div>
                    ) : (
                      <p className="mt-0.5 text-[11px] text-text-dim">
                        Ya descuenta deuda y consumos
                      </p>
                    )}
                  </div>
                  <span
                    className="whitespace-nowrap text-[17px] font-extrabold tabular-nums text-text-primary"
                    style={{ letterSpacing: '-0.01em' }}
                  >
                    {amountsVisible
                      ? formatAmount(availableDisplayValue, displayCurrency)
                      : displayCurrency === 'USD'
                        ? 'USD ****'
                        : '$ ******'}
                  </span>
                  <CaretRight size={13} weight="bold" className="mt-0.5 shrink-0 text-text-dim" />
                </button>
              </div>
              {hasCommittedGoals ? (
                <button
                  type="button"
                  onClick={() => openDisponibleSheet('libre')}
                  className="mt-3 inline-flex items-center gap-1 rounded-pill bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary transition-opacity hover:opacity-80"
                >
                  <span>
                    Tenés{' '}
                    {amountsVisible
                      ? formatAmount(committedGoalsDisplayValue, displayCurrency)
                      : displayCurrency === 'USD'
                        ? 'USD ****'
                        : '$ ******'}{' '}
                    comprometidos en metas
                  </span>
                  <span className="font-semibold">Ver libre</span>
                </button>
              ) : null}
            </div>

            {/* Acción transitoria: cero o una, nunca deja placeholder */}
            {homeAction && (
              <HomeActionSlotRow
                action={homeAction}
                onAction={handleHomeAction}
                onSnooze={handleSnoozeAction}
              />
            )}

            {/* Compromisos */}
            {compromisos && (
              <CommitmentsSummary
                compromisos={compromisos}
                totalCommitments={compromisos.totalAPagar + compromisos.totalEnCurso}
                pendingStatements={compromisos.totalAPagar}
                currentSpend={compromisos.totalEnCurso}
                currency={viewCurrency}
                selectedMonth={selectedMonth}
                amountsVisible={amountsVisible}
                ambient={commitmentsAmbient}
              />
            )}

            {homeEmptyState.showPrimaryActivation && (
              <HomeActivationState
                state={homeEmptyState}
                onPrimaryAction={promptFirstExpense}
                historyHref="/movimientos"
                isAnonymous={isAnonymous}
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

            {/* Últimos movimientos */}
            <div className="mt-2">
              <div className="mb-3 flex items-baseline justify-between px-1">
                <h3 className="text-[16px] font-bold tracking-[-0.01em] text-text-primary">
                  Últimos movimientos
                </h3>
                <Link
                  href="/movimientos"
                  className="flex items-center gap-0.5 text-[13px] font-semibold text-primary transition-opacity hover:opacity-70"
                >
                  Ver todos
                  <CaretRight size={10} weight="bold" />
                </Link>
              </div>
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
                emptyState={homeEmptyState}
                annotations={movementAnnotations}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── SHEETS & MODALS ── */}
      {accounts.length > 0 && (
        <SaldoVivoSheet
          open={breakdownOpen}
          onClose={() => setBreakdownOpen(false)}
          selectedMonth={selectedMonth}
          currency={viewCurrency}
          isProjected={isProjected}
        />
      )}

      <DisponibleRealSheet
        key={`${disponibleSheetMode}-${disponibleSheetOpen ? 'open' : 'closed'}`}
        open={disponibleSheetOpen}
        onClose={() => setDisponibleSheetOpen(false)}
        initialMode={disponibleSheetMode}
        saldoVivo={heroValue}
        gastosTarjeta={gastosTarjeta}
        comprometidoMetas={committedGoalsDisplayValue}
        disponibleLibre={freeDisplayValue}
        currency={displayCurrency}
        selectedMonth={selectedMonth}
        isProjected={isProjected}
      />

      {FF_SIGNALS_CENTER_V1 && (
        <SignalsSheet
          open={signalsOpen}
          onClose={() => setSignalsOpen(false)}
          model={signalsQuery.data ?? null}
          loading={signalsQuery.isPending}
          error={signalsError}
          amountsVisible={amountsVisible}
          isHistoricalContext={!isCurrentMonth}
          triggerRef={signalsBellRef}
          onRetry={() => void signalsQuery.refetch()}
          onViewed={markSignalsViewed}
          onSignalOpened={trackSignalOpened}
          onCoverageOpened={() =>
            trackEvent('signals_coverage_opened', {
              coverage_id: 'all',
              source: 'center',
            })
          }
          onNavigate={navigateFromSignal}
          onAsk={askFromSignal}
        />
      )}

      <BottomZone
        accounts={accounts}
        cards={cards}
        keyboardOffset={keyboardOffset}
        onAfterSave={invalidateDashboardData}
        focusSignal={focusSignal}
      />

      <SharedReceiptPreviewModal
        open={sharedReceiptPreviewOpen}
        pendingShare={sharedReceiptPreview}
        canContinue={accounts.length > 0}
        accounts={accounts}
        cards={cards}
        onClose={() => setSharedReceiptPreviewOpen(false)}
        onCleared={handleSharedReceiptCleared}
        onSaved={invalidateDashboardData}
      />

      {activePrompt && (
        <CardPaymentPrompt
          candidate={activePrompt.candidate}
          accounts={accounts}
          cotizacion={cotizacionQuery.data ?? null}
          onConfirm={(input) => activePrompt.onConfirm(input).then(invalidateDashboardData)}
          onDismiss={activePrompt.onDismiss}
        />
      )}

      {!FF_SIGNALS_CENTER_V1 && (
        <CuentaSheet
          open={cuentaSheetOpen}
          onClose={() => setCuentaSheetOpen(false)}
          userEmail={userEmail}
          heroBalanceMode={effectiveHeroBalanceMode}
          onHeroBalanceModeChange={setHeroBalanceModeOverride}
        />
      )}
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
