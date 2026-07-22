import { addMonths } from '@/lib/dates'
import { isCreditAccruedExpense, isPerceivedExpense } from '@/lib/movement-classification'
import type { createClient } from '@/lib/supabase/server'
import {
  buildEmptyBudgetSnapshot,
  computeBudgetItems,
  computeBudgetSummary,
  normalizeBudgetCategory,
} from '@/lib/budgets/computeBudgetMetrics'
import type { BudgetItemRow, BudgetPlanRow, BudgetSnapshot } from '@/lib/budgets/types'
import type { Expense } from '@/types/database'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

function isMissingBudgetsTableError(message: string | undefined): boolean {
  if (!message) return false
  const lowered = message.toLowerCase()
  return lowered.includes('budget_plans') || lowered.includes('budget_items')
}

export async function getBudgetSnapshot(params: {
  supabase: SupabaseClient
  userId: string
  month: string
  currency: 'ARS' | 'USD'
}): Promise<BudgetSnapshot> {
  const { supabase, userId, month, currency } = params
  const startOfMonth = `${month}-01`
  const endOfMonth = `${addMonths(month, 1)}-01`
  const previousMonthStart = `${addMonths(month, -1)}-01`

  const [
    { data: planData, error: planError },
    { data: expensesData, error: expensesError },
    { data: previousPlanData, error: previousPlanError },
  ] =
    await Promise.all([
      supabase
        .from('budget_plans')
        .select('*')
        .eq('user_id', userId)
        .eq('period_month', startOfMonth)
        .eq('base_currency', currency)
        .maybeSingle(),
      supabase
        .from('expenses')
        .select('category, amount, payment_method, is_legacy_card_payment, is_extraordinary')
        .eq('user_id', userId)
        .eq('currency', currency)
        .gte('date', startOfMonth)
        .lt('date', endOfMonth),
      supabase
        .from('budget_plans')
        .select('id')
        .eq('user_id', userId)
        .eq('period_month', previousMonthStart)
        .eq('base_currency', currency)
        .maybeSingle(),
    ])

  if (planError && isMissingBudgetsTableError(planError.message)) {
    return buildEmptyBudgetSnapshot()
  }
  if (previousPlanError && isMissingBudgetsTableError(previousPlanError.message)) {
    return buildEmptyBudgetSnapshot()
  }
  if (planError) throw planError
  if (previousPlanError) throw previousPlanError
  if (expensesError) throw expensesError

  const plan = planData as BudgetPlanRow | null
  const previousPlanAvailable = Boolean(previousPlanData)
  if (!plan) {
    return {
      ...buildEmptyBudgetSnapshot(),
      previousPlanAvailable,
    }
  }

  const { data: itemsData, error: itemsError } = await supabase
    .from('budget_items')
    .select('*')
    .eq('user_id', userId)
    .eq('plan_id', plan.id)

  if (itemsError && isMissingBudgetsTableError(itemsError.message)) {
    return buildEmptyBudgetSnapshot()
  }
  if (itemsError) throw itemsError

  const spendByCategory = new Map<string, number>()
  for (const expense of ((expensesData ?? []) as Pick<
    Expense,
    'category' | 'amount' | 'payment_method' | 'is_legacy_card_payment' | 'is_extraordinary'
  >[])) {
    if (expense.is_extraordinary === true) continue
    if (!isPerceivedExpense(expense) && !isCreditAccruedExpense(expense)) continue
    const key = normalizeBudgetCategory(expense.category)
    spendByCategory.set(key, (spendByCategory.get(key) ?? 0) + expense.amount)
  }

  const items = computeBudgetItems({
    items: (itemsData ?? []) as BudgetItemRow[],
    spendByCategory,
    selectedMonth: month,
  })

  return {
    plan: {
      id: plan.id,
      periodMonth: plan.period_month,
      baseCurrency: plan.base_currency,
      status: plan.status,
    },
    summary: computeBudgetSummary(items),
    items,
    previousPlanAvailable,
  }
}
