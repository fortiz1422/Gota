'use client'

// THROWAWAY — preview determinístico de Home Intelligence (Fase D, guía v1.1).
// Acceder en desarrollo: /ui-exploration/home-intelligence?state=<id>
// No toca producción: consume fixtures + orquestador reales.

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { HomeIntelligencePreview } from '@/components/_exploration/HomeIntelligencePreview'
import {
  HOME_PREVIEW_STATES,
  resolvePreviewState,
} from '@/lib/intelligence/home-preview-fixtures'

function PreviewPage() {
  const params = useSearchParams()
  const stateId = params.get('state') ?? HOME_PREVIEW_STATES[0].id
  const bare = params.get('bare') === '1'
  const state = HOME_PREVIEW_STATES.find((item) => item.id === stateId) ?? HOME_PREVIEW_STATES[0]
  const resolved = resolvePreviewState(state)

  if (bare) {
    return <HomeIntelligencePreview state={resolved} />
  }

  return (
    <div className="min-h-screen bg-[#E8EFF5] px-4 py-6">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-5 rounded-xl bg-[#1A2B3C] px-5 py-4 text-[#E0F0FF]">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#6BB8E8]">
            Fase D — Preview determinístico · guía v1.1
          </p>
          <p className="mt-1 text-[13px]">
            {resolved.title} — {resolved.description} (casos {resolved.cases.join(', ')})
          </p>
        </div>
        <div className="mb-5 flex flex-wrap gap-2">
          {HOME_PREVIEW_STATES.map((item) => (
            <a
              key={item.id}
              href={`?state=${item.id}`}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                item.id === resolved.id
                  ? 'bg-primary text-white'
                  : 'bg-white text-text-secondary'
              }`}
            >
              {item.id}
            </a>
          ))}
        </div>
        <div className="overflow-hidden rounded-[28px] shadow-lg" style={{ width: 393, margin: '0 auto' }}>
          <HomeIntelligencePreview state={resolved} />
        </div>
      </div>
    </div>
  )
}

export default function HomeIntelligenceExplorationPage() {
  return (
    <Suspense fallback={null}>
      <PreviewPage />
    </Suspense>
  )
}
