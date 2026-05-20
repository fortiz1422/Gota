'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { InlineError } from '@/components/ui/InlineError'
import { trackEvent } from '@/lib/product-analytics/client'
import { updatePassword } from '@/lib/auth'

const MIN_PASSWORD_LENGTH = 8

export default function CreatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async () => {
    setErrorMessage(null)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.')
      return
    }

    setIsSaving(true)
    const { error } = await updatePassword(password)
    setIsSaving(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    trackEvent('anonymous_link_completed', { provider: 'email' })
    router.push('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <div
        className="w-full max-w-sm rounded-card p-5"
        style={{
          background: 'rgba(255,255,255,0.38)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.70)',
        }}
      >
        <h1 className="text-lg font-semibold text-text-primary">Creá tu contraseña</h1>
        <p className="mt-2 text-sm text-text-tertiary">
          Verificaste el mail de esta cuenta nueva. Definí una contraseña para seguir entrando sin perder tu progreso.
        </p>

        <div className="mt-5 space-y-3">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Nueva contraseña"
            className="w-full rounded-input border border-border-ocean bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary outline-none"
          />

          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Repeti la contraseña"
            className="w-full rounded-input border border-border-ocean bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary outline-none"
          />

          <InlineError message={errorMessage} />

          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="w-full rounded-button bg-primary py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSaving ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </div>
      </div>
    </div>
  )
}
