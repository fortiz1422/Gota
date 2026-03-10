'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wallet } from '@phosphor-icons/react'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { AccountBottomSheet } from '@/components/settings/AccountBottomSheet'
import type { Account } from '@/types/database'

interface Props {
  initialCash: Account | null
  month: string
}

export function CashSection({ initialCash, month }: Props) {
  const router = useRouter()
  const [cash, setCash] = useState<Account | null>(initialCash)
  const [open, setOpen] = useState(false)

  const handleSaved = (saved: Account) => {
    setCash(saved)
    router.refresh()
  }

  const handleDeleted = () => {
    setCash(null)
    router.refresh()
  }

  const summary = cash
    ? cash.opening_balance_ars > 0
      ? `$ ${cash.opening_balance_ars.toLocaleString('es-AR')}`
      : cash.name
    : 'Sin configurar'

  return (
    <>
      <CollapsibleSection icon={<Wallet weight="duotone" size={18} className="icon-duotone" />} title="Efectivo" summary={summary}>
        <div className="space-y-1.5">
          {cash ? (
            <button
              onClick={() => setOpen(true)}
              className="flex w-full items-center gap-3 rounded-card bg-bg-tertiary border border-border-ocean px-3 py-2.5 text-left hover:bg-bg-elevated transition-colors"
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm text-text-primary">{cash.name}</span>
              </div>
              {cash.opening_balance_ars > 0 && (
                <span className="text-xs text-text-secondary tabular-nums">
                  $ {cash.opening_balance_ars.toLocaleString('es-AR')}
                </span>
              )}
            </button>
          ) : (
            <button
              onClick={() => setOpen(true)}
              className="w-full rounded-button border border-border-ocean py-2 text-xs text-text-tertiary hover:text-text-secondary hover:border-primary/30 transition-colors"
            >
              + Agregar bolsillo de efectivo
            </button>
          )}
        </div>
      </CollapsibleSection>

      {open && (
        <AccountBottomSheet
          account={cash}
          type="cash"
          month={month}
          onSave={handleSaved}
          onDelete={handleDeleted}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
