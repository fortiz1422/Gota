'use client'

import { useState, useEffect } from 'react'
import { Star, Bank, Wallet, X } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import { AccountBottomSheet } from '@/components/settings/AccountBottomSheet'
import { getCurrentMonth } from '@/lib/dates'
import type { Account, AccountType } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  onChanged?: () => void
}

const TYPE_LABEL: Record<string, string> = { bank: 'Banco', digital: 'Digital', cash: 'Efectivo' }

export function CuentasSubSheet({ open, onClose, onChanged }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [editing, setEditing] = useState<Account | null | undefined>(undefined)
  const [creatingType, setCreatingType] = useState<AccountType>('bank')
  const month = getCurrentMonth()

  useEffect(() => {
    if (!open) return
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((data: Account[]) => setAccounts(data))
      .catch(() => {})
  }, [open])

  const active = accounts.filter((a) => !a.archived)

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
    onChanged?.()
  }

  const handleDeleted = (id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id))
    onChanged?.()
  }

  return (
    <>
      <Modal open={open} onClose={onClose}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-text-primary">
              Cuentas{active.length > 0 ? ` (${active.length})` : ''}
            </h2>
            <button onClick={onClose} className="text-text-tertiary hover:text-text-secondary">
              <X size={20} />
            </button>
          </div>

          {active.length === 0 ? (
            <p className="text-sm text-text-tertiary py-2">Sin cuentas configuradas.</p>
          ) : (
            <div>
              {active.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => setEditing(acc)}
                  className="flex w-full items-center gap-3 py-3 border-b border-border-subtle text-left transition-colors hover:bg-primary/5 rounded-sm"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/8 border border-border-ocean">
                    {acc.type === 'cash' ? (
                      <Wallet weight="duotone" size={14} className="text-text-label" />
                    ) : (
                      <Bank weight="duotone" size={14} className="text-text-label" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-text-primary truncate">{acc.name}</span>
                      {acc.is_primary && (
                        <Star weight="duotone" size={12} className="shrink-0 text-warning" />
                      )}
                    </div>
                    <span className="text-[10px] text-text-tertiary">{TYPE_LABEL[acc.type] ?? acc.type}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
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

          <button
            onClick={onClose}
            className="w-full rounded-button border border-border-ocean py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-primary/5"
          >
            Listo
          </button>
        </div>
      </Modal>

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
