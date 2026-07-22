'use client'

import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import { ArrowRight, ChartLine, WarningCircle } from '@phosphor-icons/react'
import type { AnalyticsApiData } from '@/components/analytics/AnalyticsDataLoader'
import { buildHorizonEvents, buildRecentActivityItems } from '@/components/dashboard/desktop/desktop-dashboard-model'
import type { CompromisosData } from '@/lib/analytics/computeCompromisos'
import type { BudgetSnapshot } from '@/lib/budgets/types'
import { requestAssistantOpen } from '@/lib/assistant/events'
import type { DashboardApiData } from '@/lib/server/dashboard-queries'
import {
  highestUnreadSignalTone,
  loadReadSignalVersions,
  markSignalVersionsRead,
} from '@/lib/intelligence/signals-read-state'
import { maskSignalOccurrence } from '@/lib/intelligence/signal-center-display'
import type { SignalCenterModel } from '@/lib/intelligence/signal-center'
import { useSignalsCenter } from '@/hooks/useSignalsCenter'
import { SignalsSheet } from '@/components/signals/SignalsSheet'
import {
  buildDailyPaceSeries,
  buildMonthPaceModel,
  sumExtraordinaryPlanSpend,
} from '@/lib/web-panel/month-pace'
import {
  buildMoneyEquation,
  buildWebBrief,
  isWithinRollingHorizon,
} from '@/lib/web-panel/panel-model'
import { todayAR } from '@/lib/format'
import { WebPanelTopbar } from './WebPanelTopbar'
import { WebTrustStage } from './WebTrustStage'
import { WebMonthPace } from './WebMonthPace'
import { WebHorizon } from './WebHorizon'
import { WebCalculationDrawer } from './WebCalculationDrawer'
import type { NavId } from '@/components/dashboard/desktop/desktop-chrome'

export type WebPanelQuote = {
  rate: number
  updatedAt?: string
  stale?: boolean
}

type Props = {
  selectedMonth: string
  viewCurrency: 'ARS' | 'USD'
  userEmail: string
  data: DashboardApiData
  analyticsData?: AnalyticsApiData
  analyticsLoading: boolean
  analyticsError: boolean
  budget: BudgetSnapshot | null
  budgetLoading: boolean
  budgetError: boolean
  compromisos: CompromisosData | null
  quote: WebPanelQuote | null
  onSelectMonth: (month: string) => void
  onNav: (id: NavId) => void
  onOpenSettings: () => void
  onNavigate: (href: string) => void
  signalsModelOverride?: SignalCenterModel
  initialHidden?: boolean
  initialSignalsOpen?: boolean
  initialCalculationOpen?: boolean
}

function firstName(email: string) {
  const local = email.split('@')[0]
  const value = local.split(/[._]/)[0] || 'F'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function daysInMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(year, monthNumber, 0).getDate()
}

function latestMovementLabel(data: DashboardApiData) {
  const latest = [
    ...data.allUltimos.map(({ date }) => date),
    ...data.incomeEntries.map(({ date }) => date),
    ...data.transfers.map(({ date }) => date),
  ].sort().at(-1)
  if (!latest) return 'Sin movimientos registrados todavía'
  const date = new Date(`${latest.slice(0, 10)}T12:00:00-03:00`).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
  }).replace('.', '')
  return `Actualizado con lo registrado · último movimiento ${date}`
}

