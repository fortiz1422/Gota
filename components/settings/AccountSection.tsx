'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DeleteAccountControl } from '@/components/settings/DeleteAccountControl'
import { PasskeysPanel } from '@/components/auth/PasskeysPanel'
import { InlineError } from '@/components/ui/InlineError'
import { Modal } from '@/components/ui/Modal'
import { requestPasswordReset, updatePassword } from '@/lib/auth'

interface AccountSectionProps {
  email: string
  isAnonymous: boolean
  authProviders: string[]
}

const MIN_PASSWORD_LENGTH = 8

export function AccountSection({
  email,
  isAnonymous,
  authProviders,
}: AccountSectionProps) {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [resetMessage, setResetMessage] = useState<string | null>(null)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [isSendingReset, setIsSendingReset] = useState(false)

  const hasGoogle = authProviders.includes('google')
  const hasEmailProvider = authProviders.includes('email')
  const accessLabel = hasEmailProvider ? 'Actualizar contraseña' : 'Crear contraseña'
  const emailLabel = email || 'Sin mail vinculado'

  const handleLogout = async () => {
    setIsLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const resetPasswordForm = () => {
    setPassword('')
    setConfirmPassword('')
    setPasswordError(null)
  }

  const handlePasswordSave = async () => {
    setPasswordError(null)
    setPasswordSuccess(null)

    if (!email) {
      setPasswordError('Esta cuenta no tiene un mail vinculado.')
      return
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden.')
      return
    }

    setIsSavingPassword(true)
    const { error } = await updatePassword(password)
    setIsSavingPassword(false)

    if (error) {
      setPasswordError(error.message)
      return
    }

    setPasswordSuccess(
      hasEmailProvider
        ? 'Contraseña actualizada. Ya podés seguir entrando con mail y contraseña.'
        : 'Contraseña creada. Esta cuenta mantiene los mismos datos y ahora también admite login por mail.'
    )
    resetPasswordForm()
    router.refresh()
  }

  const handleSendReset = async () => {
    if (!email) return

    setPasswordError(null)
    setResetMessage(null)
    setIsSendingReset(true)
    const { error } = await requestPasswordReset(email)
    setIsSendingReset(false)

    if (error) {
      setPasswordError(error.message)
      return
    }

    setResetMessage('Te enviamos un mail para redefinir la contraseña.')
  }

  return (
    <>
      <div
        className="space-y-3 rounded-card p-4"
        style={{
          background: 'rgba(255,255,255,0.38)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.70)',
        }}
      >
        <p className="rounded-input bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary">
          {emailLabel}
        </p>

        {!isAnonymous && email && (
          <div className="rounded-input bg-bg-tertiary px-3 py-3">
            <p className="text-sm font-medium text-text-primary">Acceso</p>
            <p className="mt-1 text-xs text-text-tertiary">
              {hasEmailProvider
                ? 'Ya podés entrar con mail y contraseña. También podés cambiarla o pedir un mail de restablecimiento.'
                : hasGoogle
                  ? 'Entraste con Google. Podés agregar una contraseña a esta misma cuenta sin duplicar usuario ni perder datos.'
                  : 'Podés crear una contraseña para entrar con mail.'}
            </p>

            <div className="mt-3">
              <PasskeysPanel variant="mobile" />
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <button
                onClick={() => {
                  setPasswordSuccess(null)
                  resetPasswordForm()
                  setPasswordModalOpen(true)
                }}
                className="w-full rounded-button border border-border-ocean py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-primary/5"
              >
                {accessLabel}
              </button>

              {hasEmailProvider && (
                <button
                  onClick={handleSendReset}
                  disabled={isSendingReset}
                  className="w-full rounded-button py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-primary/5 disabled:opacity-50"
                >
                  {isSendingReset ? 'Enviando...' : 'Enviar mail de restablecimiento'}
                </button>
              )}
            </div>

            {resetMessage && (
              <p className="mt-2 text-xs text-success">{resetMessage}</p>
            )}
          </div>
        )}

        {isAnonymous && (
          <div className="rounded-input bg-bg-tertiary px-3 py-3">
            <p className="text-sm font-medium text-text-primary">Modo exploracion</p>
            <p className="mt-1 text-xs text-text-tertiary">
              Para guardar esta cuenta sin perder datos, seguí usando el flujo de vinculacion desde el banner inferior. Después vas a poder sumar una passkey desde esta sección.
            </p>
          </div>
        )}

        <div className="rounded-input bg-bg-tertiary px-3 py-2.5">
          <Link
            href="/privacy"
            className="block text-sm font-medium text-text-primary transition-colors hover:text-primary"
          >
            Privacidad y datos
          </Link>
          <p className="mt-1 text-xs text-text-tertiary">
            SmartInput usa IA para interpretar el texto que escribis y proponer un gasto editable.
          </p>
        </div>

        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full rounded-button py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
        >
          {isLoggingOut ? 'Cerrando...' : 'Cerrar sesion'}
        </button>

        <DeleteAccountControl />
      </div>

      <Modal
        open={passwordModalOpen}
        onClose={() => {
          setPasswordModalOpen(false)
          setPasswordSuccess(null)
          resetPasswordForm()
        }}
      >
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">{accessLabel}</h2>
            <p className="mt-1 text-sm text-text-tertiary">
              {hasEmailProvider
                ? 'Vas a actualizar la contraseña del mismo usuario.'
                : 'Vas a sumar una contraseña a esta misma cuenta. Tus datos siguen atados al mismo usuario.'}
            </p>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-text-label">
              Nueva contraseña
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-input border border-border-ocean bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary outline-none"
              placeholder="Minimo 8 caracteres"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-text-label">
              Repetir contraseña
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-input border border-border-ocean bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary outline-none"
              placeholder="Repeti la contraseña"
            />
          </label>

          <InlineError message={passwordError} />

          {passwordSuccess && (
            <p className="text-xs font-medium text-success">{passwordSuccess}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => {
                setPasswordModalOpen(false)
                setPasswordSuccess(null)
                resetPasswordForm()
              }}
              className="flex-1 rounded-button border border-border-ocean py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-primary/5"
            >
              Cancelar
            </button>
            <button
              onClick={handlePasswordSave}
              disabled={isSavingPassword}
              className="flex-1 rounded-button bg-primary py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isSavingPassword ? 'Guardando...' : accessLabel}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
