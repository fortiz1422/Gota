'use client'

import { useState } from 'react'
import { ArrowsClockwise } from '@phosphor-icons/react'
import { IncomeModal } from '@/components/dashboard/IncomeModal'
import { formatAmount } from '@/lib/format'
import type { Account, IncomeCategory, RecurringIncome } from '@/types/database'

const INCOME_LABELS: Record<string, string> = {
  salary: 'tu Sueldo',
  freelance: 'tu ingreso Freelance',
  other: 'tu ingreso',
}

interface Props {
  pending: RecurringIncome[]
  accounts: Account[]
}

export function RecurringIncomeBanner({ pending, accounts }: Props) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Buenos_Aires' })

  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    return new Set(
      pending
        .map((ri) => ri.id)
        .filter((id) => localStorage.getItem(`rec_dismissed_${id}_${today}`) === '1'),
    )
  })
  const [registeringId, setRegisteringId] = useState<string | null>(null)

  const visible = pending.filter((ri) => !dismissed.has(ri.id))
  if (visible.length === 0) return null

  const handleDismiss = (id: string) => {
    localStorage.setItem(`rec_dismissed_${id}_${today}`, '1')
    setDismissed((prev) => new Set([...prev, id]))
  }

  const registeringItem = pending.find((ri) => ri.id === registeringId)

  return (
    <>
      <div className="space-y-2">
        {visible.map((ri) => {
          const label = ri.description ? ri.description : INCOME_LABELS[ri.category] ?? 'tu ingreso'
          return (
            <div
              key={ri.id}
              className="rounded-card px-4 py-3"
              style={{
                background: 'rgba(33,120,168,0.06)',
                border: '1px solid rgba(33,120,168,0.15)',
              }}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <ArrowsClockwise weight="duotone" size={16} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-text-primary">
                    ¿Acreditaste {label} hoy?
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-tertiary">
                    {formatAmount(ri.amount, ri.currency as 'ARS' | 'USD')} esperados · día {ri.day_of_month}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleDismiss(ri.id)}
                  className="flex-1 rounded-button border border-border-subtle py-2 text-[12px] font-medium text-text-secondary transition-colors hover:bg-bg-secondary"
                >
                  No por ahora
                </button>
                <button
                  onClick={() => setRegisteringId(ri.id)}
                  className="flex-1 rounded-button bg-primary py-2 text-[12px] font-semibold text-white transition-transform active:scale-95"
                >
                  Registrar →
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {registeringItem && (
        <IncomeModal
          accounts={accounts}
          defaultCurrency={registeringItem.currency as 'ARS' | 'USD'}
          prefill={{
            amount: registeringItem.amount,
            currency: registeringItem.currency as 'ARS' | 'USD',
            category: registeringItem.category as IncomeCategory,
            description: registeringItem.description,
            account_id: registeringItem.account_id,
          }}
          recurringIncomeId={registeringItem.id}
          onClose={() => setRegisteringId(null)}
        />
      )}
    </>
  )
}
