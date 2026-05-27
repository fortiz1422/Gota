'use client'

import { useState } from 'react'
import { InlineError } from '@/components/ui/InlineError'
import { createClient } from '@/lib/supabase/client'
import {
  requestPasswordReset,
  signInAnonymously,
  signInWithEmailPassword,
  signUpWithEmailPassword,
} from '@/lib/auth'

const MIN_PASSWORD_LENGTH = 8

export function LoginButton() {
  const [exploring, setExploring] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [exploreError, setExploreError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailMessage, setEmailMessage] = useState<string | null>(null)
  const [isEmailLoading, setIsEmailLoading] = useState(false)
  const [isSignupLoading, setIsSignupLoading] = useState(false)
  const [isResetLoading, setIsResetLoading] = useState(false)

  const clearEmailStatus = () => {
    setEmailError(null)
    setEmailMessage(null)
  }

  const handleExplore = async () => {
    setExploring(true)
    setLoginError(null)
    setExploreError(null)
    clearEmailStatus()
    const { error } = await signInAnonymously()
    if (error) {
      console.error('Anonymous sign-in error:', error)
      setExploreError(error.message)
      setExploring(false)
    } else {
      window.location.href = '/'
    }
  }

  const validateEmailFlow = () => {
    clearEmailStatus()

    if (!email.trim()) {
      setEmailError('Ingresa tu mail.')
      return false
    }

    if (!password) {
      setEmailError('Ingresa tu contraseña.')
      return false
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setEmailError('La contraseña debe tener al menos 8 caracteres.')
      return false
    }

    return true
  }

  const handleEmailLogin = async () => {
    if (!validateEmailFlow()) return

    setIsEmailLoading(true)
    const { error } = await signInWithEmailPassword(email.trim(), password)
    setIsEmailLoading(false)

    if (error) {
      setEmailError(error.message)
      return
    }

    window.location.href = '/'
  }

  const handleEmailSignup = async () => {
    if (!validateEmailFlow()) return

    setIsSignupLoading(true)
    const { error } = await signUpWithEmailPassword(email.trim(), password)
    setIsSignupLoading(false)

    if (error) {
      setEmailError(error.message)
      return
    }

    setEmailMessage(
      'Si el mail es nuevo, te enviamos un correo para confirmar la cuenta. Si ya usabas Google con este mail, entra con Google y crea la contraseña desde Cuenta.'
    )
  }

  const handlePasswordReset = async () => {
    clearEmailStatus()

    if (!email.trim()) {
      setEmailError('Ingresa tu mail para recibir el enlace.')
      return
    }

    setIsResetLoading(true)
    const { error } = await requestPasswordReset(email.trim())
    setIsResetLoading(false)

    if (error) {
      setEmailError(error.message)
      return
    }

    setEmailMessage(
      'Si existe una cuenta para este mail, te enviamos un enlace para redefinir la contraseña.'
    )
  }

  const handleLogin = async () => {
    console.log('Login button clicked')
    setLoginError(null)
    setExploreError(null)
    clearEmailStatus()
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
    } catch (error) {
      console.error('Login exception:', error)
      setLoginError('No se pudo iniciar sesion. Intenta de nuevo.')
    }
  }

  return (
    <>
      <button
        onClick={handleLogin}
        className="flex w-full items-center justify-center gap-3 rounded-button bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-transform hover:scale-[1.02] active:scale-95"
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

      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-separator" />
        <span className="text-sm text-text-tertiary">o</span>
        <div className="h-px flex-1 bg-separator" />
      </div>

      <div className="card-s5 mb-4 p-4">
        <p className="mb-3 text-left text-sm font-semibold text-text-primary">
          Continuar con mail
        </p>

        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@mail.com"
            className="w-full rounded-input border border-border-ocean bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary outline-none"
            autoComplete="email"
          />

          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Contraseña"
            className="w-full rounded-input border border-border-ocean bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary outline-none"
            autoComplete="current-password"
          />

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleEmailLogin}
              disabled={isEmailLoading || isSignupLoading}
              className="rounded-button bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isEmailLoading ? 'Entrando...' : 'Entrar'}
            </button>
            <button
              onClick={handleEmailSignup}
              disabled={isEmailLoading || isSignupLoading}
              className="rounded-button border border-border-ocean px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
            >
              {isSignupLoading ? 'Creando...' : 'Crear cuenta'}
            </button>
          </div>

          <button
            onClick={handlePasswordReset}
            disabled={isResetLoading}
            className="w-full text-left text-xs font-medium text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
          >
            {isResetLoading ? 'Enviando enlace...' : 'Olvide mi contraseña'}
          </button>

          <InlineError message={emailError} />

          {emailMessage && (
            <p className="text-left text-xs text-success">{emailMessage}</p>
          )}

          <p className="text-left text-[11px] leading-snug text-text-tertiary">
            Si ya venias entrando con Google en este mismo mail, no crees otra cuenta: entra con Google y agrega contraseña desde Cuenta.
          </p>
        </div>
      </div>

      <button
        onClick={handleExplore}
        disabled={exploring}
        className="w-full rounded-card border border-separator bg-bg-secondary py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-tertiary disabled:opacity-50"
      >
        {exploring ? 'Entrando...' : 'Explorar sin cuenta'}
      </button>

      {exploreError && (
        <p className="mt-2 text-center text-xs text-danger">{exploreError}</p>
      )}

      <p className="mt-3 text-center text-xs text-text-tertiary">
        Tus datos se guardan en este dispositivo hasta que conectes tu cuenta
      </p>
    </>
  )
}
