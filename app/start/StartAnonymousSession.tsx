'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ensureAnonymousSession, resetAnonymousSessionGuard } from '@/lib/start-entry'
import { createClient } from '@/lib/supabase/client'
import styles from '@/components/onboarding/landing-flow.module.css'

export function StartAnonymousSession() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void ensureAnonymousSession({
      getSession: async () => {
        const { data } = await createClient().auth.getSession()
        return Boolean(data.session)
      },
      signIn: async () => {
        const { error: signInError } = await createClient().auth.signInAnonymously()
        if (signInError) throw signInError
      },
    })
      .then(() => {
        if (cancelled) return
        router.replace('/onboarding')
        router.refresh()
      })
      .catch(() => {
        if (!cancelled) setError('No pudimos abrir Gota. Intentá de nuevo.')
      })
    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <main className={styles.shell}>
      <div className={styles.screen}>
        <div className={styles.top}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.wordmark} src="/brand/gota-wordmark-primary.svg" alt="Gota" />
        </div>
        <p className={styles.lead}>{error ?? 'Preparando tu inicio…'}</p>
        {error ? (
          <button
            type="button"
            className={`${styles.cta} mt-8`}
            onClick={() => {
              resetAnonymousSessionGuard()
              setError(null)
              window.location.reload()
            }}
          >
            Reintentar
          </button>
        ) : null}
      </div>
    </main>
  )
}
