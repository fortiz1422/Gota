import type { Currency } from '@/types/database'

// ============================================
// DB ROW TYPES
// ============================================

export type GoalStatus = 'active' | 'paused' | 'completed' | 'archived'
export type GoalPaceStatus = 'on_track' | 'behind' | 'no_date' | 'completed'
export type ContributionSourceType = 'manual' | 'transfer_linked' | 'income_linked' | 'adjustment'

export type GoalRow = {
  id: string
  user_id: string
  name: string
  emoji: string | null
  color_token: string | null
  target_amount: number
  currency: Currency
  target_date: string | null
  starting_amount: number
  planned_monthly_contribution: number | null
  linked_account_id: string | null
  notes: string | null
  status: GoalStatus
  created_at: string
  updated_at: string
  completed_at: string | null
  paused_at: string | null
}

export type GoalContributionRow = {
  id: string
  goal_id: string
  user_id: string
  amount: number
  currency: Currency
  contributed_at: string
  source_type: ContributionSourceType
  note: string | null
  related_transfer_id: string | null
  related_income_entry_id: string | null
  created_at: string
  updated_at: string
}

// ============================================
// DOMAIN TYPES (camelCase, computed)
// ============================================

export type GoalMetrics = {
  currentAmount: number
  remainingAmount: number
  progressPct: number
  monthsRemaining: number | null
  requiredMonthlyContribution: number | null
  paceStatus: GoalPaceStatus
}

export type GoalContribution = {
  id: string
  goalId: string
  amount: number
  currency: Currency
  contributedAt: string
  sourceType: ContributionSourceType
  note: string | null
  relatedTransferId: string | null
  relatedIncomeEntryId: string | null
  createdAt: string
}

export type Goal = {
  id: string
  name: string
  emoji: string | null
  colorToken: string | null
  targetAmount: number
  currency: Currency
  targetDate: string | null
  startingAmount: number
  plannedMonthlyContribution: number | null
  linkedAccountId: string | null
  notes: string | null
  status: GoalStatus
  createdAt: string
  completedAt: string | null
  pausedAt: string | null
}

export type GoalWithMetrics = Goal & GoalMetrics

export type GoalDetail = GoalWithMetrics & {
  contributions: GoalContribution[]
}

// ============================================
// API REQUEST/RESPONSE SHAPES
// ============================================

export type CreateGoalBody = {
  name: string
  emoji?: string | null
  colorToken?: string | null
  currency: Currency
  targetAmount: number
  targetDate?: string | null
  startingAmount?: number
  plannedMonthlyContribution?: number | null
  linkedAccountId?: string | null
  notes?: string | null
}

export type PatchGoalBody = {
  name?: string
  emoji?: string | null
  colorToken?: string | null
  targetAmount?: number
  targetDate?: string | null
  plannedMonthlyContribution?: number | null
  linkedAccountId?: string | null
  notes?: string | null
  status?: GoalStatus
}

export type CreateContributionBody = {
  amount: number
  currency: Currency
  contributedAt: string
  sourceType: ContributionSourceType
  note?: string | null
  relatedTransferId?: string | null
}
