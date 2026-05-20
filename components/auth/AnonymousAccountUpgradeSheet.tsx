'use client'

import { useState } from 'react'
import { InlineError } from '@/components/ui/InlineError'
import { Modal } from '@/components/ui/Modal'
import { linkGoogleAccount, signInWithGoogle, signInWithEmailPassword, startAnonymousEmailUpgrade } from '@/lib/auth'
import { trackEvent } from '@/lib/product-analytics/client'

interface AnonymousAccountUpgradeSheetProps {
  open: boolean
  onClose: () => void
}

export function AnonymousAccountUpgradeSheet({
  open,
  onClose,
}: AnonymousAccountUpgradeSheetProps) {
  const [email, setEmail] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isEmailLoading, setIsEmailLoading] = useState(false)
  const [existingEmail, setExistingEmail] = useState('')
  const [existingPassword, setExistingPassword] = useState('')
  const [existingError, setExistingError] = useState<string | null>(null)
  const [isExistingGoogleLoading, setIsExistingGoogleLoading] = useState(false)
  const [isExistingEmailLoading, setIsExistingEmailLoading] = useState(false)

  const resetState = () => {
    setEmail('')
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsGoogleLoading(false)
    setIsEmailLoading(false)
    setExistingEmail('')
    setExistingPassword('')
    setExistingError(null)
    setIsExistingGoogleLoading(false)
    setIsExistingEmailLoading(false)
  }

  const handleClose = () => {
    onClose()
    resetState()
  }

  const handleGoogleLink = async () => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsGoogleLoading(true)
    trackEvent('anonymous_link_started', { provider: 'google' })
    await linkGoogleAccount()
    setIsGoogleLoading(false)
  }

  const handleEmailUpgrade = async () => {
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!email.trim()) {
      setErrorMessage('Ingresa tu mail.')
      return
    }

    setIsEmailLoading(true)
    trackEvent('anonymous_link_started', { provider: 'email' })
    const { error } = await startAnonymousEmailUpgrade(email.trim())
    setIsEmailLoading(false)

    if (error) {
      const normalizedMessage = error.message.toLowerCase()
      if (normalizedMessage.includes('already') || normalizedMessage.includes('exists')) {
        setErrorMessage('Ese mail ya tiene una cuenta. Entrá desde "Ya tengo cuenta".')
        return
      }

      setErrorMessage(error.message)
      return
    }

    setSuccessMessage('Te enviamos un mail para verificar esta cuenta nueva.')
  }

  const handleExistingGoogleSignIn = async () => {
    setExistingError(null)
    setIsExistingGoogleLoading(true)
    trackEvent('anonymous_upgrade_existing_account_selected', { provider: 'google' })
    const { error } = await signInWithGoogle()
    if (error) {
      setExistingError('No se pudo iniciar sesión. Intentá de nuevo.')
      setIsExistingGoogleLoading(false)
    }
    // si no hay error redirige a OAuth, no hace falta setIsLoading(false)
  }

  const handleExistingEmailSignIn = async () => {
    setExistingError(null)

    if (!existingEmail.trim()) {
      setExistingError('Ingresá tu mail.')
      return
    }
    if (!existingPassword) {
      setExistingError('Ingresá tu contraseña.')
      return
    }

    setIsExistingEmailLoading(true)
    trackEvent('anonymous_upgrade_existing_account_selected', { provider: 'email' })
    const { error } = await signInWithEmailPassword(existingEmail.trim(), existingPassword)
    setIsExistingEmailLoading(false)

    if (error) {
      setExistingError('Mail o contraseña incorrectos.')
      return
    }

    window.location.href = '/'
  }

  return (
    <Modal open={open} onClose={handleClose}>
      <div className="space-y-5">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Guardar tu progreso</h2>
          <p className="mt-1 text-sm text-text-tertiary">
            Solo crear una cuenta nueva conserva automáticamente lo hecho en modo exploración.
          </p>
        </div>

        <div className="rounded-card border border-border-ocean bg-bg-tertiary p-4">
          <p className="text-sm font-semibold text-text-primary">Crear cuenta nueva</p>
          <p className="mt-1 text-xs leading-snug text-text-tertiary">
            Convierte esta sesión en una cuenta permanente sin cambiar el usuario ni perder datos.
          </p>

          <div className="mt-4 space-y-3">
            <button
              onClick={handleGoogleLink}
              disabled={isGoogleLoading || isEmailLoading}
              className="flex w-full items-center justify-center gap-3 rounded-button bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-transform hover:scale-[1.01] active:scale-95 disabled:opacity-50"
            >
              Continuar con Google
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border-ocean" />
              <span className="text-xs text-text-tertiary">o</span>
              <div className="h-px flex-1 bg-border-ocean" />
            </div>

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@mail.com"
              className="w-full rounded-input border border-border-ocean bg-bg-secondary px-3 py-2.5 text-sm text-text-primary outline-none"
              autoComplete="email"
            />

            <button
              onClick={handleEmailUpgrade}
              disabled={isGoogleLoading || isEmailLoading}
              className="w-full rounded-button bg-primary py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isEmailLoading ? 'Enviando...' : 'Continuar con mail'}
            </button>
          </div>
        </div>

        <div className="rounded-card border border-border-ocean bg-bg-tertiary p-4">
          <p className="text-sm font-semibold text-text-primary">Ya tengo cuenta</p>
          <p className="mt-1 text-xs leading-snug text-warning">
            Entrar a una cuenta existente no fusiona automáticamente lo hecho en modo exploración.
          </p>

          <div className="mt-4 space-y-3">
            <button
              onClick={handleExistingGoogleSignIn}
              disabled={isExistingGoogleLoading || isExistingEmailLoading}
              className="flex w-full items-center justify-center gap-3 rounded-button bg-white px-4 py-3 text-sm font-semibold text-gray-900 shadow-sm transition-transform hover:scale-[1.01] active:scale-95 disabled:opacity-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {isExistingGoogleLoading ? 'Redirigiendo...' : 'Entrar con Google'}
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border-ocean" />
              <span className="text-xs text-text-tertiary">o</span>
              <div className="h-px flex-1 bg-border-ocean" />
            </div>

            <input
              type="email"
              value={existingEmail}
              onChange={(e) => setExistingEmail(e.target.value)}
              placeholder="tu@mail.com"
              className="w-full rounded-input border border-border-ocean bg-bg-secondary px-3 py-2.5 text-sm text-text-primary outline-none"
              autoComplete="email"
            />

            <input
              type="password"
              value={existingPassword}
              onChange={(e) => setExistingPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full rounded-input border border-border-ocean bg-bg-secondary px-3 py-2.5 text-sm text-text-primary outline-none"
              autoComplete="current-password"
            />

            <button
              onClick={handleExistingEmailSignIn}
              disabled={isExistingGoogleLoading || isExistingEmailLoading}
              className="w-full rounded-button bg-primary py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isExistingEmailLoading ? 'Entrando...' : 'Entrar'}
            </button>

            {existingError && (
              <p className="text-xs font-medium text-danger">{existingError}</p>
            )}
          </div>
        </div>

        <InlineError message={errorMessage} />

        {successMessage && (
          <p className="text-xs font-medium text-success">{successMessage}</p>
        )}
      </div>
    </Modal>
  )
}
