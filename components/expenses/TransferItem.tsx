'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowsLeftRight } from '@phosphor-icons/react'
import { formatAmount, formatDate } from '@/lib/format'
import type { Transfer, Account } from '@/types/database'

interface Props {
  transfer: Transfer
  accounts: Account[]
}

export function TransferItem({ transfer, accounts }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)

  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]))
  const fromName = accountMap[transfer.from_account_id] ?? 'Cuenta'
  const toName = accountMap[transfer.to_account_id] ?? 'Cuenta'
  const sameCurrency = transfer.currency_from === transfer.currency_to

  const handleDelete = async () => {
    if (!confirm('¿Eliminar esta transferencia?')) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/transfers/${transfer.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setDeleted(true)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['account-breakdown'] })
      router.refresh()
    } catch {
      alert('Error al eliminar la transferencia.')
    } finally {
      setIsDeleting(false)
    }
  }

  if (deleted) return null

  return (
    <div
      className="flex items-center gap-3 rounded-card px-3 py-3"
      style={{
        background: 'rgba(27,126,158,0.06)',
        border: '1px solid rgba(27,126,158,0.18)',
      }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: 'rgba(27,126,158,0.10)', border: '1px solid rgba(27,126,158,0.20)' }}
      >
        <ArrowsLeftRight weight="duotone" size={18} style={{ color: 'var(--color-ocean)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-[13px] font-medium text-text-primary">
          {fromName} → {toName}
        </p>
        <p className="mt-0.5 text-[11px] text-text-tertiary">
          {transfer.note ? `${transfer.note} · ` : ''}
          {formatDate(transfer.date)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="text-right">
          <p className="text-[14px] font-bold tabular-nums text-text-secondary">
            {formatAmount(transfer.amount_from, transfer.currency_from)}
          </p>
          {!sameCurrency && (
            <p className="text-[11px] text-text-tertiary">
              {formatAmount(transfer.amount_to, transfer.currency_to)}
            </p>
          )}
        </div>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label="Eliminar transferencia"
          className="text-lg leading-none text-text-disabled transition-colors hover:text-danger disabled:opacity-50"
        >
          ×
        </button>
      </div>
    </div>
  )
}
