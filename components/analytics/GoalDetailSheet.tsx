'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import { GoalProgressBar } from './GoalProgressBar'
import { GoalContributionEditSheet } from './GoalContributionEditSheet'
import { GoalContributionHistory } from './GoalContributionHistory'
import { GoalEditSheet } from './GoalEditSheet'
import { LinkTransferToGoalSheet } from './LinkTransferToGoalSheet'
import { formatAmount, formatDate } from '@/lib/format'
import type { GoalContribution, GoalDetail, GoalWithMetrics } from '@/lib/goals/types'

interface Props {
  open: boolean
  goal: GoalWithMetrics | null
  onClose: () => void
  onContribute: () => void
  onStatusChange: (goalId: string, status: 'active' | 'paused' | 'completed' | 'archived') => Promise<void>
}

const paceLabels: Record<string, string> = {
  on_track: 'En ritmo',
  behind: 'Atrasada',
  completed: 'Objetivo cumplido',
  no_date: 'Sin fecha objetivo',
  paused: 'Pausada',
}

const paceColors: Record<string, string> = {
  on_track: 'var(--color-success)',
  behind: 'var(--color-warning)',
  completed: 'var(--color-success)',
  no_date: 'var(--color-text-tertiary)',
  paused: 'var(--color-text-secondary)',
}

