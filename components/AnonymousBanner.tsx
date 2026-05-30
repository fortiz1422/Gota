'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnonymousAccountUpgradeSheet } from '@/components/auth/AnonymousAccountUpgradeSheet'
import {
  useAnonymousBannerTone,
  type AnonymousBannerTone,
} from '@/components/anonymous-banner/AnonymousBannerToneProvider'
import { trackEvent } from '@/lib/product-analytics/client'
import { createClient } from '@/lib/supabase/client'

type AnonymousBannerProps = {
  initialIsAnonymous?: boolean
}

type BannerToneContent = {
  containerClassName: string
  copy: string
  buttonClassName: string
}

function getToneContent(tone: AnonymousBannerTone): BannerToneContent {
  if (tone === 'supporting') {
    return {
      containerClassName:
        'fixed left-0 right-0 z-40 flex items-center justify-between gap-3 border-t border-border-subtle bg-bg-primary/82 px-4 py-2.5 backdrop-blur-[16px]',
      copy: 'Modo exploración. Guardá tu cuenta para no perder lo que cargues.',
      buttonClassName:
        'shrink-0 rounded-button border border-primary/20 bg-white px-3.5 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/8',
    }
  }

  return {
    containerClassName:
      'fixed left-0 right-0 z-40 flex items-center justify-between gap-3 border-t border-[rgba(255,255,255,0.70)] bg-[rgba(255,255,255,0.38)] px-4 py-3 backdrop-blur-[16px]',
    copy: 'Modo exploración. Guardá tu progreso creando una cuenta nueva o entrando a una existente.',
    buttonClassName:
      'shrink-0 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90',
  }
}

export function AnonymousBanner({ initialIsAnonymous = false }: AnonymousBannerProps) {
  const [isAnon, setIsAnon] = useState(initialIsAnonymous)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const seenTrackedRef = useRef(false)
  const supabase = useMemo(() => createClient(), [])
  const { tone } = useAnonymousBannerTone()
  const toneContent = getToneContent(tone)

  useEffect(() => {
    if (initialIsAnonymous && !seenTrackedRef.current) {
      seenTrackedRef.current = true
      trackEvent('anonymous_banner_seen')
    }
  }, [initialIsAnonymous])

  useEffect(() => {
    const syncAnonymousState = (nextIsAnon: boolean) => {
      setIsAnon(nextIsAnon)
      if (nextIsAnon && !seenTrackedRef.current) {
        seenTrackedRef.current = true
        trackEvent('anonymous_banner_seen')
      }
    }

    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      syncAnonymousState(user?.is_anonymous === true)
    }
    void check()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      syncAnonymousState(session?.user?.is_anonymous === true)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    const syncComposerState = () => {
      setIsComposerOpen(document.documentElement.dataset.bottomComposer === 'open')
    }

    syncComposerState()
    window.addEventListener('gota:bottom-composer', syncComposerState)
    return () => window.removeEventListener('gota:bottom-composer', syncComposerState)
  }, [])

  if (!isAnon || isComposerOpen) return null

  return (
    <>
      <div
        className={toneContent.containerClassName}
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}
      >
        <p className="flex-1 text-xs leading-snug text-text-secondary">{toneContent.copy}</p>
        <button onClick={() => setSheetOpen(true)} className={toneContent.buttonClassName}>
          Guardar cuenta
        </button>
      </div>

      <AnonymousAccountUpgradeSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  )
}
