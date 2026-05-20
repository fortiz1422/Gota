'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowsClockwise, Bank, CaretRight, CreditCard, Lock, X } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import { InlineError } from '@/components/ui/InlineError'
import { CuentasSubSheet } from '@/components/settings/CuentasSubSheet'
import { DeleteAccountControl } from '@/components/settings/DeleteAccountControl'
import { HeroBalanceModeSheet } from '@/components/settings/HeroBalanceModeSheet'
import { SubscriptionsSubSheet } from '@/components/settings/SubscriptionsSubSheet'
import { TarjetasSubSheet } from '@/components/settings/TarjetasSubSheet'
import { createClient } from '@/lib/supabase/client'
import { updatePassword } from '@/lib/auth'
import type { HeroBalanceMode } from '@/types/database'

const MIN_PASSWORD_LENGTH = 8

interface Props {
  open: boolean
  onClose: () => void
  userEmail: string
  heroBalanceMode: HeroBalanceMode
  onHeroBalanceModeChange: (next: HeroBalanceMode) => void
}

const HERO_BALANCE_MODE_STORAGE_KEY = 'gota.hero_balance_mode'

export function CuentaSheet({
  open,
  onClose,
  userEmail,
  heroBalanceMode,
  onHeroBalanceModeChange,
}: Props) {
  const router = useRouter()
  const [cuentasOpen, setCuentasOpen] = useState(false)
  const [tarjetasOpen, setTarjetasOpen] = useState(false)
  const [subscriptionsOpen, setSubscriptionsOpen] = useState(false)
  const [accountCount, setAccountCount] = useState(0)
  const [cardCount, setCardCount] = useState(0)
  const [subscriptionCount, setSubscriptionCount] = useState(0)
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [isSavingCurrency, setIsSavingCurrency] = useState(false)
  const [isSavingHeroMode, setIsSavingHeroMode] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [heroBalanceModeOpen, setHeroBalanceModeOpen] = useState(false)
  const [authProviders, setAuthProviders] = useState<string[]>([])
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    Promise.all([
      fetch('/api/accounts').then((r) => r.json()),
      fetch('/api/cards').then((r) => r.json()),
      fetch('/api/subscriptions').then((r) => r.json()),
      fetch('/api/user-config').then((r) => r.json()),
      supabase.auth.getUser(),
    ])
      .then(([accounts, cards, subscriptions, config, { data: { user } }]) => {
        const rawProviders = (user?.app_metadata as { providers?: unknown } | undefined)?.providers
        setAuthProviders(Array.isArray(rawProviders) ? (rawProviders as string[]) : [])
        setIsAnonymous(user?.is_anonymous === true)
        setAccountCount(
          Array.isArray(accounts)
            ? accounts.filter((a: { archived: boolean }) => !a.archived).length
            : 0,
        )
        setCardCount(Array.isArray(cards) ? cards.length : 0)
        setSubscriptionCount(Array.isArray(subscriptions) ? subscriptions.length : 0)
        if (config?.default_currency) setCurrency(config.default_currency)
      })
      .catch(() => {})
  }, [open])

  const handleCurrencyChange = async (next: 'ARS' | 'USD') => {
    if (next === currency) return
    const prev = currency
    setCurrency(next)
    setIsSavingCurrency(true)
    try {
      const res = await fetch('/api/user-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_currency: next }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      setCurrency(prev)
    } finally {
      setIsSavingCurrency(false)
    }
  }

  const heroBalanceModeLabel = (() => {
    if (heroBalanceMode === 'combined_usd') return 'Total USD'
    if (heroBalanceMode === 'default_currency') return 'Moneda principal'
    return 'Total ARS'
  })()

  const handleHeroBalanceModeChange = async (next: HeroBalanceMode) => {
    if (next === heroBalanceMode) {
      setHeroBalanceModeOpen(false)
      return
    }
    onHeroBalanceModeChange(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(HERO_BALANCE_MODE_STORAGE_KEY, next)
    }
    setIsSavingHeroMode(true)
    try {
      const res = await fetch('/api/user-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hero_balance_mode: next }),
      })
      if (!res.ok) return
      router.refresh()
      setHeroBalanceModeOpen(false)
    } finally {
      setIsSavingHeroMode(false)
    }
  }

  const hasEmailProvider = authProviders.includes('email')
  const passwordLabel = hasEmailProvider ? 'Actualizar contraseña' : 'Crear contraseña'

  const resetPasswordForm = () => {
    setPassword('')
    setConfirmPassword('')
    setPasswordError(null)
  }

  const handlePasswordSave = async () => {
    setPasswordError(null)
    setPasswordSuccess(null)

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
        ? 'Contraseña actualizada.'
        : 'Contraseña creada. Ya podés entrar con mail y contraseña.'
    )
    resetPasswordForm()
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initial = userEmail.charAt(0).toUpperCase()

  return (
    <>
      <Modal open={open} onClose={onClose}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-text-primary">Mi cuenta</h2>
            <button onClick={onClose} className="text-text-tertiary hover:text-text-secondary">
              <X size={20} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary">
              <span className="text-lg font-bold text-white">{initial}</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text-primary">{userEmail}</p>
              <p className="text-[11px] text-text-tertiary">Usuario</p>
            </div>
          </div>

          <div
            className="overflow-hidden rounded-card"
            style={{
              background: 'rgba(255,255,255,0.38)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.70)',
            }}
          >
            <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-label">
              Configuracion
            </p>

            <button
              onClick={() => setCuentasOpen(true)}
              className="flex w-full items-center gap-3 border-b border-border-subtle px-4 py-3 text-left transition-colors hover:bg-primary/5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/8">
                <Bank weight="duotone" size={15} className="text-text-label" />
              </div>
              <span className="flex-1 text-sm text-text-primary">
                Cuentas{accountCount > 0 ? ` (${accountCount})` : ''}
              </span>
              <CaretRight size={14} className="text-text-dim" />
            </button>

            <button
              onClick={() => setTarjetasOpen(true)}
              className="flex w-full items-center gap-3 border-b border-border-subtle px-4 py-3 text-left transition-colors hover:bg-primary/5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/8">
                <CreditCard weight="duotone" size={15} className="text-text-label" />
              </div>
              <span className="flex-1 text-sm text-text-primary">
                Tarjetas{cardCount > 0 ? ` (${cardCount})` : ''}
              </span>
              <CaretRight size={14} className="text-text-dim" />
            </button>

            <button
              onClick={() => setSubscriptionsOpen(true)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/8">
                <ArrowsClockwise weight="duotone" size={15} className="text-text-label" />
              </div>
              <span className="flex-1 text-sm text-text-primary">
                Suscripciones{subscriptionCount > 0 ? ` (${subscriptionCount})` : ''}
              </span>
              <CaretRight size={14} className="text-text-dim" />
            </button>
          </div>

          <div
            className="overflow-hidden rounded-card"
            style={{
              background: 'rgba(255,255,255,0.38)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.70)',
            }}
          >
            <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-label">
              Preferencias
            </p>

            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
              <span className="text-sm text-text-primary">Moneda predeterminada</span>
              <div
                className="inline-flex items-center rounded-full border border-border-ocean p-0.5"
                style={{ background: 'rgba(255,255,255,0.50)' }}
              >
                {(['ARS', 'USD'] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => handleCurrencyChange(c)}
                    disabled={isSavingCurrency}
                    className={`rounded-button px-2.5 py-1 text-[11px] font-semibold transition-colors duration-150 disabled:opacity-50 ${
                      currency === c
                        ? 'bg-primary text-white'
                        : 'text-text-tertiary hover:text-text-secondary'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setHeroBalanceModeOpen(true)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/5"
            >
              <span className="flex-1 text-sm text-text-primary">Saldo Vivo</span>
              <span className="text-xs font-medium text-text-tertiary">{heroBalanceModeLabel}</span>
              <CaretRight size={14} className="text-text-dim" />
            </button>
          </div>

          {!isAnonymous && userEmail && (
            <div
              className="overflow-hidden rounded-card"
              style={{
                background: 'rgba(255,255,255,0.38)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.70)',
              }}
            >
              <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-label">
                Seguridad
              </p>
              <button
                onClick={() => {
                  setPasswordSuccess(null)
                  resetPasswordForm()
                  setPasswordModalOpen(true)
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-primary/5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/8">
                  <Lock weight="duotone" size={15} className="text-text-label" />
                </div>
                <span className="flex-1 text-sm text-text-primary">{passwordLabel}</span>
                <CaretRight size={14} className="text-text-dim" />
              </button>
            </div>
          )}

          <div className="space-y-2">
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
              className="w-full rounded-button border border-border-ocean py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
            >
              {isLoggingOut ? 'Cerrando...' : 'Cerrar sesion'}
            </button>

            <DeleteAccountControl />
          </div>
        </div>
      </Modal>

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
            <h2 className="text-base font-semibold text-text-primary">{passwordLabel}</h2>
            <p className="mt-1 text-sm text-text-tertiary">
              {hasEmailProvider
                ? 'Vas a actualizar la contraseña de esta cuenta.'
                : 'Vas a sumar una contraseña a esta misma cuenta. Tus datos no cambian.'}
            </p>
          </div>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nueva contraseña (mínimo 8 caracteres)"
            className="w-full rounded-input border border-border-ocean bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary outline-none"
          />

          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repetí la contraseña"
            className="w-full rounded-input border border-border-ocean bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary outline-none"
          />

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
              {isSavingPassword ? 'Guardando...' : passwordLabel}
            </button>
          </div>
        </div>
      </Modal>

      <CuentasSubSheet open={cuentasOpen} onClose={() => setCuentasOpen(false)} />
      <TarjetasSubSheet open={tarjetasOpen} onClose={() => setTarjetasOpen(false)} />
      <SubscriptionsSubSheet
        open={subscriptionsOpen}
        onClose={() => setSubscriptionsOpen(false)}
        defaultCurrency={currency}
      />
      <HeroBalanceModeSheet
        open={heroBalanceModeOpen}
        onClose={() => setHeroBalanceModeOpen(false)}
        value={heroBalanceMode}
        onChange={handleHeroBalanceModeChange}
        isSaving={isSavingHeroMode}
      />
    </>
  )
}
