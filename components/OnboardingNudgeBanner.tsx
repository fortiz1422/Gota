'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { X } from '@phosphor-icons/react'

const DISMISS_KEY = 'onboarding_nudge_dismissed'

export function OnboardingNudgeBanner() {
  const [show, setShow] = useState(false)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY)) return

    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: config } = await supabase
        .from('user_config')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .single()

      if (!config?.onboarding_completed) setShow(true)
    }
    check()
  }, [supabase])

  useEffect(() => {
    const syncComposerState = () => {
      setIsComposerOpen(document.documentElement.dataset.bottomComposer === 'open')
    }

    syncComposerState()
    window.addEventListener('gota:bottom-composer', syncComposerState)
    return () => window.removeEventListener('gota:bottom-composer', syncComposerState)
  }, [])

  if (!show || isComposerOpen) return null

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setShow(false)
  }

  return (
    <div
      className="fixed left-0 right-0 z-40
                 bg-[rgba(255,255,255,0.38)] backdrop-blur-[16px]
                 border-t border-[rgba(255,255,255,0.70)]
                 px-4 py-3 flex items-center justify-between gap-3"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}
    >
      <p className="flex-1 text-xs leading-snug text-text-secondary">
        Para ver tu Saldo Vivo real necesitamos tu ingreso del mes.
      </p>
      <button
        onClick={() => router.push('/onboarding')}
        className="shrink-0 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
      >
        Configurar
      </button>
      <button onClick={handleDismiss} aria-label="Cerrar" className="shrink-0 p-1 text-text-tertiary">
        <X size={16} />
      </button>
    </div>
  )
}
