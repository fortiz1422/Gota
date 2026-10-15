'use client'

import { useState } from 'react'
import { AnonymousAccountUpgradeSheet } from '@/components/auth/AnonymousAccountUpgradeSheet'
import { linkGoogleAccount } from '@/lib/auth'
import { trackEvent } from '@/lib/product-analytics/client'

export function SaveAccessNotice() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <>
      <div className="card-s5 flex items-center gap-2.5 px-3.5 py-3">
        <p className="m-0 flex-1 text-[13px] text-text-secondary">Guardá tu acceso para no perder tus datos.</p>
        <button
          type="button"
          className="text-[13px] font-semibold text-primary"
          onClick={() => {
            trackEvent('anonymous_link_started', { provider: 'google' })
            void linkGoogleAccount().then(({ error: linkError }) => {
              if (linkError) setError('No pudimos vincular Google. Probá con mail.')
            })
          }}
        >
          Google
        </button>
        <span className="text-[#B8C9D4]">·</span>
        <button
          type="button"
          className="text-[13px] font-semibold text-primary"
          onClick={() => {
            trackEvent('anonymous_link_started', { provider: 'email' })
            setSheetOpen(true)
          }}
        >
          Mail
        </button>
      </div>
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
      <AnonymousAccountUpgradeSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  )
}
