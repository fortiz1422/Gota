'use client'

import { ArrowClockwise, CaretRight, CheckCircle, CircleNotch } from '@phosphor-icons/react'
import type { DataQuality } from '@/lib/intelligence/types'
import type { SignalCoverage, SignalOccurrence } from '@/lib/intelligence/signal-center'
import {
  DATA_QUALITY_COPY,
  maskSignalOccurrence,
  SEVERITY_DISPLAY,
} from '@/lib/intelligence/signal-center-display'

interface Props {
  signals: SignalOccurrence[]
  coverage: SignalCoverage[]
  dataQuality: DataQuality
  amountsVisible: boolean
  loading?: boolean
  error?: string | null
  isHistoricalContext?: boolean
  onRetry?: () => void
  onSelectSignal: (signal: SignalOccurrence) => void
}

export function SignalsNowView({
  signals,
  coverage,
  dataQuality,
  amountsVisible,
  loading = false,
  error = null,
  isHistoricalContext = false,
  onRetry,
  onSelectSignal,
}: Props) {
  if (loading) {
    return (
      <div role="status" className="grid min-h-56 place-items-center px-6 text-center">
        <div>
          <CircleNotch size={25} className="mx-auto animate-spin text-primary" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-text-secondary">Revisando tus señales…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="mx-5 mt-6 rounded-[18px] border border-danger/15 bg-danger-soft p-5">
        <p className="font-bold text-text-primary">No pudimos cargar tus señales</p>
        <p className="mt-1 text-sm leading-relaxed text-text-secondary">{error}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white">
            <ArrowClockwise size={16} aria-hidden="true" /> Reintentar
          </button>
        )}
      </div>
    )
  }


  if (signals.length === 0) {
    const learning = coverage.some(({ state }) => state === 'learning')
    const needsSetup = coverage.some(({ state }) => state === 'needs_setup')
    if (needsSetup || dataQuality === 'insufficient') {
      return <EmptyState title="Completá tu cobertura" copy="Hay señales que necesitan cuentas, tarjetas o presupuestos configurados. Revisá Cobertura para ver qué falta." />
    }
    if (learning) {
      return <EmptyState title="Gota está aprendiendo" copy="A medida que registres movimientos, vamos a poder detectar cambios con más confianza." />
    }
    return <EmptyState title="Todo tranquilo por ahora" copy="No encontramos nada que necesite tu atención con los datos actuales." calm />
  }

  return (
    <div className="px-5 pb-8 pt-5">
      {isHistoricalContext && (
        <p className="mb-3 rounded-[14px] bg-primary-soft px-3 py-2.5 text-xs font-semibold leading-relaxed text-primary">
          Estas son Señales de hoy. El mes histórico sigue visible detrás.
        </p>
      )}
      <p className="mb-3 text-xs font-medium text-text-tertiary">{DATA_QUALITY_COPY[dataQuality]}</p>
      <div className="space-y-3">
        {signals.map((rawSignal) => {
          const signal = maskSignalOccurrence(rawSignal, amountsVisible)
          const severity = SEVERITY_DISPLAY[signal.severity]
          return (
            <button
              key={signal.version}
              type="button"
              onClick={() => onSelectSignal(rawSignal)}
              className="card-s5 flex w-full items-start gap-3 p-4 text-left transition-transform active:scale-[0.99]"
            >
              <span className={`mt-0.5 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] ${severity.toneClass}`}>
                {severity.label}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold leading-snug text-text-primary">{signal.title}</span>
                <span className="mt-1 block text-[13px] leading-relaxed text-text-secondary">{signal.summary}</span>
              </span>
              <CaretRight size={16} className="mt-1 shrink-0 text-text-tertiary" aria-hidden="true" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function EmptyState({ title, copy, calm = false }: { title: string; copy: string; calm?: boolean }) {
  return (
    <div className="px-7 py-12 text-center">
      <span className={`mx-auto grid h-12 w-12 place-items-center rounded-full ${calm ? 'bg-success-soft text-success' : 'bg-primary-soft text-primary'}`}>
        <CheckCircle size={25} weight="regular" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-lg font-extrabold text-text-primary">{title}</h3>
      <p className="mx-auto mt-2 max-w-[290px] text-sm leading-relaxed text-text-secondary">{copy}</p>
    </div>
  )
}
