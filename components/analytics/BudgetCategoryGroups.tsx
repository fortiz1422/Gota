'use client'

import type { BudgetItemMetrics } from '@/lib/budgets/types'
import { BudgetCategoryGroup } from './BudgetCategoryGroup'

interface BudgetCategoryGroupsProps {
  items: BudgetItemMetrics[]
  currency: 'ARS' | 'USD'
  onOpenMovements: (category: string) => void
}

export function BudgetCategoryGroups({ items, currency, onOpenMovements }: BudgetCategoryGroupsProps) {
  const urgent = items.filter((item) => item.status === 'over_budget' || item.status === 'near_limit')
  const onTrack = items.filter((item) => item.status === 'on_track')
  const ahead = items.filter((item) => item.status === 'ahead_of_pace')

  return (
    <div className="pb-3">
      <BudgetCategoryGroup title="Revisar ahora" items={urgent} currency={currency} onOpenMovements={onOpenMovements} />
      <BudgetCategoryGroup title="En línea" items={onTrack} currency={currency} onOpenMovements={onOpenMovements} />
      <BudgetCategoryGroup title="Con aire" items={ahead} currency={currency} onOpenMovements={onOpenMovements} />
    </div>
  )
}
