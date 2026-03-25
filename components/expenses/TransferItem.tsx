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
    <div className="flex items-center gap-3 py-[13px] border-b border-border-subtle">
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: 'rgba(74,96,112,0.10)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <ArrowsLeftRight weight="regular" size={16} style={{ color: '#4A6070' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm text-text-primary">
          {transfer.note || `${fromName} → ${toName}`}
        </p>
        <p className="text-xs text-text-tertiary">
          {fromName} → {toName} · {formatDate(transfer.date)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="text-right">
          <p className="text-sm font-medium text-text-primary tabular-nums">
            {formatAmount(transfer.amount_from, transfer.currency_from)}
          </p>
          {!sameCurrency && (
            <p className="text-[10px] text-text-tertiary">
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