export function GoalDetailSheet({ open, goal, onClose, onContribute, onStatusChange }: Props) {
  const queryClient = useQueryClient()
  const [isUpdating, setIsUpdating] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [linkTransferOpen, setLinkTransferOpen] = useState(false)
  const [editingContribution, setEditingContribution] = useState<GoalContribution | null>(null)

  const { data: detail, isLoading: isDetailLoading } = useQuery<GoalDetail>({
    queryKey: ['goal-detail', goal?.id],
    queryFn: async () => {
      const res = await fetch(`/api/goals/${goal!.id}`)
      if (!res.ok) throw new Error('goal detail fetch failed')
      return res.json()
    },
    enabled: open && goal !== null,
    staleTime: 0,
  })

  async function handleStatusChange(status: 'active' | 'paused' | 'completed' | 'archived') {
    if (!goal) return
    setIsUpdating(true)
    try {
      await onStatusChange(goal.id, status)
      onClose()
    } finally {
      setIsUpdating(false)
    }
  }

  async function invalidateAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['goal-detail', goal?.id] }),
      queryClient.invalidateQueries({ queryKey: ['goals'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
  }

  if (!open || !goal) return null

  const displayGoal = detail ?? goal
  const isPaused = displayGoal.status === 'paused'

  return (
    <>
      <Modal open={open} onClose={onClose}>
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />

        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {displayGoal.emoji ? <span className="text-[22px]">{displayGoal.emoji}</span> : null}
            <h2 className="text-[17px] font-semibold text-text-primary">{displayGoal.name}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="rounded-full px-2.5 py-1 text-[12px] font-semibold text-primary transition-colors hover:bg-primary-soft"
            >
              Editar
            </button>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-text-disabled transition-colors hover:bg-bg-tertiary hover:text-text-primary"
            >
              <X weight="bold" size={16} />
            </button>
          </div>
        </div>

        <GoalProgressBar pct={displayGoal.progressPct} paceStatus={displayGoal.paceStatus} />

        <div className="mt-3 flex items-baseline justify-between">
          <p className="text-[20px] font-bold text-text-primary">
            {formatAmount(displayGoal.currentAmount, displayGoal.currency)}
          </p>
          <p className="text-[13px] text-text-tertiary">de {formatAmount(displayGoal.targetAmount, displayGoal.currency)}</p>
        </div>

        {displayGoal.remainingAmount > 0 ? (
          <p className="mt-1 text-[13px] text-text-secondary">
            Faltan {formatAmount(displayGoal.remainingAmount, displayGoal.currency)}
          </p>
        ) : (
          <p className="mt-1 text-[13px]" style={{ color: 'var(--color-success)' }}>
            Superaste tu meta por {formatAmount(displayGoal.currentAmount - displayGoal.targetAmount, displayGoal.currency)}
          </p>
        )}

        <div className="mt-4 space-y-2 rounded-card bg-bg-tertiary p-4">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-text-tertiary">Estado de avance</span>
            <span className="font-medium" style={{ color: paceColors[displayGoal.paceStatus] }}>
              {paceLabels[displayGoal.paceStatus]}
            </span>
          </div>

          {displayGoal.targetDate ? (
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-text-tertiary">Fecha objetivo</span>
              <span className="font-medium text-text-primary">{formatDate(displayGoal.targetDate)}</span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-text-tertiary">Fecha objetivo</span>
              <span className="font-medium text-text-secondary">Sin fecha</span>
            </div>
          )}

          {displayGoal.requiredMonthlyContribution ? (
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-text-tertiary">Necesitás por mes</span>
              <span className="font-medium text-text-primary">
                {isPaused ? 'Pausada por ahora' : formatAmount(displayGoal.requiredMonthlyContribution, displayGoal.currency)}
              </span>
            </div>
          ) : null}

          {displayGoal.plannedMonthlyContribution ? (
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-text-tertiary">Planeaste por mes</span>
              <span className="font-medium text-text-primary">
                {formatAmount(displayGoal.plannedMonthlyContribution, displayGoal.currency)}
              </span>
            </div>
          ) : null}

          {displayGoal.committedAmount > 0 ? (
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-text-tertiary">Comprometido en metas</span>
              <span className="font-medium text-primary">
                {formatAmount(displayGoal.committedAmount, displayGoal.currency)}
              </span>
            </div>
          ) : null}

          <div className="flex items-center justify-between text-[13px]">
            <span className="text-text-tertiary">Moneda</span>
            <span className="font-medium text-text-primary">{displayGoal.currency}</span>
          </div>

          {displayGoal.notes ? (
            <div className="flex items-start justify-between gap-3 text-[13px]">
              <span className="shrink-0 text-text-tertiary">Nota</span>
              <span className="text-right text-text-secondary">{displayGoal.notes}</span>
            </div>
          ) : null}
        </div>

        <div className="mt-4 space-y-2">
          {displayGoal.status !== 'completed' && displayGoal.status !== 'archived' ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onContribute}
                className="flex-1 rounded-button bg-primary px-4 py-3 text-[13px] font-semibold text-white"
              >
                Registrar aporte
              </button>
              <button
                type="button"
                onClick={() => setLinkTransferOpen(true)}
                className="flex-1 rounded-button border border-border-ocean px-4 py-3 text-[13px] font-semibold text-text-secondary"
              >
                Vincular transferencia
              </button>
            </div>
          ) : null}

          <div className="flex gap-2">
            {displayGoal.status === 'active' ? (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleStatusChange('paused')}
                className="flex-1 rounded-button border border-border-ocean px-4 py-2.5 text-[12px] font-semibold text-text-secondary disabled:opacity-50"
              >
                Pausar
              </button>
            ) : displayGoal.status === 'paused' ? (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleStatusChange('active')}
                className="flex-1 rounded-button border border-border-ocean px-4 py-2.5 text-[12px] font-semibold text-primary disabled:opacity-50"
              >
                Reactivar
              </button>
            ) : null}

            {displayGoal.status !== 'completed' && displayGoal.status !== 'archived' ? (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleStatusChange('completed')}
                className="flex-1 rounded-button border border-border-ocean px-4 py-2.5 text-[12px] font-semibold text-text-secondary disabled:opacity-50"
              >
                Completar
              </button>
            ) : null}

            {displayGoal.status !== 'archived' ? (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => handleStatusChange('archived')}
                className="flex-1 rounded-button border border-border-ocean px-4 py-2.5 text-[12px] font-semibold text-text-secondary disabled:opacity-50"
              >
                Archivar
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Historial de aportes
          </p>
          {isDetailLoading ? (
            <div className="space-y-2">
              <div className="h-10 rounded-card skeleton" />
              <div className="h-10 rounded-card skeleton" />
            </div>
          ) : (
            <GoalContributionHistory
              contributions={detail?.contributions ?? []}
              goalCurrency={displayGoal.currency}
              goalId={displayGoal.id}
              onDeleted={invalidateAll}
              onEdit={(contribution) => setEditingContribution(contribution)}
            />
          )}
        </div>
      </Modal>

      <GoalEditSheet
        open={editOpen}
        goal={displayGoal}
        onClose={() => setEditOpen(false)}
        onSaved={async () => {
          await invalidateAll()
        }}
      />

      <GoalContributionEditSheet
        open={editingContribution !== null}
        goalId={displayGoal.id}
        goalCurrency={displayGoal.currency}
        contribution={editingContribution}
        onClose={() => setEditingContribution(null)}
        onSaved={async () => {
          await invalidateAll()
        }}
      />

      <LinkTransferToGoalSheet
        open={linkTransferOpen}
        goal={displayGoal}
        onClose={() => setLinkTransferOpen(false)}
        onLinked={async () => {
          await invalidateAll()
        }}
      />
    </>
  )
}
