import { describe, expect, it } from 'vitest'
import { selectDashboardGoals } from '@/components/dashboard/desktop/desktop-dashboard-model'
import type { GoalStatus, GoalPaceStatus, GoalWithMetrics } from '@/lib/goals/types'

function makeGoal(overrides: Partial<GoalWithMetrics> = {}): GoalWithMetrics {
  return {
    id: 'g1',
    name: 'Meta',
    emoji: null,
    colorToken: null,
    targetAmount: 1000,
    currency: 'ARS',
    targetDate: null,
    startingAmount: 0,
    plannedMonthlyContribution: null,
    linkedAccountId: null,
    notes: null,
    status: 'active' as GoalStatus,
    createdAt: '2026-01-01T00:00:00Z',
    completedAt: null,
    pausedAt: null,
    currentAmount: 0,
    remainingAmount: 1000,
    progressPct: 0,
    monthsRemaining: null,
    requiredMonthlyContribution: null,
    paceStatus: 'no_date' as GoalPaceStatus,
    lastContributionAt: null,
    committedAmount: 0,
    ...overrides,
  }
}

describe('selectDashboardGoals', () => {
  it('retorna [] cuando no hay metas', () => {
    expect(selectDashboardGoals([])).toEqual([])
  })

  it('excluye metas que no estén activas (paused/completed/archived)', () => {
    const goals = [
      makeGoal({ id: 'active', status: 'active' }),
      makeGoal({ id: 'paused', status: 'paused' }),
      makeGoal({ id: 'completed', status: 'completed' }),
      makeGoal({ id: 'archived', status: 'archived' }),
    ]
    const result = selectDashboardGoals(goals)
    expect(result.map((g) => g.id)).toEqual(['active'])
  })

  it('ordena atrasadas primero, luego cerca (≥80%), luego el resto', () => {
    const goals = [
      makeGoal({ id: 'resto', paceStatus: 'on_track', progressPct: 0.2, remainingAmount: 800 }),
      makeGoal({ id: 'cerca', paceStatus: 'on_track', progressPct: 0.9, remainingAmount: 100 }),
      makeGoal({ id: 'atrasada', paceStatus: 'behind', progressPct: 0.1, remainingAmount: 900 }),
    ]
    const result = selectDashboardGoals(goals)
    expect(result.map((g) => g.id)).toEqual(['atrasada', 'cerca', 'resto'])
  })

  it('desempata por progreso descendente dentro del mismo nivel de relevancia', () => {
    const goals = [
      makeGoal({ id: 'low', paceStatus: 'on_track', progressPct: 0.3, remainingAmount: 700 }),
      makeGoal({ id: 'high', paceStatus: 'on_track', progressPct: 0.6, remainingAmount: 400 }),
    ]
    const result = selectDashboardGoals(goals)
    expect(result.map((g) => g.id)).toEqual(['high', 'low'])
  })

  it('respeta el límite (default 3)', () => {
    const goals = Array.from({ length: 5 }, (_, i) =>
      makeGoal({ id: `g${i}`, progressPct: i / 10, remainingAmount: 1000 - i }),
    )
    expect(selectDashboardGoals(goals)).toHaveLength(3)
    expect(selectDashboardGoals(goals, 2)).toHaveLength(2)
  })
})
