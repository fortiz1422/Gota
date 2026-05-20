'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/product-analytics/client'
import { AnonymousAccountUpgradeSheet } from '@/components/auth/AnonymousAccountUpgradeSheet'

export function AnonymousBanner() {
  const [isAnon, setIsAnon] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const seenTrackedRef = useRef(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const nextIsAnon = user?.is_anonymous === true
      setIsAnon(nextIsAnon)
      if (nextIsAnon && !seenTrackedRef.current) {
        seenTrackedRef.current = true
        trackEvent('anonymous_banner_seen')
      }
    }
    void check()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      const nextIsAnon = session?.user?.is_anonymous === true
      setIsAnon(nextIsAnon)
      if (nextIsAnon && !seenTrackedRef.current) {
        seenTrackedRef.current = true
        trackEvent('anonymous_banner_seen')
      }
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  if (!isAnon) return null

  return (
    <>
      <div
        className="fixed left-0 right-0 z-40 flex items-center justify-between gap-3 border-t border-[rgba(255,255,255,0.70)] bg-[rgba(255,255,255,0.38)] px-4 py-3 backdrop-blur-[16px]"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}
      >
        <p className="flex-1 text-xs leading-snug text-text-secondary">
          Modo exploración. Guardá tu progreso creando una cuenta nueva o entrando a una existente.
        </p>
        <button
          onClick={() => setSheetOpen(true)}
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
        >
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
