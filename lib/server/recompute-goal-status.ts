import type { createClient } from '@/lib/supabase/server'
import type { GoalRow } from '@/lib/goals/types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

type GoalStatus = GoalRow['status']

export async function recomputeGoalStatus(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
): Promise<GoalStatus | null> {
  const [{ data: goalData, error: goalError }, { data: contributionsData, error: contributionsError }] =
    await Promise.all([
      supabase
        .from('goals')
        .select('id, status, starting_amount, target_amount')
        .eq('id', goalId)
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('goal_contributions')
        .select('amount')
        .eq('goal_id', goalId)
        .eq('user_id', userId),
    ])

  if (goalError) throw goalError
  if (contributionsError) throw contributionsError
  if (!goalData) return null

  const goal = goalData as Pick<GoalRow, 'status' | 'starting_amount' | 'target_amount'>
  const totalContributed = (contributionsData ?? []).reduce(
    (sum, contribution: { amount: number }) => sum + contribution.amount,
    0,
  )
  const currentAmount = goal.starting_amount + totalContributed

  if (currentAmount >= goal.target_amount) {
    if (goal.status !== 'completed') {
      await supabase
        .from('goals')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          paused_at: null,
        })
        .eq('id', goalId)
        .eq('user_id', userId)
    }
    return 'completed'
  }

  if (goal.status === 'completed') {
    await supabase
      .from('goals')
      .update({
        status: 'active',
        completed_at: null,
      })
      .eq('id', goalId)
      .eq('user_id', userId)
    return 'active'
  }

  return goal.status
}
