'use client'

import { CaretRight } from '@phosphor-icons/react'
import { formatAmount } from '@/lib/format'
import type { GoalWithMetrics } from '@/lib/goals/types'

interface Props {
  goals: GoalWithMetrics[]
  onOpenGoal: (goal: GoalWithMetrics) => void
}

type FocusItem = {
  id: string
  goal: GoalWithMetrics
  title: string
  description: string
  priority: number
}

function daysSince(dateString: string | null): number | null {
  if (!dateString) return null
  const diff = Date.now() - new Date(`${dateString}T12:00:00-03:00`).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function buildFocusItems(goals: GoalWithMetrics[]): FocusItem[] {
  const items: FocusItem[] = []

  goals.forEach((goal) => {
    if (goal.status === 'archived' || goal.status === 'completed') return

    if (goal.paceStatus === 'behind') {
      items.push({
        id: `${goal.id}-behind`,
        goal,
        title: goal.name,
        description: `Faltan ${formatAmount(goal.remainingAmount, goal.currency)} y hoy viene atrasada.`,
        priority: 0,
      })
      return
    }

    if (goal.remainingAmount > 0 && goal.progressPct >= 0.8) {
      items.push({
        id: `${goal.id}-close`,
        goal,
        title: goal.name,
        description: `Está cerca: le faltan ${formatAmount(goal.remainingAmount, goal.currency)}.`,
        priority: 1,
      })
      return
    }

    const inactiveDays = daysSince(goal.lastContributionAt)
    if (inactiveDays === null || inactiveDays >= 45) {
      items.push({
        id: `${goal.id}-stale`,
        goal,
        title: goal.name,
        description:
          inactiveDays === null
            ? 'Todavía no tiene aportes registrados.'
            : `Hace ${inactiveDays} días que no recibe un aporte.`,
        priority: 2,
      })
    }
  })

  return items.sort((a, b) => a.priority - b.priority).slice(0, 3)
}

export function GoalsFocusList({ goals, onOpenGoal }: Props) {
  const focusItems = buildFocusItems(goals)

  if (focusItems.length === 0) {
    return (
      <section className="px-4 pb-1 pt-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
            Focos de metas
          </p>
          <p className="mt-1 text-[13px] text-text-tertiary">
            No hay frentes urgentes. Todo lo demás queda ordenado abajo.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="px-4 pb-1 pt-4">
      <div className="mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
          Focos de metas
        </p>
        <p className="mt-1 text-[13px] text-text-tertiary">Empezá por estos frentes.</p>
      </div>

      <div className="space-y-1">
        {focusItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpenGoal(item.goal)}
            className="flex w-full items-start justify-between gap-3 rounded-card px-1 py-2 text-left transition-colors active:bg-black/[0.03]"
          >
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-text-primary">{item.title}</p>
              <p className="mt-0.5 text-[12px] text-text-secondary">{item.description}</p>
            </div>
            <CaretRight size={12} className="mt-1 shrink-0 text-text-dim" />
          </button>
        ))}
      </div>
    </section>
  )
}
