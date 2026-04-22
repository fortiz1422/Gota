'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { linkGoogleAccount } from '@/lib/auth'
import { trackEvent } from '@/lib/product-analytics/client'

export function AnonymousBanner() {
  const [isAnon, setIsAnon] = useState(false)
  const [loading, setLoading] = useState(false)
  const seenTrackedRef = useRef(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const nextIsAnon = user?.is_anonymous === true
      setIsAnon(nextIsAnon)
      if (nextIsAnon && !seenTrackedRef.current) {
        seenTrackedRef.current = true
        trackEvent('anonymous_banner_seen')
      }
    }
    check()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
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

  const handleLink = async () => {
    setLoading(true)
    trackEvent('anonymous_link_started', { provider: 'google' })
    await linkGoogleAccount()
    setLoading(false)
  }

  return (
    <div
      className="fixed left-0 right-0 z-40
                 bg-[rgba(255,255,255,0.38)] backdrop-blur-[16px]
                 border-t border-[rgba(255,255,255,0.70)]
                 px-4 py-3 flex items-center justify-between gap-3"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}
    >
      <p className="text-xs text-text-secondary leading-snug flex-1">
        Modo exploración — guardá tu progreso conectando tu cuenta
      </p>
      <button
        onClick={handleLink}
        disabled={loading}
        className="shrink-0 px-4 py-2 rounded-lg text-xs font-semibold
                   bg-accent text-white
                   hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? 'Conectando…' : 'Guardar cuenta'}
      </button>
    </div>
  )
}
