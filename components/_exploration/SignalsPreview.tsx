'use client'

import { useRef, useState } from 'react'
import { SignalsBellButton } from '@/components/signals/SignalsBellButton'
import { SignalsSheet } from '@/components/signals/SignalsSheet'
import type { SignalsPreviewState } from '@/lib/intelligence/signals-preview-fixtures'

export function SignalsPreview({ state }: { state: SignalsPreviewState }) {
  const [open, setOpen] = useState(true)
  const [feedback, setFeedback] = useState<string | null>(null)
  const bellRef = useRef<HTMLButtonElement>(null)

  return (
    <div
      className="relative h-[852px] w-[393px] overflow-hidden bg-bg-primary"
      style={{ fontFamily: 'var(--font-sans)' }}
    >
      <div className="blue-zone px-5 pb-12 pt-5 text-white">
        <div className="flex items-center justify-between">
          <SignalsBellButton
            ref={bellRef}
            tone={state.model.signals.length > 0 ? 'watch' : 'none'}
            onClick={() => setOpen(true)}
          />
          <span className="text-sm font-semibold text-white/85">Julio 2026</span>
          <span className="header-glass grid h-9 w-9 place-items-center rounded-full text-lg" aria-hidden="true">
            +
          </span>
        </div>
        <p className="mt-7 text-xs font-semibold uppercase tracking-[0.1em] text-white/60">Saldo Vivo</p>
        <p className="mt-2 text-3xl font-extrabold">$ 1.250.000</p>
      </div>

      <SignalsSheet
        open={open}
        onClose={() => setOpen(false)}
        model={state.model}
        amountsVisible={state.amountsVisible}
        isHistoricalContext={state.isHistoricalContext}
        triggerRef={bellRef}
        onViewed={() => undefined}
        onNavigate={(href) => setFeedback(`Navegación nativa: ${href}`)}
        onAsk={(question) => setFeedback(`Pregunta: ${question}`)}
      />

      {feedback && <PreviewToast copy={feedback} />}
    </div>
  )
}

function PreviewToast({ copy }: { copy: string }) {
  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 z-[90] max-w-[350px] -translate-x-1/2 rounded-xl bg-text-primary px-4 py-3 text-xs font-semibold text-white shadow-lg"
    >
      {copy}
    </div>
  )
}
