import type { BudgetItemMetrics, BudgetItemRow, BudgetSnapshot, BudgetStatus, BudgetSummary } from './types'

type SpendByCategory = Map<string, number>

function roundPct(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function normalizeBudgetCategory(category: string): string {
  return category.trim().replace(/\s+/g, ' ')
}

export function computeBudgetStatus(params: {
  usedPct: number
  paceDelta: number
}): BudgetStatus {
  const { usedPct, paceDelta } = params
  if (usedPct >= 1) return 'over_budget'
  if (usedPct >= 0.8) return 'near_limit'
  if (paceDelta > 0.15) return 'ahead_of_pace'
  return 'on_track'
}

export function computeBudgetItems(params: {
  items: BudgetItemRow[]
  spendByCategory: SpendByCategory
  selectedMonth: string
}): BudgetItemMetrics[] {
  const { items, spendByCategory, selectedMonth } = params
  const [year, month] = selectedMonth.split('-').map(Number)
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month
  const daysInMonth = new Date(year, month, 0).getDate()
  const daysElapsed = isCurrentMonth ? today.getDate() : daysInMonth
  const expectedPct = daysInMonth > 0 ? daysElapsed / daysInMonth : 0

  return items
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.category.localeCompare(b.category))
    .map((item) => {
      const spentAmount = spendByCategory.get(normalizeBudgetCategory(item.category)) ?? 0
      const usedPct = item.amount > 0 ? spentAmount / item.amount : 0
      const paceDelta = usedPct - expectedPct

      return {
        id: item.id,
        category: item.category,
        amount: item.amount,
        spentAmount,
        remainingAmount: item.amount - spentAmount,
        usedPct: roundPct(usedPct),
        expectedPct: roundPct(expectedPct),
        paceDelta: roundPct(paceDelta),
        status: computeBudgetStatus({ usedPct, paceDelta }),
      }
    })
}

export function computeBudgetSummary(items: BudgetItemMetrics[]): BudgetSummary {
  return items.reduce<BudgetSummary>(
    (acc, item) => {
      acc.totalBudgeted += item.amount
      acc.totalSpent += item.spentAmount
      acc.totalRemaining += item.remainingAmount
      if (item.status === 'over_budget') acc.overBudgetCount += 1
      if (item.status === 'near_limit') acc.nearLimitCount += 1
      if (item.status === 'ahead_of_pace') acc.aheadOfPaceCount += 1
      return acc
    },
    {
      totalBudgeted: 0,
      totalSpent: 0,
      totalRemaining: 0,
      overBudgetCount: 0,
      nearLimitCount: 0,
      aheadOfPaceCount: 0,
    },
  )
}

export function buildEmptyBudgetSnapshot(): BudgetSnapshot {
  return {
    plan: null,
    summary: {
      totalBudgeted: 0,
      totalSpent: 0,
      totalRemaining: 0,
      overBudgetCount: 0,
      nearLimitCount: 0,
      aheadOfPaceCount: 0,
    },
    items: [],
    previousPlanAvailable: false,
  }
}
