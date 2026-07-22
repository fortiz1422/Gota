'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider'
import { WebPanelBriefV1 } from '@/components/dashboard/web-panel/WebPanelBriefV1'
import { SIGNALS_PREVIEW_STATES, resolveSignalsPreviewState } from '@/lib/intelligence/signals-preview-fixtures'
import {
  WEB_PANEL_PREVIEW_ANALYTICS,
  WEB_PANEL_PREVIEW_BUDGET,
  WEB_PANEL_PREVIEW_COMMITMENTS,
  WEB_PANEL_PREVIEW_DASHBOARD,
} from '@/lib/web-panel/preview-fixtures'

function WebPanelPreview() {
  const params = useSearchParams()
  const router = useRouter()
  const state = resolveSignalsPreviewState(params.get('state') ?? 'multiple-signals')
  const bare = params.get('bare') === '1'
  const initialOpen = params.get('open')
  const isLearning = state.id === 'learning-new-user' || state.id === 'needs-setup'
  const hasRisk = state.model.signals.some(({ severity }) => severity === 'risk')
  const analytics = isLearning
    ? {
        ...WEB_PANEL_PREVIEW_ANALYTICS,
        paceMovements: WEB_PANEL_PREVIEW_ANALYTICS.paceMovements.filter(({ date }) => date.startsWith('2026-07')),
      }
    : WEB_PANEL_PREVIEW_ANALYTICS
  const dashboard = hasRisk
    ? {
        ...WEB_PANEL_PREVIEW_DASHBOARD,
        heroBreakdown: { ARS: 200_000, USD: 0 },
        availableBreakdown: { ARS: -100_000, USD: 0 },
        goalCommitmentsBreakdown: { ARS: 0, USD: 0 },
        freeBreakdown: { ARS: -100_000, USD: 0 },
        accountBalances: [
          { id: 'galicia', name: 'Galicia', type: 'bank', is_primary: true, saldo: 120_000 },
          { id: 'mp', name: 'Mercado Pago', type: 'digital', is_primary: false, saldo: 60_000 },
          { id: 'cash', name: 'Efectivo', type: 'cash', is_primary: false, saldo: 20_000 },
        ],
      }
    : WEB_PANEL_PREVIEW_DASHBOARD
  const commitments = hasRisk
    ? {
        ...WEB_PANEL_PREVIEW_COMMITMENTS,
        totalDebt: 300_000,
        totalComprometido: 486_500,
        totalAPagar: 300_000,
        tarjetas: WEB_PANEL_PREVIEW_COMMITMENTS.tarjetas.map((card) => ({
          ...card,
          debtTotal: 300_000,
          debtCycles: card.debtCycles.map((cycle) => ({ ...cycle, amount: 300_000 })),
        })),
      }
    : WEB_PANEL_PREVIEW_COMMITMENTS

  const panel = (
    <WebPanelBriefV1
      key={`${state.id}:${state.amountsVisible}`}
      selectedMonth="2026-07"
      viewCurrency="ARS"
      userEmail="preview@gota.app"
      data={dashboard}
      analyticsData={analytics}
      analyticsLoading={false}
      analyticsError={false}
      budget={isLearning ? null : WEB_PANEL_PREVIEW_BUDGET}
      budgetLoading={false}
      budgetError={false}
      compromisos={commitments}
      quote={{ rate: 1_290 }}
      signalsModelOverride={state.model}
      initialHidden={!state.amountsVisible}
      initialSignalsOpen={initialOpen === 'signals'}
      initialCalculationOpen={initialOpen === 'calculation'}
      onSelectMonth={() => undefined}
      onOpenSettings={() => undefined}
      onNavigate={(href) => router.push(href)}
    />
  )

  if (bare) return panel

  return (
    <div className="min-h-screen bg-[#E8EFF5] pb-10">
      <header className="border-b border-black/10 bg-[#102331] px-5 py-4 text-white">
        <div className="mx-auto max-w-[1500px]">
          <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#73C5E8]">Web Panel v1 · preview determinístico</p>
          <p className="mt-1 text-xs text-white/65">{state.title} — {state.description}</p>
        </div>
      </header>
      <nav className="mx-auto flex max-w-[1500px] flex-wrap gap-2 px-5 py-4" aria-label="Escenarios">
        {SIGNALS_PREVIEW_STATES.map((item) => (
          <a key={item.id} href={`?state=${item.id}`} className={`rounded-full px-3 py-1.5 text-[11px] font-bold no-underline ${item.id === state.id ? 'bg-primary text-white' : 'bg-white text-text-secondary'}`}>{item.id}</a>
        ))}
      </nav>
      <div className="mx-auto max-w-[1500px] overflow-hidden rounded-[14px] bg-white shadow-lg">{panel}</div>
    </div>
  )
}

export default function WebPanelExplorationPage() {
  return <ReactQueryProvider><Suspense fallback={null}><WebPanelPreview /></Suspense></ReactQueryProvider>
}
