'use client'

import { useState } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { CurrencySection } from '@/components/settings/CurrencySection'
import { AccountsSection } from '@/components/settings/AccountsSection'
import { CashSection } from '@/components/settings/CashSection'
import { CardsSection } from '@/components/settings/CardsSection'
import { RolloverSection } from '@/components/settings/RolloverSection'
import type { Account, Card, RolloverMode } from '@/types/database'

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

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
  rolloverMode: RolloverMode
  bankDigitalAccounts: Account[]
  cashAccount: Account | null
}

export function SettingsPreferences({
  currentMonth,
  currency,
  cards,
  rolloverMode,
  bankDigitalAccounts,
  cashAccount,
}: Props) {
  const [month, setMonth] = useState(currentMonth)
  const minMonth = addMonths(currentMonth, -12)

  return (
    <div>
      {/* Header con período integrado */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[30px] font-black tracking-tight text-text-primary">Configuración</h1>
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
            disabled={month >= currentMonth}
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-primary/5 disabled:opacity-30"
            aria-label="Mes siguiente"
          >
            <CaretRight weight="duotone" size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <CurrencySection currency={currency} />
        <AccountsSection initialAccounts={bankDigitalAccounts} month={month} />
        <CashSection initialCash={cashAccount} month={month} />
        <CardsSection cards={cards} month={month} />
        <RolloverSection initialMode={rolloverMode} />
      </div>
    </div>
  )
}
