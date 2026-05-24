'use client'

import { useState } from 'react'
import { Trash } from '@phosphor-icons/react'
import { formatAmount, formatDate } from '@/lib/format'
import type { GoalContribution } from '@/lib/goals/types'
import type { Currency } from '@/types/database'

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  transfer_linked: 'Transferencia',
  income_linked: 'Ingreso',
  adjustment: 'Ajuste',
}

interface Props {
  contributions: GoalContribution[]
  goalCurrency: Currency
  goalId: string
  onDeleted: () => void
}

export function GoalContributionHistory({ contributions, goalCurrency, goalId, onDeleted }: Props) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete(contributionId: string) {
    setDeletingId(contributionId)
    setError(null)
    try {
      const res = await fetch(`/api/goals/${goalId}/contributions/${contributionId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'No se pudo eliminar el aporte.')
      }
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el aporte.')
    } finally {
      setDeletingId(null)
    }
  }

  if (contributions.length === 0) {
    return (
      <p className="py-3 text-center text-[13px] text-text-tertiary">
        Sin aportes registrados
      </p>
    )
  }

  return (
    <div>
      {error ? <p className="mb-2 text-[12px] text-danger">{error}</p> : null}
      <div className="divide-y divide-separator">
        {contributions.map((c) => (
          <div key={c.id} className="flex items-start gap-3 py-3">
            {/* Left: date + note */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] text-text-primary font-medium">
                  {formatAmount(c.amount, goalCurrency)}
                </span>
                <span
                  className="rounded-pill px-2 py-0.5 text-[10px] font-bold"
                  style={{
                    background: 'var(--color-bg-tertiary)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {SOURCE_LABELS[c.sourceType] ?? c.sourceType}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="text-[12px] text-text-tertiary">
                  {formatDate(c.contributedAt)}
                </span>
                {c.note ? (
                  <span className="text-[12px] text-text-secondary truncate">· {c.note}</span>
                ) : null}
              </div>
            </div>

            {/* Delete button — only for manual */}
            {c.sourceType === 'manual' ? (
              <button
                type="button"
                disabled={deletingId === c.id}
                onClick={() => handleDelete(c.id)}
                className="shrink-0 rounded-full p-1.5 text-text-disabled transition-colors hover:bg-danger-light hover:text-danger disabled:opacity-40"
                aria-label="Eliminar aporte"
              >
                <Trash size={15} weight="bold" />
              </button>
            ) : (
              <div className="w-8 shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
