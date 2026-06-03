'use client'

import { GoalProgressBar } from './GoalProgressBar'
import { formatAmount } from '@/lib/format'
import type { GoalWithMetrics } from '@/lib/goals/types'

interface Props {
  goal: GoalWithMetrics
  onContribute: () => void
  onDetail: () => void
}

const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  active: { label: 'Activa', bg: 'var(--color-primary-soft)', color: 'var(--color-primary)' },
  paused: { label: 'Pausada', bg: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' },
  completed: { label: 'Cumplida', bg: 'var(--color-success-soft)', color: 'var(--color-success)' },
  archived: { label: 'Archivada', bg: 'var(--color-bg-tertiary)', color: 'var(--color-text-muted)' },
}

const PACE_COPY: Record<string, string> = {
  on_track: 'Vas en ritmo',
  behind: 'Atrasada',
  completed: 'Objetivo cumplido',
  no_date: 'Sin fecha objetivo',
  paused: 'Pausada',
}

const PACE_COLOR: Record<string, string> = {
  on_track: 'var(--color-success)',
  behind: 'var(--color-warning)',
  completed: 'var(--color-success)',
  no_date: 'var(--color-text-tertiary)',
  paused: 'var(--color-text-secondary)',
}

function formatTargetDate(dateStr: string): string {
  const [year, month] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, 1)
  return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

export function GoalRow({ goal, onContribute, onDetail }: Props) {
  const badge = STATUS_BADGE[goal.status] ?? STATUS_BADGE.active
  const paceCopy = PACE_COPY[goal.paceStatus]
  const paceColor = PACE_COLOR[goal.paceStatus]

  const progressLabel = `${formatAmount(goal.currentAmount, goal.currency)} de ${formatAmount(goal.targetAmount, goal.currency)}`
  const remainingLabel =
    goal.remainingAmount > 0
      ? `Faltan ${formatAmount(goal.remainingAmount, goal.currency)}`
      : `Superaste tu meta por ${formatAmount(goal.currentAmount - goal.targetAmount, goal.currency)}`

  return (
    <div className="mb-3 card-s5 px-4 py-4">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {goal.emoji ? (
            <span className="shrink-0 text-[20px] leading-none">{goal.emoji}</span>
          ) : null}
          <p className="truncate text-[15px] font-semibold text-text-primary">{goal.name}</p>
        </div>
        <span
          className="shrink-0 rounded-pill px-2 py-0.5 text-[10px] font-bold"
          style={{ background: badge.bg, color: badge.color }}
        >
          {badge.label}
        </span>
      </div>

      {/* Progress bar */}
      <GoalProgressBar pct={goal.progressPct} paceStatus={goal.paceStatus} />

      {/* Amounts */}
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold text-text-primary">{progressLabel}</p>
        <p className="shrink-0 text-[12px] text-text-tertiary">{remainingLabel}</p>
      </div>

      {/* Pace / date row */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          {goal.targetDate ? (
            <p className="text-[11px] text-text-tertiary">
              Para {formatTargetDate(goal.targetDate)}
            </p>
          ) : (
            <p className="text-[11px] text-text-tertiary">Sin fecha objetivo</p>
          )}
          {goal.requiredMonthlyContribution && goal.paceStatus !== 'completed' && goal.paceStatus !== 'paused' ? (
            <p className="text-[12px] text-text-secondary">
              {`Necesitás ${formatAmount(goal.requiredMonthlyContribution, goal.currency)}/mes`}
            </p>
          ) : (
            <p className="text-[12px] font-medium" style={{ color: paceColor }}>
              {paceCopy}
            </p>
          )}
          {goal.committedAmount > 0 ? (
            <p className="text-[11px] text-primary">
              {`Comprometido: ${formatAmount(goal.committedAmount, goal.currency)}`}
            </p>
          ) : null}
        </div>

        {/* CTAs */}
        {goal.status !== 'archived' && goal.status !== 'completed' ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onDetail}
              className="rounded-button border border-border-ocean px-3 py-1.5 text-[12px] font-semibold text-text-secondary"
            >
              Detalle
            </button>
            <button
              type="button"
              onClick={onContribute}
              className="rounded-button bg-primary px-3 py-1.5 text-[12px] font-semibold text-white"
            >
              Aportar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onDetail}
            className="rounded-button border border-border-ocean px-3 py-1.5 text-[12px] font-semibold text-text-secondary"
          >
            Detalle
          </button>
        )}
      </div>
    </div>
  )
}
