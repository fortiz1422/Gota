'use client'

import { useState } from 'react'
import { PencilSimple, Trash } from '@phosphor-icons/react'
import { formatAmount, formatDate } from '@/lib/format'
import type { GoalContribution } from '@/lib/goals/types'
import type { Currency } from '@/types/database'

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  transfer_linked: 'Transferencia',
  income_linked: 'Ingreso',
  adjustment: 'Ajuste',
}

const AVAILABILITY_LABELS: Record<string, string> = {
  none: 'Sin impacto en disponible',
  committed_only: 'Comprometido',
  moved_out: 'Salida real',
}

interface Props {
  contributions: GoalContribution[]
  goalCurrency: Currency
  goalId: string
  onDeleted: () => void
  onEdit: (contribution: GoalContribution) => void
}

export function GoalContributionHistory({
  contributions,
  goalCurrency,
  goalId,
  onDeleted,
  onEdit,
}: Props) {
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
    return <p className="py-3 text-center text-[13px] text-text-tertiary">Sin aportes registrados</p>
  }

  return (
    <div>
      {error ? <p className="mb-2 text-[12px] text-danger">{error}</p> : null}
      <div className="divide-y divide-separator">
        {contributions.map((contribution) => (
          <div key={contribution.id} className="flex items-start gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-medium text-text-primary">
                  {formatAmount(contribution.amount, goalCurrency)}
                </span>
                <span
                  className="rounded-pill px-2 py-0.5 text-[10px] font-bold"
                  style={{
                    background: 'var(--color-bg-tertiary)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {SOURCE_LABELS[contribution.sourceType] ?? contribution.sourceType}
                </span>
                {contribution.availabilityEffect !== 'none' ? (
                  <span className="rounded-pill bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {AVAILABILITY_LABELS[contribution.availabilityEffect]}
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <span className="text-[12px] text-text-tertiary">{formatDate(contribution.contributedAt)}</span>
                {contribution.note ? (
                  <span className="truncate text-[12px] text-text-secondary">· {contribution.note}</span>
                ) : null}
              </div>
            </div>

            {contribution.sourceType === 'manual' ? (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onEdit(contribution)}
                  className="rounded-full p-1.5 text-text-disabled transition-colors hover:bg-primary-soft hover:text-primary"
                  aria-label="Editar aporte"
                >
                  <PencilSimple size={15} weight="bold" />
                </button>
                <button
                  type="button"
                  disabled={deletingId === contribution.id}
                  onClick={() => handleDelete(contribution.id)}
                  className="rounded-full p-1.5 text-text-disabled transition-colors hover:bg-danger-light hover:text-danger disabled:opacity-40"
                  aria-label="Eliminar aporte"
                >
                  <Trash size={15} weight="bold" />
                </button>
              </div>
            ) : (
              <div className="w-14 shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
