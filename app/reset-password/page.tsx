'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { InlineError } from '@/components/ui/InlineError'
import { updatePassword } from '@/lib/auth'

const MIN_PASSWORD_LENGTH = 8

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async () => {
    setErrorMessage(null)
    setSuccessMessage(null)

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

    setSuccessMessage('Contraseña actualizada. Ya podés volver al inicio.')
    setPassword('')
    setConfirmPassword('')
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
        <h1 className="text-lg font-semibold text-text-primary">Nueva contraseña</h1>
        <p className="mt-2 text-sm text-text-tertiary">
          Definí una contraseña para seguir entrando con mail y contraseña sobre la misma cuenta.
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

          {successMessage && (
            <p className="text-xs font-medium text-success">{successMessage}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="w-full rounded-button bg-primary py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSaving ? 'Guardando...' : 'Guardar contraseña'}
          </button>

          <button
            onClick={() => router.push('/')}
            className="w-full rounded-button border border-border-ocean py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-primary/5"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  )
}
