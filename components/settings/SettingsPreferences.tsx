'use client'

import { useState } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { CurrencySection } from '@/components/settings/CurrencySection'
import { AccountsSection } from '@/components/settings/AccountsSection'
import { CardsSection } from '@/components/settings/CardsSection'
import { HeroBalanceModePreference } from '@/components/settings/HeroBalanceModePreference'
import { SubscriptionsPreference } from '@/components/settings/SubscriptionsPreference'
import { addMonths } from '@/lib/dates'
import type { Account, Card, HeroBalanceMode } from '@/types/database'

function getMonthLabel(month: string): string {
  const label = new Date(month + '-15').toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

interface Props {
  currentMonth: string
  currency: 'ARS' | 'USD'
  cards: Card[]
  accounts: Account[]
  heroBalanceMode: HeroBalanceMode
  signalsCenterEnabled: boolean
}

export function SettingsPreferences({
  currentMonth,
  currency,
  cards,
  accounts,
  heroBalanceMode,
  signalsCenterEnabled,
}: Props) {
  const bankDigitalAccounts = accounts.filter((a) => a.type !== 'cash')
  const [month, setMonth] = useState(currentMonth)
  const minMonth = addMonths(currentMonth, -12)
  const maxMonth = addMonths(currentMonth, 3)

  return (
    <div>
      {/* Header con período integrado */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="type-title text-text-primary">
          {signalsCenterEnabled ? 'Perfil' : 'Configuración'}
        </h1>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setMonth((m) => addMonths(m, -1))}
            disabled={month <= minMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-primary/5 disabled:opacity-30"
            aria-label="Mes anterior"
          >
            <CaretLeft weight="duotone" size={14} />
          </button>
          <span className="min-w-[90px] text-center text-xs font-medium text-text-secondary">
            {getMonthLabel(month)}
          </span>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            disabled={month >= maxMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-primary/5 disabled:opacity-30"
            aria-label="Mes siguiente"
          >
            <CaretRight weight="duotone" size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <CurrencySection currency={currency} />
        {signalsCenterEnabled && <HeroBalanceModePreference initialValue={heroBalanceMode} />}
        <AccountsSection initialAccounts={accounts} month={month} />
        <CardsSection cards={cards} month={month} accounts={bankDigitalAccounts} />
        {signalsCenterEnabled && <SubscriptionsPreference defaultCurrency={currency} />}
      </div>
    </div>
  )
}
