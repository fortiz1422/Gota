'use client'

import { useState } from 'react'
import {
  Bank,
  CaretRight,
  CreditCard,
  DeviceMobileSpeaker,
  GearSix,
  Star,
  UserCircle,
  Wallet,
} from '@phosphor-icons/react'
import type { Account, Card, HeroBalanceMode } from '@/types/database'

type Props = {
  email: string
  currency: 'ARS' | 'USD'
  heroBalanceMode: HeroBalanceMode
  accounts: Account[]
  cards: Card[]
}

function AccountTypeIcon({ type }: { type: Account['type'] }) {
  if (type === 'cash') return <Wallet size={18} weight="regular" />
  if (type === 'digital') return <DeviceMobileSpeaker size={18} weight="regular" />
  return <Bank size={18} weight="regular" />
}

function heroModeLabel(mode: HeroBalanceMode) {
  if (mode === 'combined_ars') return 'Total combinado en ARS'
  if (mode === 'combined_usd') return 'Total combinado en USD'
  return 'Moneda principal'
}

function SectionFrame({
  title,
  icon,
  description,
  children,
}: {
  title: string
  icon: React.ReactNode
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[30px] border border-border-subtle bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          {icon}
        </div>
        <div>
          <h2 className="text-[30px] font-bold tracking-[-0.04em] text-text-primary">{title}</h2>
          {description && <p className="mt-1 text-[14px] leading-6 text-text-secondary">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

export function WebSettingsPage({
  email,
  currency: initialCurrency,
  heroBalanceMode: initialHeroBalanceMode,
  accounts,
  cards,
}: Props) {
  const [currency, setCurrency] = useState<'ARS' | 'USD'>(initialCurrency)
  const [heroBalanceMode, setHeroBalanceMode] = useState<HeroBalanceMode>(initialHeroBalanceMode)
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [configMessage, setConfigMessage] = useState<string | null>(null)

  const saveConfig = async (next: {
    default_currency?: 'ARS' | 'USD'
    hero_balance_mode?: HeroBalanceMode
  }) => {
    setIsSavingConfig(true)
    setConfigMessage(null)
    try {
      const res = await fetch('/api/user-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (!res.ok) throw new Error('save_failed')
      setConfigMessage('Configuración guardada')
    } catch {
      setConfigMessage('No se pudo guardar la configuración')
    } finally {
      setIsSavingConfig(false)
    }
  }

  const handleCurrencyChange = async (next: 'ARS' | 'USD') => {
    setCurrency(next)
    await saveConfig({ default_currency: next })
  }

  const handleHeroModeChange = async (next: HeroBalanceMode) => {
    setHeroBalanceMode(next)
    await saveConfig({ hero_balance_mode: next })
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FBFD_100%)]">
      <div className="mx-auto max-w-[1480px] px-7 py-7 xl:px-10">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <p className="text-[14px] font-semibold text-primary">Gota Web</p>
            <h1 className="mt-3 text-[48px] font-extrabold tracking-[-0.05em] text-text-primary">
              Configuración
            </h1>
            <p className="mt-2 max-w-2xl text-[16px] leading-7 text-text-secondary">
              Ajustes de lectura, cuentas y tarjetas para la superficie web. La lógica y los datos siguen compartidos con el resto de Gota.
            </p>
          </div>
          <a
            href="/web"
            className="inline-flex items-center gap-2 rounded-button border border-border-subtle bg-white px-4 py-2.5 text-[14px] font-semibold text-text-primary shadow-sm transition-colors hover:bg-bg-secondary"
          >
            Volver al dashboard
            <CaretRight size={14} weight="bold" />
          </a>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <SectionFrame
            title="Cuenta"
            icon={<UserCircle size={20} weight="regular" />}
            description="Información general de la cuenta que está usando esta consola web."
          >
            <div className="rounded-2xl bg-bg-secondary px-5 py-4">
              <p className="type-meta text-text-dim">Email</p>
              <p className="mt-2 text-[16px] font-semibold text-text-primary">{email}</p>
            </div>
          </SectionFrame>

          <SectionFrame
            title="Preferencias"
            icon={<GearSix size={20} weight="regular" />}
            description="Ajustes que modifican cómo se interpreta y muestra la lectura financiera."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-bg-secondary px-5 py-4">
                <p className="type-meta text-text-dim">Moneda principal</p>
                <div className="mt-3 flex gap-2">
                  {(['ARS', 'USD'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      disabled={isSavingConfig}
                      onClick={() => void handleCurrencyChange(option)}
                      className={`rounded-pill px-4 py-2 text-[13px] font-semibold transition-colors ${
                        currency === option
                          ? 'bg-primary text-white'
                          : 'bg-white text-text-secondary hover:bg-primary-soft'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-bg-secondary px-5 py-4">
                <p className="type-meta text-text-dim">Modo del hero</p>
                <div className="mt-3 grid gap-2">
                  {(['combined_ars', 'combined_usd', 'default_currency'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      disabled={isSavingConfig}
                      onClick={() => void handleHeroModeChange(option)}
                      className={`rounded-2xl px-4 py-3 text-left text-[13px] font-semibold transition-colors ${
                        heroBalanceMode === option
                          ? 'bg-primary text-white'
                          : 'bg-white text-text-secondary hover:bg-primary-soft'
                      }`}
                    >
                      {heroModeLabel(option)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {configMessage && (
              <p className={`mt-4 text-[13px] font-medium ${configMessage.includes('No se pudo') ? 'text-danger' : 'text-success'}`}>
                {configMessage}
              </p>
            )}
          </SectionFrame>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <SectionFrame
            title="Cuentas"
            icon={<Bank size={20} weight="regular" />}
            description="Base operativa de la lectura de caja y saldo vivo."
          >
            <div className="space-y-3">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between gap-4 rounded-2xl border border-border-subtle px-4 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                      <AccountTypeIcon type={account.type} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[15px] font-semibold text-text-primary">{account.name}</p>
                        {account.is_primary && (
                          <span className="inline-flex items-center gap-1 rounded-pill bg-warning-soft px-2.5 py-1 text-[11px] font-semibold text-warning">
                            <Star size={10} weight="fill" />
                            Principal
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[14px] text-text-secondary">
                        ARS {account.opening_balance_ars.toLocaleString('es-AR')} · USD {account.opening_balance_usd.toLocaleString('es-AR')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionFrame>

          <SectionFrame
            title="Tarjetas"
            icon={<CreditCard size={20} weight="regular" />}
            description="Configuran los cierres y vencimientos que alimentan compromisos y horizonte."
          >
            <div className="space-y-3">
              {cards.length === 0 ? (
                <p className="rounded-2xl bg-bg-secondary px-4 py-4 text-[15px] leading-7 text-text-secondary">
                  Todavía no hay tarjetas activas configuradas.
                </p>
              ) : (
                cards.map((card) => (
                  <div key={card.id} className="rounded-2xl border border-border-subtle px-4 py-4">
                    <p className="text-[15px] font-semibold text-text-primary">{card.name}</p>
                    <p className="mt-1 text-[14px] text-text-secondary">
                      Cierre: día {card.closing_day ?? '—'} · Vence: día {card.due_day}
                    </p>
                  </div>
                ))
              )}
            </div>
          </SectionFrame>
        </div>
      </div>
    </div>
  )
}
