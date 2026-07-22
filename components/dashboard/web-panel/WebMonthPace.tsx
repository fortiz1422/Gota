'use client'

import { useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { ArrowRight } from '@phosphor-icons/react'
import { fmtMoney } from '@/components/dashboard/desktop/desktop-ui'
import { inspectPacePoint } from '@/lib/web-panel/month-pace'
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

function planHeadline(
  benchmark: MonthPaceBenchmark,
  currency: 'ARS' | 'USD',
  hidden: boolean,
): string {
  if (benchmark.deltaAmount === 0) {
    return 'En las categorías presupuestadas venís en línea con el ritmo esperado.'
  }
  return `En las categorías presupuestadas venís ${fmtMoney(Math.abs(benchmark.deltaAmount), currency, hidden)} ${benchmark.deltaAmount > 0 ? 'por encima' : 'por debajo'} del ritmo esperado.`
}

function categoryExceptionCopy(
  status: MonthPaceBenchmark['leadingCategoryStatus'],
): string {
  if (status === 'over_budget') return 'Ya superó el monto asignado en el presupuesto.'
  if (status === 'near_limit') return 'Ya consumió gran parte del monto asignado.'
  return 'Está consumiendo su presupuesto más rápido de lo previsto.'
}

function xForDay(day: number, daysInMonth: number) {
  return ((day - 1) / Math.max(1, daysInMonth - 1)) * WIDTH
}

function yForAmount(amount: number, maxAmount: number) {
  return HEIGHT - PAD_Y - (amount / Math.max(1, maxAmount)) * (HEIGHT - PAD_Y * 2)
}

function dayLabel(selectedMonth: string, day: number) {
  const value = new Date(`${selectedMonth}-${String(day).padStart(2, '0')}T12:00:00-03:00`)
    .toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'long' })
    .replace('.', '')
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function WebMonthPace({
  model,
  currency,
  hidden,
  selectedMonth,
  daysInMonth,
  onOpenAnalysis,
}: {
  model: MonthPaceModel
  currency: 'ARS' | 'USD'
  hidden: boolean
  selectedMonth: string
  daysInMonth: number
  onOpenAnalysis: () => void
}) {
  const [preferredMode, setPreferredMode] = useState<PaceMode | null>(null)
  const [inspectionDay, setInspectionDay] = useState<number | null>(null)
  const chartRef = useRef<HTMLDivElement>(null)
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
    const current = [...active.points].reverse().find(({ observed }) => observed !== null) ?? active.points[0] ?? null
    const currentX = current ? xForDay(current.day, daysInMonth) : 0
    const currentY = current?.observed !== null && current?.observed !== undefined
      ? yForAmount(current.observed, maxAmount)
      : 0
    return { observedPath, benchmarkPath, current, currentX, currentY, maxAmount }
  }, [active, daysInMonth])

  const inspection = active && inspectionDay !== null
    ? inspectPacePoint(active, inspectionDay)
    : null
  const inspectionX = inspection ? xForDay(inspection.day, daysInMonth) : null
  const inspectionObservedY = inspection?.observed !== null && inspection?.observed !== undefined && chart
    ? yForAmount(inspection.observed, chart.maxAmount)
    : null
  const inspectionBenchmarkY = inspection?.benchmark !== null && inspection?.benchmark !== undefined && chart
    ? yForAmount(inspection.benchmark, chart.maxAmount)
    : null

  function selectFromPointer(event: PointerEvent<HTMLDivElement>) {
    const rect = chartRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    setInspectionDay(Math.round(ratio * Math.max(1, daysInMonth - 1)) + 1)
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    selectFromPointer(event)
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' && !event.currentTarget.hasPointerCapture(event.pointerId)) return
    selectFromPointer(event)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentDay = inspectionDay ?? chart?.current?.day ?? 1
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      setInspectionDay(Math.max(1, Math.min(daysInMonth, currentDay + (event.key === 'ArrowLeft' ? -1 : 1))))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setInspectionDay(1)
    } else if (event.key === 'End') {
      event.preventDefault()
      setInspectionDay(daysInMonth)
    } else if (event.key === 'Escape') {
      setInspectionDay(null)
      event.currentTarget.blur()
    }
  }

  const ariaValue = inspection
    ? `${dayLabel(selectedMonth, inspection.day)}. ${active?.mode === 'plan' ? 'Dentro del plan' : 'Observado'} ${inspection.observed === null ? 'sin datos todavía' : fmtMoney(inspection.observed, currency, hidden)}. ${active?.benchmarkLabel ?? 'Referencia'} ${inspection.benchmark === null ? 'sin datos' : fmtMoney(inspection.benchmark, currency, hidden)}.`
    : 'Usá las flechas para inspeccionar el gráfico por día.'

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
          <h2 className="mt-2 max-w-[760px] text-[clamp(21px,2.2vw,27px)] font-bold leading-tight tracking-[-.04em] text-text-primary">{active.mode === 'plan' ? planHeadline(active, currency, hidden) : active.headline}</h2>
          <p className="mt-2 text-[12px] text-text-secondary">
            {active.mode === 'plan'
              ? 'Cuenta la compra al registrarla, incluso con tarjeta. El pago posterior no vuelve a sumarse.'
              : 'Gasto observado. Excluye pagos de tarjeta y extraordinarios.'}
          </p>
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
        <div><p className="text-[10px] text-text-tertiary">{active.mode === 'plan' ? 'Dentro del plan' : 'Observado'}</p><p className="mt-1 text-[17px] font-bold tabular-nums">{fmtMoney(active.observedAmount, currency, hidden)}</p></div>
        <div><p className="text-[10px] text-text-tertiary">{active.mode === 'plan' ? 'Esperado a esta altura' : 'Habitual a esta altura'}</p><p className="mt-1 text-[17px] font-bold tabular-nums">{fmtMoney(active.benchmarkAmount, currency, hidden)}</p></div>
        <div><p className="text-[10px] text-text-tertiary">Diferencia</p><p className={`mt-1 text-[17px] font-bold tabular-nums ${active.deltaAmount > 0 ? 'text-warning' : 'text-success'}`}>{signedMoney(active.deltaAmount, currency, hidden)}</p></div>
        <div><p className="text-[10px] text-text-tertiary">{active.mode === 'plan' ? 'Ritmo vs. plan' : 'Diferencia relativa'}</p><p className="mt-1 text-[17px] font-bold tabular-nums">{active.mode === 'plan' ? `${Math.abs(active.deltaPct).toLocaleString('es-AR', { maximumFractionDigits: 1 })}% ${active.deltaPct > 0 ? 'por encima' : active.deltaPct < 0 ? 'por debajo' : 'en línea'}` : `${active.deltaPct > 0 ? '+' : ''}${active.deltaPct}%`}</p></div>
      </div>

      <div
        ref={chartRef}
        role="slider"
        tabIndex={0}
        aria-label={`Inspeccionar ${active.mode === 'plan' ? 'gasto dentro del plan' : 'gasto observado'} comparado con ${active.benchmarkLabel}`}
        aria-valuemin={1}
        aria-valuemax={daysInMonth}
        aria-valuenow={inspection?.day ?? chart.current?.day ?? 1}
        aria-valuetext={ariaValue}
        onFocus={() => setInspectionDay((day) => day ?? chart.current?.day ?? 1)}
        onBlur={() => setInspectionDay(null)}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onPointerCancel={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
          setInspectionDay(null)
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') setInspectionDay(null)
        }}
        className="relative mt-5 h-[220px] w-full cursor-crosshair rounded-[8px] outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2"
        style={{ touchAction: 'pan-y' }}
      >
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
          {[55, 110, 165].map((y) => <line key={y} x1="0" x2={WIDTH} y1={y} y2={y} stroke="rgba(33,120,168,.08)" />)}
          <path d={chart.benchmarkPath} fill="none" stroke="#7E96A4" strokeWidth="2" strokeDasharray="7 8" vectorEffect="non-scaling-stroke" />
          <path d={chart.observedPath} fill="none" stroke="#2178A8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          {inspection && inspectionX !== null ? (
            <>
              <line x1={inspectionX} x2={inspectionX} y1="0" y2={HEIGHT} stroke="rgba(13,24,41,.24)" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
              {inspectionBenchmarkY !== null && <circle cx={inspectionX} cy={inspectionBenchmarkY} r="5" fill="#fff" stroke="#7E96A4" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
              {inspectionObservedY !== null && <circle cx={inspectionX} cy={inspectionObservedY} r="6" fill="#fff" stroke="#2178A8" strokeWidth="4" vectorEffect="non-scaling-stroke" />}
            </>
          ) : (
            <>
              <line x1={chart.currentX} x2={chart.currentX} y1="0" y2={HEIGHT} stroke="rgba(33,120,168,.10)" strokeDasharray="3 5" />
              <circle cx={chart.currentX} cy={chart.currentY} r="6" fill="#fff" stroke="#2178A8" strokeWidth="4" vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>
        {inspection && inspectionX !== null && (
          <div
            role="status"
            className={`pointer-events-none absolute top-2 z-10 w-[218px] rounded-[10px] border border-[rgba(33,120,168,.14)] bg-white/95 p-3 shadow-[0_10px_30px_rgba(13,24,41,.14)] backdrop-blur ${inspection.day > daysInMonth / 2 ? '-ml-2 -translate-x-full' : 'ml-2'}`}
            style={{ left: `${(inspectionX / WIDTH) * 100}%` }}
          >
            <p className="text-[10px] font-bold text-text-primary">{dayLabel(selectedMonth, inspection.day)}</p>
            <div className="mt-2 flex items-center justify-between gap-3 text-[10.5px]"><span className="text-text-tertiary">{active.mode === 'plan' ? 'Dentro del plan' : 'Observado'}</span><b className="tabular-nums text-text-primary">{inspection.observed === null ? 'Sin datos aún' : fmtMoney(inspection.observed, currency, hidden)}</b></div>
            <div className="mt-1.5 flex items-center justify-between gap-3 text-[10.5px]"><span className="text-text-tertiary">{active.mode === 'plan' ? 'Plan' : 'Habitual'}</span><b className="tabular-nums text-text-primary">{inspection.benchmark === null ? 'Sin referencia' : fmtMoney(inspection.benchmark, currency, hidden)}</b></div>
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-[rgba(33,120,168,.10)] pt-2 text-[10.5px]"><span className="text-text-tertiary">Diferencia</span><b className={`tabular-nums ${inspection.deltaAmount !== null && inspection.deltaAmount > 0 ? 'text-warning' : 'text-success'}`}>{inspection.deltaAmount === null ? 'Todavía no aplica' : inspection.deltaPct === null ? signedMoney(inspection.deltaAmount, currency, hidden) : `${signedMoney(inspection.deltaAmount, currency, hidden)} · ${inspection.deltaPct > 0 ? '+' : ''}${inspection.deltaPct.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`}</b></div>
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between text-[9.5px] text-text-tertiary"><span>1</span><span>7</span><span>14</span><span>Hoy</span><span>{daysInMonth}</span></div>
      <p className="mt-2 text-[9.5px] text-text-tertiary">Pasá el cursor o usá las flechas para inspeccionar cada día.</p>
      <div className="mt-3 flex flex-wrap items-center gap-5 text-[10.5px] text-text-secondary">
        <span><i className="mr-1.5 inline-block h-0.5 w-4 bg-primary align-middle" />{active.mode === 'plan' ? 'Gasto ordinario dentro del plan' : 'Gasto observado'}</span>
        <span><i className="mr-1.5 inline-block h-px w-4 border-t border-dashed border-text-tertiary align-middle" />{active.benchmarkLabel}</span>
      </div>

      {active.mode === 'plan' && (
        <div className="mt-5 border-t border-[rgba(33,120,168,.10)]">
          {active.leadingCategory && active.leadingCategoryStatus && (
            <button type="button" onClick={onOpenAnalysis} className="flex w-full items-center justify-between gap-4 border-b border-[rgba(33,120,168,.10)] py-3 text-left">
              <span>
                <b className="block text-[11.5px] text-text-primary">{active.leadingCategory} necesita atención</b>
                <small className="mt-1 block text-[9.5px] text-text-tertiary">{categoryExceptionCopy(active.leadingCategoryStatus)}</small>
              </span>
              <span className="shrink-0 text-[10px] font-bold text-primary">Ver categoría →</span>
            </button>
          )}
          {(active.outsidePlanAmount ?? 0) > 0 && (
            <button type="button" onClick={onOpenAnalysis} className="flex w-full items-center justify-between gap-4 border-b border-[rgba(33,120,168,.10)] py-3 text-left">
              <span className="text-[10.5px] leading-relaxed text-text-secondary">Además registraste <b className="tabular-nums text-text-primary">{fmtMoney(active.outsidePlanAmount ?? 0, currency, hidden)}</b> de gasto ordinario en categorías no incluidas en este presupuesto.</span>
              <span className="shrink-0 text-[10px] font-bold text-primary">Revisar →</span>
            </button>
          )}
          {(active.extraordinaryPlanAmount ?? 0) > 0 && (
            <div className="flex items-start justify-between gap-4 border-b border-[rgba(33,120,168,.10)] py-3 text-[10.5px] leading-relaxed text-text-secondary">
              <span><b className="tabular-nums text-text-primary">{fmtMoney(active.extraordinaryPlanAmount ?? 0, currency, hidden)}</b> de gastos extraordinarios en categorías presupuestadas se muestran aparte y no alteran esta línea.</span>
            </div>
          )}
        </div>
      )}

      <button type="button" onClick={onOpenAnalysis} className="mt-4 text-left text-[10.5px] font-semibold text-text-tertiary underline decoration-[rgba(33,120,168,.25)] underline-offset-4">
        {active.scopeLabel} · ver períodos y metodología
      </button>
    </section>
  )
}
