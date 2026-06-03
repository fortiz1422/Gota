import { describe, expect, it } from 'vitest'
import {
  computeCurrentAmount,
  computeGoalMetrics,
  computePaceStatus,
  computeRemainingAmount,
  computeRequiredMonthlyContribution,
} from './computeGoalMetrics'
import type { GoalContributionRow, GoalRow } from './types'

function contribution(overrides: Partial<GoalContributionRow>): GoalContributionRow {
  return {
    id: 'contribution-1',
    goal_id: 'goal-1',
    user_id: 'user-1',
    amount: 0,
    currency: 'ARS',
    contributed_at: '2026-06-01',
    source_type: 'manual',
    availability_effect: 'none',
    source_account_id: null,
    destination_kind: null,
    note: null,
    related_transfer_id: null,
    related_income_entry_id: null,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  }
}

function goal(overrides: Partial<GoalRow>): GoalRow {
  return {
    id: 'goal-1',
    user_id: 'user-1',
    name: 'Viaje',
    emoji: '✈️',
    color_token: null,
    target_amount: 1000,
    currency: 'ARS',
    target_date: '2026-12-31',
    starting_amount: 100,
    planned_monthly_contribution: 200,
    linked_account_id: null,
    notes: null,
    status: 'active',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    completed_at: null,
    paused_at: null,
    ...overrides,
  }
}

describe('computeGoalMetrics helpers', () => {
  it('suma el monto inicial y solo contributions de la misma moneda', () => {
    const currentAmount = computeCurrentAmount(
      100,
      [
        contribution({ amount: 250, currency: 'ARS' }),
        contribution({ id: 'contribution-2', amount: 40, currency: 'USD' }),
      ],
      'ARS',
    )

    expect(currentAmount).toBe(350)
  })

  it('nunca devuelve remainingAmount negativo', () => {
    expect(computeRemainingAmount(1000, 350)).toBe(650)
    expect(computeRemainingAmount(1000, 1200)).toBe(0)
  })

  it('calcula requiredMonthlyContribution solo cuando todavía falta y hay fecha vigente', () => {
    expect(computeRequiredMonthlyContribution(600, 3)).toBe(200)
    expect(computeRequiredMonthlyContribution(0, 3)).toBeNull()
    expect(computeRequiredMonthlyContribution(600, 0)).toBeNull()
    expect(computeRequiredMonthlyContribution(600, null)).toBeNull()
  })
})

describe('computePaceStatus', () => {
  const today = new Date('2026-06-10T00:00:00.000Z')

  it('marca on_track cuando el aporte mensual planeado alcanza', () => {
    const paceStatus = computePaceStatus({
      currentAmount: 400,
      targetAmount: 1000,
      targetDate: '2026-09-30',
      plannedMonthlyContribution: 220,
      today,
    })

    expect(paceStatus).toBe('on_track')
  })

  it('marca behind cuando el aporte mensual planeado queda corto', () => {
    const paceStatus = computePaceStatus({
      currentAmount: 100,
      targetAmount: 1000,
      targetDate: '2026-08-01',
      plannedMonthlyContribution: 100,
      today,
    })

    expect(paceStatus).toBe('behind')
  })

  it('marca completed al alcanzar el objetivo y no_date cuando no hay fecha', () => {
    expect(
      computePaceStatus({
        currentAmount: 1000,
        targetAmount: 1000,
        targetDate: '2026-12-31',
        plannedMonthlyContribution: 100,
        today,
      }),
    ).toBe('completed')

    expect(
      computePaceStatus({
        currentAmount: 250,
        targetAmount: 1000,
        targetDate: null,
        plannedMonthlyContribution: null,
        today,
      }),
    ).toBe('no_date')
  })
})

describe('computeGoalMetrics', () => {
  const today = new Date('2026-06-10T00:00:00.000Z')

  it('devuelve paused cuando la meta está pausada aunque tenga fecha', () => {
    const metrics = computeGoalMetrics(
      goal({ status: 'paused', target_date: '2026-12-31' }),
      [contribution({ amount: 250 })],
      today,
    )

    expect(metrics.paceStatus).toBe('paused')
    expect(metrics.currentAmount).toBe(350)
    expect(metrics.remainingAmount).toBe(650)
    expect(metrics.requiredMonthlyContribution).toBeCloseTo(92.8571428571)
  })

  it('si una meta completada vuelve a quedar por debajo del target deja de verse como completed', () => {
    const metrics = computeGoalMetrics(
      goal({ status: 'completed', starting_amount: 200, target_amount: 1000, planned_monthly_contribution: 150 }),
      [contribution({ amount: 300 })],
      today,
    )

    expect(metrics.currentAmount).toBe(500)
    expect(metrics.remainingAmount).toBe(500)
    expect(metrics.paceStatus).toBe('on_track')
  })
})
