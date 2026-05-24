'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { formatAmount, formatDate } from '@/lib/format'
import type { GoalWithMetrics } from '@/lib/goals/types'

interface TransferRow {
  id: string
  amount_from: number
  amount_to: number
  currency_from: 'ARS' | 'USD'
  currency_to: 'ARS' | 'USD'
  date: string
  note: string | null
}

interface Props {
  open: boolean
  goal: GoalWithMetrics | null
  onClose: () => void
  onLinked: () => void
}

export function LinkTransferToGoalSheet({ open, goal, onClose, onLinked }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isLinking, setIsLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data, isLoading } = useQuery<{ transfers: TransferRow[] }>({
    queryKey: ['transfers-for-goal'],
    queryFn: async () => {
      const res = await fetch('/api/transfers')
      if (!res.ok) throw new Error('transfers fetch failed')
      return res.json()
    },
    enabled: open && goal !== null,
    staleTime: 30_000,
  })

  const allTransfers = data?.transfers ?? []

  // Filter to transfers that have a matching currency leg
  const eligible = goal
    ? allTransfers.filter(
        (t) => t.currency_from === goal.currency || t.currency_to === goal.currency,
      )
    : []

  function getAmount(transfer: TransferRow): number {
    if (!goal) return 0
    return transfer.currency_from === goal.currency ? transfer.amount_from : transfer.amount_to
  }

  async function handleLink() {
    if (!goal || !selectedId) return
    const transfer = eligible.find((t) => t.id === selectedId)
    if (!transfer) return

    setIsLinking(true)
    setError(null)

    try {
      const res = await fetch(`/api/goals/${goal.id}/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: getAmount(transfer),
          currency: goal.currency,
          contributedAt: transfer.date.substring(0, 10),
          sourceType: 'transfer_linked',
          relatedTransferId: transfer.id,
        }),
      })

      if (!res.ok) {
        const responseData = await res.json().catch(() => null)
        throw new Error(responseData?.error ?? 'No se pudo vincular la transferencia.')
      }

      setSelectedId(null)
      onLinked()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo vincular la transferencia.')
    } finally {
      setIsLinking(false)
    }
  }

  function handleClose() {
    setSelectedId(null)
    setError(null)
    onClose()
  }

  if (!open || !goal) return null

  return (
    <Modal open={open} onClose={handleClose}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />
      <div className="mb-4 flex items-center gap-2">
        {goal.emoji ? <span className="text-[20px]">{goal.emoji}</span> : null}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Vincular transferencia
          </p>
          <p className="text-[15px] font-semibold text-text-primary">{goal.name}</p>
        </div>
      </div>

      <p className="mb-4 text-[12px] text-text-tertiary">
        Seleccioná una transferencia en <span className="font-semibold text-text-secondary">{goal.currency}</span> para registrarla como aporte.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-14 rounded-card skeleton" />
          <div className="h-14 rounded-card skeleton" />
          <div className="h-14 rounded-card skeleton" />
        </div>
      ) : eligible.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-text-tertiary">
          No hay transferencias en {goal.currency} disponibles.
        </p>
      ) : (
        <div className="space-y-2">
          {eligible.map((transfer) => {
            const amount = getAmount(transfer)
            const isSelected = selectedId === transfer.id
            return (
              <button
                key={transfer.id}
                type="button"
                onClick={() => setSelectedId(isSelected ? null : transfer.id)}
                className="w-full rounded-card border px-4 py-3 text-left transition-colors"
                style={{
                  borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border-subtle)',
                  background: isSelected ? 'var(--color-primary-soft)' : 'var(--color-bg-secondary)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold text-text-primary">
                    {formatAmount(amount, goal.currency)}
                  </span>
                  <span className="text-[12px] text-text-tertiary">
                    {formatDate(transfer.date)}
                  </span>
                </div>
                {transfer.note ? (
                  <p className="mt-0.5 text-[12px] text-text-secondary truncate">{transfer.note}</p>
                ) : null}
              </button>
            )
          })}
        </div>
      )}

      {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={handleClose}
          className="flex-1 rounded-button border border-border-ocean px-4 py-3 text-[13px] font-semibold text-text-primary"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleLink}
          disabled={!selectedId || isLinking}
          className="flex-1 rounded-button bg-primary px-4 py-3 text-[13px] font-semibold text-white disabled:opacity-60"
        >
          {isLinking ? 'Vinculando...' : 'Vincular aporte'}
        </button>
      </div>
    </Modal>
  )
}
