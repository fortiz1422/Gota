'use client'

import { useState } from 'react'
import { Bell, X } from '@phosphor-icons/react'
import type { SignalsPreviewState } from '@/lib/intelligence/signals-preview-fixtures'
import type { SignalOccurrence } from '@/lib/intelligence/signal-center'
import { SignalDetailView } from '@/components/signals/SignalDetailView'
import { SignalsCoverageView } from '@/components/signals/SignalsCoverageView'
import { SignalsNowView } from '@/components/signals/SignalsNowView'

export function SignalsPreview({ state }: { state: SignalsPreviewState }) {
  const [tab, setTab] = useState<'now' | 'coverage'>('now')
  const [detail, setDetail] = useState<SignalOccurrence | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  if (detail) {
    return (
      <div className="h-[852px] w-[393px] overflow-y-auto bg-bg-secondary">
        <SignalDetailView
          signal={detail}
          amountsVisible={state.amountsVisible}
          onBack={() => setDetail(null)}
          onNavigate={(href) => setFeedback(`Navegación nativa: ${href}`)}
          onAsk={(question) => setFeedback(`Pregunta: ${question}`)}
        />
        {feedback && <PreviewToast copy={feedback} />}
      </div>
    )
  }

  return (
    <div className="relative h-[852px] w-[393px] overflow-y-auto bg-bg-secondary" style={{ fontFamily: 'var(--font-sans)' }}>
      <div className="blue-zone px-5 pb-7 pt-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/65">Centro personal</p>
            <h1 className="mt-1 text-[25px] font-extrabold">Señales</h1>
          </div>
          <button type="button" aria-label="Cerrar Señales" className="header-glass grid h-9 w-9 place-items-center rounded-full">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-white/75">Cambios que vale la pena mirar, con la evidencia que Gota usó.</p>
      </div>

      <div className="relative -mt-4 px-5">
        <div role="tablist" aria-label="Vistas de Señales" className="card-s5 flex gap-1 p-1.5">
          {(['now', 'coverage'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`min-h-10 flex-1 rounded-[13px] text-sm font-bold ${tab === value ? 'bg-primary text-white' : 'text-text-secondary'}`}
            >
              {value === 'now' ? 'Ahora' : 'Cobertura'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'now' ? (
        <SignalsNowView
          signals={state.model.signals}
          coverage={state.model.coverage}
          dataQuality={state.model.dataQuality}
          amountsVisible={state.amountsVisible}
          isHistoricalContext={state.isHistoricalContext}
          onSelectSignal={setDetail}
        />
      ) : (
        <SignalsCoverageView coverage={state.model.coverage} />
      )}
      <span className="sr-only"><Bell /> Preview de campana de Señales</span>
      {feedback && <PreviewToast copy={feedback} />}
    </div>
  )
}

function PreviewToast({ copy }: { copy: string }) {
  return <div role="status" className="fixed bottom-4 left-1/2 z-50 max-w-[350px] -translate-x-1/2 rounded-xl bg-text-primary px-4 py-3 text-xs font-semibold text-white shadow-lg">{copy}</div>
}
