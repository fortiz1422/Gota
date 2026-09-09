'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { CaretRight, EnvelopeSimple, Fingerprint, LockKey, ShieldCheck, SignOut, UserCircle } from '@phosphor-icons/react'
import styles from './MobileSettings.module.css'
import { SettingsDetail } from './SettingsDetail'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DeleteAccountControl } from '@/components/settings/DeleteAccountControl'
import { PasskeysPanel } from '@/components/auth/PasskeysPanel'
import { InlineError } from '@/components/ui/InlineError'
import { TaskSurface } from '@/components/ui/TaskSurface'
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
  const passwordInputRef = useRef<HTMLInputElement>(null)
  const passwordTriggerRef = useRef<HTMLButtonElement>(null)

  const hasGoogle = authProviders.includes('google')
  const hasEmailProvider = authProviders.includes('email')
  const accessLabel = hasEmailProvider ? 'Actualizar contraseña' : 'Crear contraseña'
  const emailLabel = email || 'Sin mail vinculado'

  const closePasswordTask = () => {
    setPasswordModalOpen(false)
    setPasswordSuccess(null)
    resetPasswordForm()
  }

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
      <section className={styles.group} aria-labelledby="settings-account-title">
        <h2 id="settings-account-title">Tu cuenta</h2>
        <p className={styles.description}>Tu identidad dentro de Gota.</p>
        <div className={styles.rowGroup}>
          <div className={styles.identity}>
            <UserCircle size={20} weight="light" />
            <div><span className={styles.rowTitle}>{isAnonymous ? 'Modo exploración' : 'Cuenta personal'}</span><span className={styles.rowDescription}>{emailLabel}</span></div>
          </div>
        </div>
      </section>

      <section className={styles.group} aria-labelledby="settings-access-title">
        <h2 id="settings-access-title">Acceso</h2>
        <p className={styles.description}>Administrá cómo entrás a tu cuenta.</p>
        <div className={styles.rowGroup}>
          {!isAnonymous && email && <>
            <button ref={passwordTriggerRef} type="button" className={styles.row} onClick={() => {
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

      <TaskSurface
        open={passwordModalOpen}
        onClose={closePasswordTask}
        appearance="compact"
        navigationTitle={accessLabel}
        eyebrow="ACCESO"
        title={accessLabel}
        description={hasEmailProvider
          ? 'Actualizá la contraseña del mismo usuario.'
          : 'Sumá acceso por contraseña sin crear otra cuenta.'}
        initialFocusRef={passwordInputRef}
        triggerRef={passwordTriggerRef}
        footer={
          <button
            type="button"
            onClick={() => void handlePasswordSave()}
            disabled={isSavingPassword || !password || !confirmPassword}
            className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSavingPassword ? 'Guardando...' : accessLabel}
          </button>
        }
      >
        <div className="space-y-4">
          <section data-password-edit className="surface-module overflow-hidden rounded-card border border-border-subtle bg-white">
            <label className="block px-4 pb-4 pt-4">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-text-label">
                Nueva contraseña
              </span>
              <input
                ref={passwordInputRef}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full border-0 border-b border-border-strong bg-transparent px-0 pb-2 pt-1 text-base text-text-primary outline-none focus:border-primary focus:ring-0"
                placeholder="Mínimo 8 caracteres"
              />
            </label>

            <label className="block border-t border-border-subtle px-4 py-4">
              <span className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-text-label">
                Repetir contraseña
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full border-0 border-b border-border-strong bg-transparent px-0 pb-2 pt-1 text-base text-text-primary outline-none focus:border-primary focus:ring-0"
                placeholder="Repetí la contraseña"
              />
            </label>
          </section>

          <InlineError message={passwordError} />
          {passwordSuccess ? <p className="text-xs font-medium text-success">{passwordSuccess}</p> : null}
          <p className="text-xs leading-5 text-text-tertiary">
            Tus movimientos y preferencias siguen asociados a la misma cuenta.
          </p>
        </div>
      </TaskSurface>
    </>
  )
}
