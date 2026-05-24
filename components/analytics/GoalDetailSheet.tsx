'use client'

import { useState } from 'react'
import { X } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import { GoalProgressBar } from './GoalProgressBar'
import { formatAmount, formatDate } from '@/lib/format'
import type { GoalWithMetrics } from '@/lib/goals/types'

interface Props {
  open: boolean
  goal: GoalWithMetrics | null
  onClose: () => void
  onContribute: () => void
  onStatusChange: (goalId: string, status: 'active' | 'paused' | 'completed' | 'archived') => Promise<void>
}

export function GoalDetailSheet({ open, goal, onClose, onContribute, onStatusChange }: Props) {
  const [isUpdating, setIsUpdating] = useState(false)

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

  if (!open || !goal) return null

  const paceLabels: Record<string, string> = {
    on_track: 'En ritmo',
    behind: 'Atrasada',
    completed: 'Objetivo cumplido',
    no_date: '—',
  }

  const paceColors: Record<string, string> = {
    on_track: 'var(--color-success)',
    behind: 'var(--color-warning)',
    completed: 'var(--color-success)',
    no_date: 'var(--color-text-tertiary)',
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />

      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {goal.emoji ? <span className="text-[22px]">{goal.emoji}</span> : null}
          <h2 className="text-[17px] font-semibold text-text-primary">{goal.name}</h2>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-full p-1.5 text-text-disabled transition-colors hover:bg-bg-tertiary hover:text-text-primary"
        >
          <X weight="bold" size={16} />
        </button>
      </div>

      {/* Progress */}
      <GoalProgressBar pct={goal.progressPct} paceStatus={goal.paceStatus} />

      <div className="mt-3 flex items-baseline justify-between">
        <p className="text-[20px] font-bold text-text-primary">
          {formatAmount(goal.currentAmount, goal.currency)}
        </p>
        <p className="text-[13px] text-text-tertiary">
          de {formatAmount(goal.targetAmount, goal.currency)}
        </p>
      </div>

      {goal.remainingAmount > 0 ? (
        <p className="mt-1 text-[13px] text-text-secondary">
          Faltan {formatAmount(goal.remainingAmount, goal.currency)}
        </p>
      ) : (
        <p className="mt-1 text-[13px]" style={{ color: 'var(--color-success)' }}>
          Superaste tu meta por {formatAmount(goal.currentAmount - goal.targetAmount, goal.currency)}
        </p>
      )}

      {/* Meta info */}
      <div className="mt-4 space-y-2 rounded-card bg-bg-tertiary p-4">
        {goal.targetDate ? (
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-text-tertiary">Fecha objetivo</span>
            <span className="font-medium text-text-primary">{formatDate(goal.targetDate)}</span>
          </div>
        ) : null}

        {goal.requiredMonthlyContribution ? (
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-text-tertiary">Necesitás por mes</span>
            <span className="font-medium text-text-primary">
              {formatAmount(goal.requiredMonthlyContribution, goal.currency)}
            </span>
          </div>
        ) : null}

        {goal.plannedMonthlyContribution ? (
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-text-tertiary">Planeaste por mes</span>
            <span className="font-medium text-text-primary">
              {formatAmount(goal.plannedMonthlyContribution, goal.currency)}
            </span>
          </div>
        ) : null}

        <div className="flex items-center justify-between text-[13px]">
          <span className="text-text-tertiary">Ritmo</span>
          <span className="font-medium" style={{ color: paceColors[goal.paceStatus] }}>
            {paceLabels[goal.paceStatus]}
          </span>
        </div>

        <div className="flex items-center justify-between text-[13px]">
          <span className="text-text-tertiary">Moneda</span>
          <span className="font-medium text-text-primary">{goal.currency}</span>
        </div>

        {goal.notes ? (
          <div className="flex items-start justify-between gap-3 text-[13px]">
            <span className="shrink-0 text-text-tertiary">Nota</span>
            <span className="text-right text-text-secondary">{goal.notes}</span>
          </div>
        ) : null}
      </div>

      {/* CTAs */}
      <div className="mt-4 space-y-2">
        {goal.status !== 'completed' && goal.status !== 'archived' ? (
          <button
            type="button"
            onClick={onContribute}
            className="w-full rounded-button bg-primary px-4 py-3 text-[13px] font-semibold text-white"
          >
            Registrar aporte
          </button>
        ) : null}

        <div className="flex gap-2">
          {goal.status === 'active' ? (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => handleStatusChange('paused')}
              className="flex-1 rounded-button border border-border-ocean px-4 py-2.5 text-[12px] font-semibold text-text-secondary disabled:opacity-50"
            >
              Pausar
            </button>
          ) : goal.status === 'paused' ? (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => handleStatusChange('active')}
              className="flex-1 rounded-button border border-border-ocean px-4 py-2.5 text-[12px] font-semibold text-primary disabled:opacity-50"
            >
              Reactivar
            </button>
          ) : null}

          {goal.status !== 'completed' && goal.status !== 'archived' ? (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => handleStatusChange('completed')}
              className="flex-1 rounded-button border border-border-ocean px-4 py-2.5 text-[12px] font-semibold text-text-secondary disabled:opacity-50"
            >
              Completar
            </button>
          ) : null}

          {goal.status !== 'archived' ? (
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
    </Modal>
  )
}
