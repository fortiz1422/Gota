'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CaretRight, EnvelopeSimple, Fingerprint, LockKey, ShieldCheck, SignOut, UserCircle } from '@phosphor-icons/react'
import styles from './MobileSettings.module.css'
import { SettingsDetail } from './SettingsDetail'
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
      <section className={styles.group} aria-labelledby="settings-access-title">
        <h2 id="settings-access-title">Acceso y seguridad</h2>
        <p className={styles.description}>Administrá cómo entrás a tu cuenta.</p>
        <div className={styles.rowGroup}>
          <div className={styles.identity}>
            <UserCircle size={20} weight="light" />
            <div><span className={styles.rowTitle}>Tu cuenta</span><span className={styles.rowDescription}>{emailLabel}</span></div>
          </div>
          {!isAnonymous && email && <>
            <button type="button" className={styles.row} onClick={() => {
              setPasswordSuccess(null)
              resetPasswordForm()
              setPasswordModalOpen(true)
            }}>
              <LockKey size={20} weight="light" />
              <span className={styles.rowBody}><span className={styles.rowTitle}>{accessLabel}</span><span className={styles.rowDescription}>{hasEmailProvider ? 'Acceso con mail y contraseña' : hasGoogle ? 'Sumá una contraseña a tu acceso con Google' : 'Entrá también con tu mail'}</span></span>
              <CaretRight size={16} weight="light" />
            </button>
            <SettingsDetail title="Passkeys" description="Biometría, PIN o llavero del dispositivo" icon={<Fingerprint size={20} weight="light" />}>
              <PasskeysPanel variant="mobile" />
            </SettingsDetail>
            {hasEmailProvider && <button type="button" onClick={handleSendReset} disabled={isSendingReset} className={styles.row}>
              <EnvelopeSimple size={20} weight="light" />
              <span className={styles.rowBody}><span className={styles.rowTitle}>{isSendingReset ? 'Enviando...' : 'Enviar mail de restablecimiento'}</span><span className={styles.rowDescription}>Recibí un enlace para redefinir tu contraseña</span></span>
            </button>}
          </>}
          {isAnonymous && <div className={styles.disclosureBody}>
            <p className={styles.rowTitle}>Modo exploracion</p>
            <p className={styles.rowDescription}>Para guardar esta cuenta sin perder datos, seguí usando el flujo de vinculacion desde el banner inferior. Después vas a poder sumar una passkey desde esta sección.</p>
          </div>}
        </div>
        {resetMessage && <p role="status" className="mt-2 text-xs text-success">{resetMessage}</p>}
        {!passwordModalOpen && <InlineError message={passwordError} />}
      </section>

      <section className={styles.group} aria-labelledby="settings-privacy-title">
        <h2 id="settings-privacy-title">Privacidad y datos</h2>
        <p className={styles.description}>Información sobre el uso y la eliminación de tus datos.</p>
        <div className={styles.rowGroup}>
          <Link href="/privacy" className={styles.row}>
            <ShieldCheck size={20} weight="light" />
            <span className={styles.rowBody}><span className={styles.rowTitle}>Cómo se usan tus datos</span><span className={styles.rowDescription}>Privacidad e inteligencia artificial en Gota</span></span>
            <CaretRight size={16} weight="light" />
          </Link>
          <div className={styles.deleteRow}><DeleteAccountControl /></div>
        </div>
      </section>
      <div className={styles.sessionActions}>
        <button type="button" onClick={handleLogout} disabled={isLoggingOut} className={styles.row}>
          <SignOut size={20} weight="light" />
          <span className={styles.rowTitle}>{isLoggingOut ? 'Cerrando...' : 'Cerrar sesión'}</span>
        </button>
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