export function WebPanelBriefV1({
  selectedMonth,
  viewCurrency,
  userEmail,
  data,
  analyticsData,
  analyticsLoading,
  analyticsError,
  budget,
  budgetLoading,
  budgetError,
  compromisos,
  quote,
  onSelectMonth,
  onNav,
  onOpenSettings,
  onNavigate,
  signalsModelOverride,
  initialHidden = false,
  initialSignalsOpen = false,
  initialCalculationOpen = false,
}: Props) {
  const [hidden, setHidden] = useState(initialHidden)
  const [signalsOpen, setSignalsOpen] = useState(initialSignalsOpen)
  const [calculationOpen, setCalculationOpen] = useState(initialCalculationOpen)
  const [readSignalVersions, setReadSignalVersions] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    return loadReadSignalVersions(window.localStorage)
  })
  const signalsButtonRef = useRef<HTMLButtonElement>(null)
  const signalsQuery = useSignalsCenter({
    enabled: !signalsModelOverride,
    currency: viewCurrency,
  })
  const rawSignalsModel = signalsModelOverride ?? signalsQuery.data ?? null
  const historical = !data.isCurrentMonth
  const displaySignalsModel = useMemo(
    () => rawSignalsModel
      ? {
          ...rawSignalsModel,
          signals: rawSignalsModel.signals.map((signal) =>
            maskSignalOccurrence(signal, !hidden),
          ),
        }
      : null,
    [hidden, rawSignalsModel],
  )
  const brief = useMemo(
    () => buildWebBrief({ model: displaySignalsModel, historical }),
    [displaySignalsModel, historical],
  )
  const signalTone = highestUnreadSignalTone(
    rawSignalsModel?.signals ?? [],
    readSignalVersions,
  )
  const equation = useMemo(
    () => buildMoneyEquation({
      saldoVivo: data.heroBreakdown[viewCurrency] ?? 0,
      disponibleReal: data.availableBreakdown[viewCurrency] ?? 0,
      disponibleLibre: data.freeBreakdown[viewCurrency] ?? 0,
    }),
    [data.availableBreakdown, data.freeBreakdown, data.heroBreakdown, viewCurrency],
  )
  const totalDays = daysInMonth(selectedMonth)
  const comparisonDay = analyticsData?.comparisonContext.comparisonDay ?? totalDays
  const dailyPace = useMemo(
    () => buildDailyPaceSeries({
      movements: analyticsData?.paceMovements ?? [],
      selectedMonth,
      comparisonDay,
      daysInMonth: totalDays,
      currency: viewCurrency,
    }),
    [analyticsData?.paceMovements, comparisonDay, selectedMonth, totalDays, viewCurrency],
  )
  const planCategories = useMemo(
    () => budget?.items.map(({ category }) => category) ?? [],
    [budget?.items],
  )
  const planDailyPace = useMemo(
    () => buildDailyPaceSeries({
      movements: analyticsData?.paceMovements ?? [],
      selectedMonth,
      comparisonDay,
      daysInMonth: totalDays,
      currency: viewCurrency,
      includedCategories: planCategories,
    }),
    [analyticsData?.paceMovements, comparisonDay, planCategories, selectedMonth, totalDays, viewCurrency],
  )
  const planExtraordinaryAmount = useMemo(
    () => sumExtraordinaryPlanSpend({
      movements: analyticsData?.paceMovements ?? [],
      selectedMonth,
      currency: viewCurrency,
      includedCategories: planCategories,
    }),
    [analyticsData?.paceMovements, planCategories, selectedMonth, viewCurrency],
  )
  const paceModel = useMemo(
    () => buildMonthPaceModel({
      daily: dailyPace,
      planDaily: planDailyPace,
      planExtraordinaryAmount,
      budget: budgetError || budgetLoading ? null : budget,
      comparisonDay,
      daysInMonth: totalDays,
      currency: viewCurrency,
    }),
    [budget, budgetError, budgetLoading, comparisonDay, dailyPace, planDailyPace, planExtraordinaryAmount, totalDays, viewCurrency],
  )
  const horizon = useMemo(
    () => buildHorizonEvents({
      cards: data.cards,
      recurringIncomes: data.activeRecurring,
      activeInstruments: data.activeInstruments,
      compromisos,
      selectedMonth,
    })
      .filter((event) => isWithinRollingHorizon(event.date, todayAR()))
      .slice(0, 5),
    [compromisos, data.activeInstruments, data.activeRecurring, data.cards, selectedMonth],
  )
  const recentActivity = useMemo(
    () => buildRecentActivityItems({
      expenses: data.allUltimos,
      incomes: data.incomeEntries,
      transfers: data.transfers,
      accounts: data.accounts,
      limit: 5,
    }),
    [data.accounts, data.allUltimos, data.incomeEntries, data.transfers],
  )
  const accountRows = data.accountBalances.map((account) => ({
    id: account.id,
    name: account.name,
    saldo: account.saldo,
  }))
  const visibleSignals = (displaySignalsModel?.signals ?? [])
    .filter(({ version }) => version !== brief.primarySignal?.version)
    .filter(({ severity }) => severity !== 'positive')
    .slice(0, 3)

  const name = firstName(userEmail)

  function handleAsk(question: string) {
    requestAssistantOpen({ question })
  }

  function openSignals() {
    if (typeof window !== 'undefined') {
      setReadSignalVersions(
        markSignalVersionsRead(
          window.localStorage,
          (rawSignalsModel?.signals ?? []).map(({ version }) => version),
        ),
      )
    }
    setSignalsOpen(true)
  }

  const signalsSheet = (
    <SignalsSheet
      open={signalsOpen}
      onClose={() => setSignalsOpen(false)}
      model={rawSignalsModel}
      loading={!signalsModelOverride && signalsQuery.isLoading}
      error={!signalsModelOverride && signalsQuery.error instanceof Error ? signalsQuery.error.message : null}
      amountsVisible={!hidden}
      isHistoricalContext={historical}
      triggerRef={signalsButtonRef}
      surface="drawer"
      onRetry={() => { void signalsQuery.refetch() }}
      onNavigate={(href) => onNavigate(href)}
      onAsk={(question) => handleAsk(question)}
    />
  )

  if (data.accounts.length === 0) {
    return (
      <div className="min-h-screen bg-white text-text-primary">
        <WebPanelTopbar
          selectedMonth={selectedMonth}
          quote={quote}
          hidden={hidden}
          signalTone="none"
          avatarInitial={name.charAt(0)}
          signalsButtonRef={signalsButtonRef}
          onSelectMonth={onSelectMonth}
          onNav={onNav}
          onToggleHidden={() => setHidden((value) => !value)}
          onOpenSignals={openSignals}
          onOpenSettings={onOpenSettings}
        />
        <main className="mx-auto max-w-[1100px] px-6 py-24 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary"><ChartLine size={26} /></span>
          <h1 className="mt-6 text-[34px] font-bold tracking-[-.04em]">Empezá por una cuenta real.</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-text-secondary">Con una cuenta y movimientos, Gota puede construir Saldo Vivo, Disponible Real y una lectura verificable del mes.</p>
          <Link href="/web/settings" className="mt-7 inline-flex h-11 items-center gap-2 rounded-[10px] bg-primary px-5 text-sm font-bold text-white no-underline">Agregar o verificar cuenta <ArrowRight size={15} /></Link>
        </main>
        {signalsSheet}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white font-sans text-text-primary">
      <WebPanelTopbar
        selectedMonth={selectedMonth}
        quote={quote}
        hidden={hidden}
        signalTone={signalTone}
        avatarInitial={name.charAt(0)}
        signalsButtonRef={signalsButtonRef}
        onSelectMonth={onSelectMonth}
        onNav={onNav}
        onToggleHidden={() => setHidden((value) => !value)}
        onOpenSignals={openSignals}
        onOpenSettings={onOpenSettings}
      />
      <WebTrustStage
        equation={equation}
        brief={brief}
        currency={viewCurrency}
        hidden={hidden}
        isCurrentMonth={data.isCurrentMonth}
        freshness={latestMovementLabel(data)}
        onOpenCalculation={() => setCalculationOpen(true)}
        onOpenSignals={openSignals}
        onNavigate={onNavigate}
        onAsk={handleAsk}
      />

      <main className="mx-auto max-w-[1500px] px-6 pb-24 xl:px-10">
        {historical && (
          <section className="mt-8 flex items-start gap-3 border-y border-[rgba(33,120,168,.10)] py-4">
            <WarningCircle size={19} className="mt-0.5 shrink-0 text-primary" />
            <div><p className="text-sm font-bold">Cierre de {selectedMonth}</p><p className="mt-1 text-xs leading-relaxed text-text-secondary">El saldo superior sigue siendo la caja de hoy. El cuerpo muestra el período seleccionado y no mezcla señales actuales dentro de la lectura histórica.</p></div>
          </section>
        )}

        <section className="grid gap-10 border-b border-[rgba(33,120,168,.10)] py-10 lg:grid-cols-[minmax(0,1.42fr)_minmax(360px,.72fr)] lg:gap-16">
          <div>
            {analyticsLoading ? (
              <div className="h-[430px] animate-pulse rounded-[12px] bg-bg-secondary" role="status" aria-label="Cargando ritmo" />
            ) : analyticsError ? (
              <div className="min-h-[280px] py-4"><p className="text-[10px] font-bold uppercase tracking-[.09em] text-text-tertiary">Este mes</p><h2 className="mt-2 text-2xl font-bold tracking-[-.03em]">No pudimos cargar el ritmo.</h2><p className="mt-2 text-sm text-text-secondary">La caja sigue disponible. Reintentá desde Análisis; no lo confundimos con falta de presupuesto.</p><button type="button" onClick={() => onNav('analisis')} className="mt-5 text-xs font-bold text-primary">Abrir Análisis →</button></div>
            ) : (
              <WebMonthPace model={paceModel} currency={viewCurrency} hidden={hidden} selectedMonth={selectedMonth} daysInMonth={totalDays} onOpenAnalysis={() => onNav('analisis')} />
            )}
          </div>
          {historical ? (
            <aside className="border-t border-[rgba(33,120,168,.10)] pt-8 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"><h2 className="text-lg font-bold">Hitos del período</h2><p className="mt-2 text-xs leading-relaxed text-text-secondary">Los eventos actuales no se proyectan sobre un mes cerrado. Abrí Análisis para revisar compromisos y movimientos de este período.</p><button type="button" onClick={() => onNav('analisis')} className="mt-5 text-xs font-bold text-primary">Revisar cierre →</button></aside>
          ) : (
            <WebHorizon events={horizon} currency={viewCurrency} hidden={hidden} onOpenAgenda={() => onNav('analisis')} />
          )}
        </section>

        <section className="grid gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(380px,.8fr)] lg:gap-16">
          <div>
            <div className="flex items-end justify-between gap-4"><div><h2 className="text-[19px] font-bold tracking-[-.03em]">Para revisar</h2><p className="mt-1 text-[11px] text-text-secondary">Excepciones secundarias. La principal ya fue priorizada arriba.</p></div><button type="button" onClick={openSignals} className="text-[11px] font-bold text-primary">Abrir Señales →</button></div>
            <div className="mt-4">
              {signalsQuery.isError ? <p className="border-y border-[rgba(33,120,168,.09)] py-5 text-xs text-text-secondary">No pudimos cargar Señales. El resto del Panel sigue operativo.</p> : visibleSignals.length === 0 ? <p className="border-y border-[rgba(33,120,168,.09)] py-5 text-xs text-text-secondary">No hay excepciones secundarias para mostrar.</p> : visibleSignals.map((signal) => (
                <button key={signal.version} type="button" onClick={openSignals} className="grid w-full grid-cols-[9px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[rgba(33,120,168,.09)] py-4 text-left"><span className={`h-2 w-2 rounded-full ${signal.severity === 'risk' ? 'bg-danger' : signal.severity === 'watch' ? 'bg-warning' : 'bg-primary'}`} /><span><b className="block text-[12.5px]">{signal.title}</b><small className="mt-1 block text-[10px] text-text-tertiary">{signal.summary}</small></span><span className="text-[10.5px] font-bold text-primary">Ver →</span></button>
              ))}
            </div>
          </div>

          <div className="lg:border-l lg:border-[rgba(33,120,168,.10)] lg:pl-8">
            <div className="flex items-end justify-between gap-4"><div><h2 className="text-[19px] font-bold tracking-[-.03em]">Actividad reciente</h2><p className="mt-1 text-[11px] text-text-secondary">Evidencia operativa, no otro resumen.</p></div><button type="button" onClick={() => onNav('movimientos')} className="text-[11px] font-bold text-primary">Ver movimientos →</button></div>
            <div className="mt-4">
              {recentActivity.map((item) => (
                <button key={item.id} type="button" onClick={() => onNav('movimientos')} className="grid w-full grid-cols-[70px_minmax(0,1fr)_auto] items-center gap-3 border-b border-[rgba(33,120,168,.09)] py-3 text-left"><span className="text-[9.5px] text-text-tertiary">{item.dateLabel}</span><span><b className="block truncate text-[12px]">{item.title}</b><small className="text-[9.5px] text-text-tertiary">{item.subtitle}</small></span><b className={`text-[11.5px] tabular-nums ${item.tone === 'positive' ? 'text-success' : ''}`}>{hidden ? '•••' : item.amountLabel}</b></button>
              ))}
            </div>
          </div>
        </section>
      </main>

      {signalsSheet}
      <WebCalculationDrawer open={calculationOpen} onClose={() => setCalculationOpen(false)} equation={equation} currency={viewCurrency} hidden={hidden} accounts={accountRows} />
    </div>
  )
}
