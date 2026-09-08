'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Bank, Wallet } from '@phosphor-icons/react'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { AccountBottomSheet } from '@/components/settings/AccountBottomSheet'
import type { Account, AccountPeriodBalance } from '@/types/database'

interface Props {
  standalone?: boolean
  initialAccounts: Account[]
  month: string // YYYY-MM
}

export function AccountsSection({ initialAccounts, month, standalone = false }: Props) {
  const router = useRouter()
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts)
  const [editing, setEditing] = useState<Account | null | undefined>(undefined) // undefined = closed, null = new
  const [creatingType, setCreatingType] = useState<'bank' | 'digital' | 'cash'>('bank')
  const [periodBalances, setPeriodBalances] = useState<Record<string, AccountPeriodBalance>>({})

  const active = accounts.filter((a) => !a.archived)

  // Fetch period balances for the selected month
  useEffect(() => {
    if (active.length === 0) return
    fetch(`/api/account-balances?month=${month}`)
      .then((r) => r.json())
      .then((data: AccountPeriodBalance[]) => {
        const map: Record<string, AccountPeriodBalance> = {}
        for (const b of data) map[b.account_id] = b
        setPeriodBalances(map)
      })
      .catch(() => {})
  }, [month, active.length])

  const handleSaved = (saved: Account) => {
    setAccounts((prev) => {
      const idx = prev.findIndex((a) => a.id === saved.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = saved
        if (saved.is_primary) {
          return updated.map((a) => (a.id !== saved.id ? { ...a, is_primary: false } : a))
        }
        return updated
      }
      return [...prev, saved]
    })
    router.refresh()
  }

  const handleDeleted = (id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id))
    router.refresh()
  }

  const activeCount = active.length
  const summary = activeCount === 0 ? 'Sin cuentas' : `${activeCount} cuenta${activeCount !== 1 ? 's' : ''}`

  const TYPE_LABEL: Record<string, string> = { bank: 'Banco', digital: 'Digital', cash: 'Efectivo' }

  return (
    <>
      <CollapsibleSection standalone={standalone} icon={<Bank weight="duotone" size={18} className="text-text-primary icon-duotone" />} title="Cuentas" summary={summary}>
        <div>
          {active.length === 0 && (
            <p className="text-xs text-text-disabled py-1">Sin cuentas.</p>
          )}

          {active.map((acc) => {
            const pb = periodBalances[acc.id]
            const periodBalance = pb ? (pb.balance_ars > 0 ? pb.balance_ars : pb.balance_usd > 0 ? pb.balance_usd : null) : null
            return (
              <button
                key={acc.id}
                onClick={() => setEditing(acc)}
                className="flex w-full items-center gap-3 py-[13px] border-b border-border-subtle text-left transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {acc.type === 'cash' && <Wallet weight="duotone" size={13} className="shrink-0 text-text-tertiary" />}
                    <span className="text-sm text-text-primary truncate">{acc.name}</span>
                    {acc.is_primary && (
                      <Star weight="duotone" size={12} className="shrink-0 text-warning" />
                    )}
                  </div>
                  <span className="text-[10px] text-text-tertiary">{TYPE_LABEL[acc.type] ?? acc.type}</span>
                </div>
                {periodBalance !== null ? (
                  <span className="text-xs text-text-secondary tabular-nums">
                    $ {periodBalance.toLocaleString('es-AR')}
                  </span>
                ) : acc.opening_balance_ars > 0 ? (
                  <span className="text-xs text-text-disabled tabular-nums">
                    $ {acc.opening_balance_ars.toLocaleString('es-AR')}
                  </span>
                ) : null}
              </button>
            )
          })}

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => { setCreatingType('bank'); setEditing(null) }}
              className="flex-1 rounded-button border border-border-ocean py-2 text-xs text-text-tertiary hover:text-text-secondary hover:border-primary/30 transition-colors"
            >
              + Banco
            </button>
            <button
              onClick={() => { setCreatingType('digital'); setEditing(null) }}
              className="flex-1 rounded-button border border-border-ocean py-2 text-xs text-text-tertiary hover:text-text-secondary hover:border-primary/30 transition-colors"
            >
              + Digital
            </button>
            <button
              onClick={() => { setCreatingType('cash'); setEditing(null) }}
              className="flex-1 rounded-button border border-border-ocean py-2 text-xs text-text-tertiary hover:text-text-secondary hover:border-primary/30 transition-colors"
            >
              + Efectivo
            </button>
          </div>
        </div>
      </CollapsibleSection>

      {editing !== undefined && (
        <AccountBottomSheet
          account={editing}
          type={editing?.type ?? creatingType}
          month={month}
          onSave={handleSaved}
          onDelete={handleDeleted}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  )
}
