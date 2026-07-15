'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { SignalsPreview } from '@/components/_exploration/SignalsPreview'
import { SIGNALS_PREVIEW_STATES, resolveSignalsPreviewState } from '@/lib/intelligence/signals-preview-fixtures'

function PreviewPage() {
  const params = useSearchParams()
  const state = resolveSignalsPreviewState(params.get('state'))
  const bare = params.get('bare') === '1'

  if (bare) return <SignalsPreview state={state} />

  return (
    <main className="min-h-screen bg-[#E8EFF5] px-4 py-6">
      <div className="mx-auto max-w-[1100px]">
        <header className="mb-5 rounded-xl bg-[#1A2B3C] px-5 py-4 text-[#E0F0FF]">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6BB8E8]">Signals — preview determinístico</p>
          <p className="mt-1 text-[13px]">{state.title} — {state.description}</p>
        </header>
        <nav aria-label="Escenarios de Signals" className="mb-5 flex flex-wrap gap-2">
          {SIGNALS_PREVIEW_STATES.map((item) => (
            <a key={item.id} href={`?state=${item.id}`} className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${item.id === state.id ? 'bg-primary text-white' : 'bg-white text-text-secondary'}`}>
              {item.id}
            </a>
          ))}
        </nav>
        <div className="mx-auto h-[852px] w-[393px] overflow-hidden rounded-[28px] shadow-lg">
          <SignalsPreview key={state.id} state={state} />
        </div>
      </div>
    </main>
  )
}

export default function SignalsExplorationPage() {
  return <Suspense fallback={null}><PreviewPage /></Suspense>
}
