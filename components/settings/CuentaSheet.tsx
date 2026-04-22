'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowsClockwise, Bank, CaretRight, CreditCard, X } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import { CuentasSubSheet } from '@/components/settings/CuentasSubSheet'
import { DeleteAccountControl } from '@/components/settings/DeleteAccountControl'
import { SubscriptionsSubSheet } from '@/components/settings/SubscriptionsSubSheet'
import { TarjetasSubSheet } from '@/components/settings/TarjetasSubSheet'
import { createClient } from '@/lib/supabase/client'

interface Props {
  open: boolean
  onClose: () => void
  userEmail: string
}

export function CuentaSheet({ open, onClose, userEmail }: Props) {
  const router = useRouter()
  const [cuentasOpen, setCuentasOpen] = useState(false)
  const [tarjetasOpen, setTarjetasOpen] = useState(false)
  const [subscriptionsOpen, setSubscriptionsOpen] = useState(false)
  const [accountCount, setAccountCount] = useState(0)
  const [cardCount, setCardCount] = useState(0)
  const [subscriptionCount, setSubscriptionCount] = useState(0)
  const [currency, setCurrency] = useState<'ARS' | 'USD'>('ARS')
  const [isSavingCurrency, setIsSavingCurrency] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    if (!open) return
    Promise.all([
      fetch('/api/accounts').then((r) => r.json()),
      fetch('/api/cards').then((r) => r.json()),
      fetch('/api/subscriptions').then((r) => r.json()),
      fetch('/api/user-config').then((r) => r.json()),
    ])
      .then(([accounts, cards, subscriptions, config]) => {
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
          </div>

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

      <CuentasSubSheet open={cuentasOpen} onClose={() => setCuentasOpen(false)} />
      <TarjetasSubSheet open={tarjetasOpen} onClose={() => setTarjetasOpen(false)} />
      <SubscriptionsSubSheet
        open={subscriptionsOpen}
        onClose={() => setSubscriptionsOpen(false)}
        defaultCurrency={currency}
      />
    </>
  )
}
