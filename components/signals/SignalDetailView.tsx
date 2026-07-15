'use client'

import { ArrowLeft, ArrowSquareOut, ChatCircle } from '@phosphor-icons/react'
import type { SignalOccurrence } from '@/lib/intelligence/signal-center'
import { DATA_QUALITY_COPY, formatSignalDate, maskSignalOccurrence, SEVERITY_DISPLAY } from '@/lib/intelligence/signal-center-display'

interface Props {
  signal: SignalOccurrence
  amountsVisible: boolean
  onBack: () => void
  onNavigate?: (href: string) => void
  onAsk?: (question: string) => void
}

export function SignalDetailView({ signal: rawSignal, amountsVisible, onBack, onNavigate, onAsk }: Props) {
  const signal = maskSignalOccurrence(rawSignal, amountsVisible)
  const severity = SEVERITY_DISPLAY[signal.severity]
  const navigateAction = signal.action?.type === 'navigate' ? signal.action : null
  const askQuestion = signal.action?.type === 'ask' ? signal.action.question : signal.askQuestion
  const askLabel = signal.action?.type === 'ask' ? signal.action.label : 'Preguntarle a Gota'

  return (
    <div className="min-h-full bg-bg-secondary pb-8">
      <div className="blue-zone px-5 pb-7 pt-4 text-white">
        <button type="button" onClick={onBack} className="header-glass grid h-9 w-9 place-items-center rounded-full" aria-label="Volver a Señales">
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <span className="mt-5 inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em]">{severity.label}</span>
        <h2 className="mt-3 text-[24px] font-extrabold leading-tight tracking-[-0.02em]">{signal.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/80">{signal.summary}</p>
      </div>

      <div className="relative -mt-4 px-5">
        <section className="card-s5 p-5" aria-labelledby="signal-reading-title">
          <h3 id="signal-reading-title" className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-tertiary">Qué vemos</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-text-primary">{signal.message}</p>
        </section>

        {signal.evidence.length > 0 && (
          <section className="card-s5 mt-3 p-5" aria-labelledby="signal-evidence-title">
            <h3 id="signal-evidence-title" className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-tertiary">Evidencia</h3>
            <dl className="mt-2">
              {signal.evidence.map((item, index) => (
                <div key={`${item.label}-${index}`} className={`flex items-start justify-between gap-4 py-2.5 ${index ? 'border-t border-separator' : ''}`}>
                  <dt className="text-[13px] leading-snug text-text-secondary">
                    {item.label}
                    {item.asOf && <span className="mt-0.5 block text-[11px] text-text-tertiary">Al {formatSignalDate(item.asOf)}</span>}
                  </dt>
                  <dd className="shrink-0 text-right text-[14px] font-bold tabular-nums text-text-primary">{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {(signal.caveats.length > 0 || signal.dataQuality !== 'ok') && (
          <section className="mt-4 px-1" aria-label="Alcance de la señal">
            <p className="text-xs leading-relaxed text-text-tertiary">{DATA_QUALITY_COPY[signal.dataQuality]}</p>
            {signal.caveats.map((caveat) => <p key={caveat} className="mt-1.5 text-xs leading-relaxed text-text-tertiary">{caveat}</p>)}
          </section>
        )}

        <div className="mt-6 grid gap-2">
          {navigateAction && onNavigate && (
            <button type="button" onClick={() => onNavigate(navigateAction.href)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-white">
              {navigateAction.label} <ArrowSquareOut size={17} aria-hidden="true" />
            </button>
          )}
          {askQuestion && onAsk && (
            <button type="button" onClick={() => onAsk(askQuestion)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary-soft px-4 text-sm font-bold text-primary">
              <ChatCircle size={18} aria-hidden="true" /> {askLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
