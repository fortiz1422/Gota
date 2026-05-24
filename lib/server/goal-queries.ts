import type { createClient } from '@/lib/supabase/server'
import { computeGoalMetrics } from '@/lib/goals/computeGoalMetrics'
import type {
  GoalRow,
  GoalContributionRow,
  Goal,
  GoalWithMetrics,
  GoalDetail,
  GoalContribution,
} from '@/lib/goals/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

function rowToGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    colorToken: row.color_token,
    targetAmount: row.target_amount,
    currency: row.currency,
    targetDate: row.target_date,
    startingAmount: row.starting_amount,
    plannedMonthlyContribution: row.planned_monthly_contribution,
    linkedAccountId: row.linked_account_id,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    pausedAt: row.paused_at,
  }
}

function rowToContribution(row: GoalContributionRow): GoalContribution {
  return {
    id: row.id,
    goalId: row.goal_id,
    amount: row.amount,
    currency: row.currency,
    contributedAt: row.contributed_at,
    sourceType: row.source_type,
    note: row.note,
    relatedTransferId: row.related_transfer_id,
    relatedIncomeEntryId: row.related_income_entry_id,
    createdAt: row.created_at,
  }
}

function hydrateGoalWithMetrics(
  goal: Goal,
  contributions: GoalContributionRow[],
  today: Date,
): GoalWithMetrics {
  const metrics = computeGoalMetrics(
    {
      target_amount: goal.targetAmount,
      currency: goal.currency,
      starting_amount: goal.startingAmount,
      target_date: goal.targetDate,
      planned_monthly_contribution: goal.plannedMonthlyContribution,
      status: goal.status,
    },
    contributions,
    today,
  )
  return { ...goal, ...metrics }
}

export async function getGoals(
  supabase: SupabaseClient,
  userId: string,
): Promise<GoalWithMetrics[]> {
  const today = new Date()

  const { data: goalsData, error: goalsError } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  if (goalsError) throw goalsError
  if (!goalsData || goalsData.length === 0) return []

  const goalIds = (goalsData as GoalRow[]).map((g) => g.id)

  const { data: contribData, error: contribError } = await supabase
    .from('goal_contributions')
    .select('*')
    .eq('user_id', userId)
    .in('goal_id', goalIds)

  if (contribError) throw contribError

  const contribsByGoal = new Map<string, GoalContributionRow[]>()
  for (const contrib of (contribData ?? []) as GoalContributionRow[]) {
    const list = contribsByGoal.get(contrib.goal_id) ?? []
    list.push(contrib)
    contribsByGoal.set(contrib.goal_id, list)
  }

  return (goalsData as GoalRow[]).map((row) => {
    const goal = rowToGoal(row)
    const contributions = contribsByGoal.get(row.id) ?? []
    return hydrateGoalWithMetrics(goal, contributions, today)
  })
}

export async function getGoalById(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
): Promise<GoalDetail | null> {
  const today = new Date()

  const [{ data: goalData, error: goalError }, { data: contribData, error: contribError }] =
    await Promise.all([
      supabase
        .from('goals')
        .select('*')
        .eq('id', goalId)
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('goal_contributions')
        .select('*')
        .eq('goal_id', goalId)
        .eq('user_id', userId)
        .order('contributed_at', { ascending: false }),
    ])

  if (goalError) throw goalError
  if (contribError) throw contribError
  if (!goalData) return null

  const goal = rowToGoal(goalData as GoalRow)
  const contributions = (contribData ?? []) as GoalContributionRow[]
  const withMetrics = hydrateGoalWithMetrics(goal, contributions, today)

  return {
    ...withMetrics,
    contributions: contributions.map(rowToContribution),
  }
}
