import type { GoalRow, GoalContributionRow, GoalMetrics, GoalPaceStatus } from './types'

/**
 * Suma starting_amount + contributions para obtener el progreso real.
 * Solo cuenta contributions de la misma moneda que la meta.
 */
export function computeCurrentAmount(
  startingAmount: number,
  contributions: Pick<GoalContributionRow, 'amount' | 'currency'>[],
  goalCurrency: string,
): number {
  const contributed = contributions
    .filter((c) => c.currency === goalCurrency)
    .reduce((sum, c) => sum + c.amount, 0)
  return startingAmount + contributed
}

export function computeRemainingAmount(targetAmount: number, currentAmount: number): number {
  return Math.max(targetAmount - currentAmount, 0)
}

export function computeProgressPct(currentAmount: number, targetAmount: number): number {
  if (targetAmount <= 0) return 0
  return Math.min(currentAmount / targetAmount, 1)
}

/**
 * Calcula los meses restantes entre hoy y target_date.
 * Retorna null si no hay fecha objetivo.
 * Retorna 0 si la fecha ya pasó.
 */
export function computeMonthsRemaining(targetDate: string | null, today: Date): number | null {
  if (!targetDate) return null
  const target = new Date(targetDate)
  const diffMs = target.getTime() - today.getTime()
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44)
  return Math.max(Math.ceil(diffMonths), 0)
}

/**
 * Retorna null si no hay meses restantes o si ya se llegó al objetivo.
 */
export function computeRequiredMonthlyContribution(
  remainingAmount: number,
  monthsRemaining: number | null,
): number | null {
  if (monthsRemaining === null) return null
  if (monthsRemaining <= 0) return null
  if (remainingAmount <= 0) return null
  return remainingAmount / monthsRemaining
}

export function computePaceStatus(params: {
  currentAmount: number
  targetAmount: number
  targetDate: string | null
  plannedMonthlyContribution: number | null
  today: Date
}): GoalPaceStatus {
  const { currentAmount, targetAmount, targetDate, plannedMonthlyContribution, today } = params

  if (currentAmount >= targetAmount) return 'completed'
  if (!targetDate) return 'no_date'

  const monthsRemaining = computeMonthsRemaining(targetDate, today)

  if (monthsRemaining === null) return 'no_date'
  if (monthsRemaining <= 0) return 'behind'

  const required = computeRequiredMonthlyContribution(
    computeRemainingAmount(targetAmount, currentAmount),
    monthsRemaining,
  )

  if (required === null) return 'on_track'

  // Si hay planned, comparar requerido vs planeado
  if (plannedMonthlyContribution !== null) {
    return required <= plannedMonthlyContribution * 1.1 ? 'on_track' : 'behind'
  }

  // Sin planned: si el required es alcanzable (no es absurdo), on_track
  // Lógica conservadora: si required > targetAmount * 0.5, está muy atrasado
  return required <= targetAmount * 0.5 ? 'on_track' : 'behind'
}

/**
 * Calcula todas las métricas derivadas para una meta.
 */
export function computeGoalMetrics(
  goal: Pick<
    GoalRow,
    | 'target_amount'
    | 'currency'
    | 'starting_amount'
    | 'target_date'
    | 'planned_monthly_contribution'
    | 'status'
  >,
  contributions: Pick<GoalContributionRow, 'amount' | 'currency'>[],
  today: Date = new Date(),
): GoalMetrics {
  const currentAmount = computeCurrentAmount(goal.starting_amount, contributions, goal.currency)
  const remainingAmount = computeRemainingAmount(goal.target_amount, currentAmount)
  const progressPct = computeProgressPct(currentAmount, goal.target_amount)
  const monthsRemaining = computeMonthsRemaining(goal.target_date, today)
  const requiredMonthlyContribution = computeRequiredMonthlyContribution(remainingAmount, monthsRemaining)

  const paceStatus =
    goal.status === 'paused'
      ? 'paused'
      : computePaceStatus({
          currentAmount,
          targetAmount: goal.target_amount,
          targetDate: goal.target_date,
          plannedMonthlyContribution: goal.planned_monthly_contribution,
          today,
        })

  return {
    currentAmount,
    remainingAmount,
    progressPct,
    monthsRemaining,
    requiredMonthlyContribution,
    paceStatus,
  }
}
