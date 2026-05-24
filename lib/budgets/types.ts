export type BudgetStatus = 'on_track' | 'near_limit' | 'over_budget' | 'ahead_of_pace'

export type BudgetPlanRow = {
  id: string
  user_id: string
  period_month: string
  base_currency: 'ARS' | 'USD'
  status: 'active'
  created_at: string
  updated_at: string
}

export type BudgetItemRow = {
  id: string
  plan_id: string
  user_id: string
  category: string
  amount: number
  sort_order: number
  created_at: string
  updated_at: string
}

export type BudgetPlan = {
  id: string
  periodMonth: string
  baseCurrency: 'ARS' | 'USD'
  status: 'active'
}

export type BudgetItemMetrics = {
  id: string
  category: string
  amount: number
  spentAmount: number
  remainingAmount: number
  usedPct: number
  expectedPct: number
  paceDelta: number
  status: BudgetStatus
}

export type BudgetSummary = {
  totalBudgeted: number
  totalSpent: number
  totalRemaining: number
  overBudgetCount: number
  nearLimitCount: number
  aheadOfPaceCount: number
}

export type BudgetSnapshot = {
  plan: BudgetPlan | null
  summary: BudgetSummary
  items: BudgetItemMetrics[]
  previousPlanAvailable: boolean
}
