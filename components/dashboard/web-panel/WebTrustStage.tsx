'use client'

import { ArrowRight, Calculator } from '@phosphor-icons/react'
import type { WebBrief } from '@/lib/web-panel/panel-model'
import type { MoneyEquation } from '@/lib/web-panel/panel-model'
import { fmtMoney } from '@/components/dashboard/desktop/desktop-ui'

const TONE = {
  learning: '#B9D6E1',
  calm: '#8DE2B0',
  watch: '#FFD29A',
  risk: '#FF9B91',
  historical: '#B9D6E1',
} as const

export function WebTrustStage({
  equation,
  brief,
  currency,
  hidden,
  isCurrentMonth,
  freshness,
  onOpenCalculation,
  onOpenSignals,
  onNavigate,
  onAsk,
}: {
  equation: MoneyEquation
  brief: WebBrief
  currency: 'ARS' | 'USD'
  hidden: boolean
  isCurrentMonth: boolean
  freshness: string
  onOpenCalculation: () => void
  onOpenSignals: () => void
  onNavigate: (href: string) => void
  onAsk: (question: string) => void
}) {
  const realRatio = equation.saldoVivo > 0
    ? Math.max(0, Math.min(100, (equation.disponibleReal / equation.saldoVivo) * 100))
    : 0
  const signal = brief.primarySignal
  const action = signal?.action

  function runAction() {
    if (!action) {
      onOpenSignals()
      return
    }
    if (action.type === 'navigate') onNavigate(action.href)
    else onAsk(action.question)
  }

  return (
    <section className="overflow-hidden bg-[linear-gradient(108deg,#2178A8_0%,#1B6A93_58%,#155875_100%)] text-white">
      <div className="relative mx-auto grid max-w-[1500px] gap-9 px-6 py-9 lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,.72fr)] lg:gap-16 xl:px-10">
        <div className="pointer-events-none absolute -right-36 -top-96 h-[540px] w-[540px] rounded-full border border-white/10 shadow-[0_0_0_70px_rgba(255,255,255,.025),0_0_0_150px_rgba(255,255,255,.018)]" />
        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] text-white/55">
            <span className="h-[7px] w-[7px] rounded-full bg-[#8DE2B0]" />
            <span>{freshness}</span>
            <button type="button" onClick={onOpenCalculation} className="border-0 bg-transparent font-bold text-white/85">Ver fuentes</button>
          </div>
          <p className="mt-5 text-[10.5px] font-bold uppercase tracking-[.1em] text-white/55">
            {isCurrentMonth ? 'Saldo Vivo' : 'Saldo actual · fuera del cierre histórico'}
          </p>
          <div className="mt-1 flex flex-wrap items-end gap-4">
            <strong className="text-[clamp(46px,5vw,68px)] font-extrabold leading-none tracking-[-.06em] tabular-nums">
              {fmtMoney(equation.saldoVivo, currency, hidden)}
            </strong>
            <span className="mb-1 rounded-[7px] border border-white/15 bg-white/10 px-2 py-1 text-[10px] text-white/65">
              {currency} · sin sumar ingresos futuros
            </span>
          </div>

          <div className="mt-7 max-w-[820px]">
            <div className="flex h-[7px] overflow-hidden rounded-full bg-white/10">
              <span className="bg-white" style={{ width: `${realRatio}%` }} />
              <span className="flex-1 bg-[repeating-linear-gradient(135deg,rgba(255,255,255,.43)_0_3px,rgba(255,255,255,.14)_3px_7px)]" />
            </div>
            <div className="mt-3 grid sm:grid-cols-2">
              <div className="pr-6">
                <p className="text-[10px] font-bold uppercase tracking-[.07em] text-white/50">Disponible Real</p>
                <p className="mt-1 text-xl font-bold tabular-nums">{fmtMoney(equation.disponibleReal, currency, hidden)}</p>
                <p className="mt-1 text-[10.5px] text-white/45">Sin pisar obligaciones de tarjeta ya causadas.</p>
              </div>
              <div className="mt-4 border-t border-white/15 pt-4 sm:mt-0 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
                <p className="text-[10px] font-bold uppercase tracking-[.07em] text-white/50">Ya causado en tarjetas</p>
                <p className="mt-1 text-xl font-bold tabular-nums">{fmtMoney(equation.causedCardCommitments, currency, hidden)}</p>
                <p className="mt-1 text-[10.5px] text-white/45">Resúmenes pendientes y consumos registrados.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-white/60">
              <span className="grid h-4 w-4 place-items-center rounded-[4px] border border-white/20 text-[8px]">✓</span>
              <span>
                Después de <b className="text-white">{fmtMoney(equation.goalCommitments, currency, hidden)}</b> apartados a metas, quedan{' '}
                <b className="text-white">{fmtMoney(equation.disponibleLibre, currency, hidden)}</b> libres.
              </span>
              <button type="button" onClick={onOpenCalculation} className="ml-auto inline-flex items-center gap-1 border-0 border-b border-white/30 bg-transparent pb-0.5 text-[11px] font-bold text-white/80">
                <Calculator size={13} /> Cómo se calcula
              </button>
            </div>
            {!equation.reconciles && (
              <p className="mt-3 text-[11px] font-semibold text-[#FFD29A]">
                La descomposición disponible no reconcilia todavía. Gota conserva los valores fuente y evita afirmar una disponibilidad libre.
              </p>
            )}
          </div>
        </div>

        <aside className="relative self-center border-t border-white/20 pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.09em] text-white/55">
            <span className="h-2 w-2 rounded-full" style={{ background: TONE[brief.status] }} />
            {brief.status === 'risk' ? 'Requiere una decisión' : brief.status === 'watch' ? 'Una decisión ahora' : brief.status === 'learning' ? 'Lectura parcial' : brief.status === 'historical' ? 'Contexto histórico' : 'Lectura de hoy'}
          </div>
          <h1 className="mt-3 max-w-[470px] text-[clamp(23px,2.2vw,30px)] font-bold leading-[1.16] tracking-[-.04em] text-balance">
            {brief.title}
          </h1>
          <p className="mt-2 max-w-[470px] text-[13px] leading-relaxed text-white/65">{brief.summary}</p>
          {(signal || brief.secondaryCount > 0) && (
            <div className="mt-5 flex flex-wrap items-center gap-4">
              {signal && (
                <button type="button" onClick={runAction} className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-white px-3 text-[11px] font-bold text-[#1B6A93]">
                  {action?.label ?? 'Ver evidencia'} <ArrowRight size={13} />
                </button>
              )}
              {(action || brief.secondaryCount > 0) && (
                <button type="button" onClick={onOpenSignals} className="border-0 bg-transparent text-[11px] font-bold text-white/80">
                  {brief.secondaryCount > 0 ? `${brief.secondaryCount} señales más →` : 'Ver evidencia →'}
                </button>
              )}
            </div>
          )}
          <p className="mt-4 text-[10px] text-white/35">Lectura determinística · la explicación conserva fuentes y alcance</p>
        </aside>
      </div>
    </section>
  )
}
