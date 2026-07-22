'use client'

import { useMemo, useState } from 'react'
import { ArrowRight } from '@phosphor-icons/react'
import { fmtMoney } from '@/components/dashboard/desktop/desktop-ui'
import type { MonthPaceBenchmark, MonthPaceModel, PaceMode } from '@/lib/web-panel/month-pace'

const WIDTH = 820
const HEIGHT = 220
const PAD_Y = 18

function pathFor(
  points: Array<{ day: number; amount: number | null }>,
  daysInMonth: number,
  maxAmount: number,
): string {
  const valid = points.filter((point): point is { day: number; amount: number } => point.amount !== null)
  return valid.map((point, index) => {
    const x = ((point.day - 1) / Math.max(1, daysInMonth - 1)) * WIDTH
    const y = HEIGHT - PAD_Y - (point.amount / Math.max(1, maxAmount)) * (HEIGHT - PAD_Y * 2)
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
}

function benchmarkFor(model: MonthPaceModel, mode: PaceMode): MonthPaceBenchmark | null {
  return mode === 'plan' ? model.plan : model.habitual
}

function signedMoney(amount: number, currency: 'ARS' | 'USD', hidden: boolean) {
  if (hidden) return fmtMoney(amount, currency, true)
  const absolute = fmtMoney(Math.abs(amount), currency, false)
  if (amount === 0) return absolute
  return `${amount > 0 ? '+' : '−'}${absolute}`
}

export function WebMonthPace({
  model,
  currency,
  hidden,
  daysInMonth,
  onOpenAnalysis,
}: {
  model: MonthPaceModel
  currency: 'ARS' | 'USD'
  hidden: boolean
  daysInMonth: number
  onOpenAnalysis: () => void
}) {
  const [preferredMode, setPreferredMode] = useState<PaceMode | null>(null)
  const mode: PaceMode | 'learning' =
    preferredMode && model.availableModes.includes(preferredMode)
      ? preferredMode
      : model.defaultMode

  const active = mode === 'learning' ? null : benchmarkFor(model, mode)
  const chart = useMemo(() => {
    if (!active) return null
    const all = active.points.flatMap(({ observed, benchmark }) => [observed, benchmark]).filter((value): value is number => value !== null)
    const maxAmount = Math.max(1, ...all) * 1.08
    const observedPath = pathFor(active.points.map(({ day, observed }) => ({ day, amount: observed })), daysInMonth, maxAmount)
    const benchmarkPath = pathFor(active.points.map(({ day, benchmark }) => ({ day, amount: benchmark })), daysInMonth, maxAmount)
    const current = [...active.points].reverse().find(({ observed }) => observed !== null) ?? null
    const currentX = current ? ((current.day - 1) / Math.max(1, daysInMonth - 1)) * WIDTH : 0
    const currentY = current && current.observed !== null
      ? HEIGHT - PAD_Y - (current.observed / maxAmount) * (HEIGHT - PAD_Y * 2)
      : 0
    return { observedPath, benchmarkPath, currentX, currentY }
  }, [active, daysInMonth])

  if (!active || !chart) {
    return (
      <section className="min-h-[180px] py-1">
        <p className="text-[10px] font-bold uppercase tracking-[.09em] text-text-tertiary">Este mes</p>
        <h2 className="mt-2 text-[24px] font-bold tracking-[-.04em] text-text-primary">Todavía no hay una referencia comparable.</h2>
        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-text-secondary">
          {model.learningCopy} Cuando exista un plan o suficiente historia, Gota va a mostrar la línea punteada y su base acá.
        </p>
        <button type="button" onClick={onOpenAnalysis} className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold text-primary">
          Abrir Análisis <ArrowRight size={14} />
        </button>
      </section>
    )
  }

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.09em] text-text-tertiary">Este mes</p>
          <h2 className="mt-2 max-w-[760px] text-[clamp(21px,2.2vw,27px)] font-bold leading-tight tracking-[-.04em] text-text-primary">{active.headline}</h2>
          <p className="mt-2 text-[12px] text-text-secondary">Gasto observado. Excluye pagos de tarjeta, transferencias y extraordinarios.</p>
        </div>
        {model.availableModes.length > 1 && (
          <div className="flex rounded-[8px] border border-[rgba(33,120,168,.12)] bg-bg-secondary p-[3px]">
            {model.availableModes.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPreferredMode(item)}
                className={`rounded-[6px] px-2.5 py-1.5 text-[10px] font-bold ${mode === item ? 'bg-white text-primary shadow-sm' : 'text-text-tertiary'}`}
              >
                {item === 'plan' ? 'Plan' : 'Habitual'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-x-9 gap-y-3">
        <div><p className="text-[10px] text-text-tertiary">Observado</p><p className="mt-1 text-[17px] font-bold tabular-nums">{fmtMoney(active.observedAmount, currency, hidden)}</p></div>
        <div><p className="text-[10px] text-text-tertiary">Referencia</p><p className="mt-1 text-[17px] font-bold tabular-nums">{fmtMoney(active.benchmarkAmount, currency, hidden)}</p></div>
        <div><p className="text-[10px] text-text-tertiary">Diferencia</p><p className={`mt-1 text-[17px] font-bold tabular-nums ${active.deltaAmount > 0 ? 'text-warning' : 'text-success'}`}>{signedMoney(active.deltaAmount, currency, hidden)}</p></div>
        <div><p className="text-[10px] text-text-tertiary">Ritmo</p><p className="mt-1 text-[17px] font-bold">{active.deltaPoints === null ? `${active.deltaPct > 0 ? '+' : ''}${active.deltaPct}%` : `${active.deltaPoints > 0 ? '+' : ''}${active.deltaPoints} pp`}</p></div>
      </div>

      <div className="mt-5 h-[220px] w-full">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="h-full w-full" role="img" aria-label={`Gasto observado comparado con ${active.benchmarkLabel}`}>
          {[55, 110, 165].map((y) => <line key={y} x1="0" x2={WIDTH} y1={y} y2={y} stroke="rgba(33,120,168,.08)" />)}
          <path d={chart.benchmarkPath} fill="none" stroke="#7E96A4" strokeWidth="2" strokeDasharray="7 8" vectorEffect="non-scaling-stroke" />
          <path d={chart.observedPath} fill="none" stroke="#2178A8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <line x1={chart.currentX} x2={chart.currentX} y1="0" y2={HEIGHT} stroke="rgba(33,120,168,.10)" strokeDasharray="3 5" />
          <circle cx={chart.currentX} cy={chart.currentY} r="6" fill="#fff" stroke="#2178A8" strokeWidth="4" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mt-1 flex justify-between text-[9.5px] text-text-tertiary"><span>1</span><span>7</span><span>14</span><span>Hoy</span><span>{daysInMonth}</span></div>
      <div className="mt-3 flex flex-wrap items-center gap-5 text-[10.5px] text-text-secondary">
        <span><i className="mr-1.5 inline-block h-0.5 w-4 bg-primary align-middle" />Gasto observado</span>
        <span><i className="mr-1.5 inline-block h-px w-4 border-t border-dashed border-text-tertiary align-middle" />{active.benchmarkLabel}</span>
      </div>
      <button type="button" onClick={onOpenAnalysis} className="mt-4 text-left text-[10.5px] font-semibold text-text-tertiary underline decoration-[rgba(33,120,168,.25)] underline-offset-4">
        {active.scopeLabel} · ver períodos y metodología
      </button>
    </section>
  )
}
