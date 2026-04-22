'use client'

import { useState } from 'react'
import { InlineError } from '@/components/ui/InlineError'
import { createClient } from '@/lib/supabase/client'
import { signInAnonymously } from '@/lib/auth'

export function LoginButton() {
  const [exploring, setExploring] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [exploreError, setExploreError] = useState<string | null>(null)

  const handleExplore = async () => {
    setExploring(true)
    setLoginError(null)
    setExploreError(null)
    const { error } = await signInAnonymously()
    if (error) {
      console.error('Anonymous sign-in error:', error)
      setExploreError(error.message)
      setExploring(false)
    } else {
      // Hard reload para que el server component lea la nueva sesión
      window.location.href = '/'
    }
  }

  const handleLogin = async () => {
    console.log('Login button clicked')
    setLoginError(null)
    setExploreError(null)
    try {
      const supabase = createClient()
      console.log('Supabase client created')

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      console.log('OAuth result:', { data, error })

      if (error) {
        setLoginError(error.message || 'No se pudo iniciar sesion con Google.')
        return
      }

      if (data?.url) {
        window.location.href = data.url
      }
    } catch (e) {
      console.error('Login exception:', e)
      setLoginError('No se pudo iniciar sesion. Intenta de nuevo.')
    }
  }

  return (
    <>
    <button
      onClick={handleLogin}
      className="flex w-full items-center justify-center gap-3 rounded-button bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-transform active:scale-95 hover:scale-[1.02]"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
      Continuar con Google
    </button>

    <InlineError message={loginError} className="mt-3" />

    <div className="flex items-center gap-3 my-4">
      <div className="h-px flex-1 bg-[rgba(255,255,255,0.70)]" />
      <span className="text-sm text-text-tertiary">o</span>
      <div className="h-px flex-1 bg-[rgba(255,255,255,0.70)]" />
    </div>

    <button
      onClick={handleExplore}
      disabled={exploring}
      className="w-full py-3 rounded-xl text-sm font-medium
                 text-text-secondary border border-[rgba(255,255,255,0.70)]
                 bg-[rgba(255,255,255,0.38)] backdrop-blur-[16px]
                 hover:bg-[rgba(255,255,255,0.52)] transition-all duration-200
                 disabled:opacity-50"
    >
      {exploring ? 'Entrando…' : 'Explorar sin cuenta'}
    </button>

    {exploreError && (
      <p className="text-xs text-center text-danger mt-2">{exploreError}</p>
    )}

    <p className="text-xs text-center text-text-tertiary mt-3">
      Tus datos se guardan en este dispositivo hasta que conectes tu cuenta
    </p>
  </>
  )
}
