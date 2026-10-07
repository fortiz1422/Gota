'use client'

import { useState, useSyncExternalStore } from 'react'
import { useTour } from '@/hooks/useTour'

const EVENT = 'gota:home-guide-v2'
function subscribe(listener: () => void) {
  window.addEventListener('storage', listener)
  window.addEventListener(EVENT, listener)
  return () => {
    window.removeEventListener('storage', listener)
    window.removeEventListener(EVENT, listener)
  }
}

export function HomeWalkthroughInvitation({
  accountId,
  firstUse,
}: {
  accountId?: string
  firstUse: boolean
}) {
  const { start, isActive } = useTour()
  const [dismissed, setDismissed] = useState(false)
  const key = `gota.home-guide.v2:${accountId ?? ''}`
  const stored = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return Boolean(accountId && localStorage.getItem(key))
      } catch {
        return false
      }
    },
    () => false
  )
  function dismiss() {
    setDismissed(true)
    try {
      if (accountId) localStorage.setItem(key, 'seen')
    } catch {
      /* session fallback */
    }
    window.dispatchEvent(new Event(EVENT))
  }
  if (isActive) return null
  if (!firstUse || dismissed || stored)
    return (
      <div className="flex justify-end px-1">
        <button
          type="button"
          data-tour-replay="true"
          onClick={start}
          className="text-primary min-h-11 text-[12px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Ver guía rápida
        </button>
      </div>
    )
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 py-1">
      <p className="text-text-secondary text-[13px]">
        ¿Te mostramos cómo usar Gota?
      </p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => {
            dismiss()
            start()
          }}
          className="text-primary min-h-11 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Mostrarme
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="text-text-dim min-h-11 text-[12px] focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Ahora no
        </button>
      </div>
    </div>
  )
}
