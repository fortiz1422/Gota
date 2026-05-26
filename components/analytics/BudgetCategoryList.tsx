'use client'

import type { BudgetItemMetrics } from '@/lib/budgets/types'
import { BudgetCategoryRow } from './BudgetCategoryRow'

interface Props {
  items: BudgetItemMetrics[]
  currency: 'ARS' | 'USD'
  onOpenMovements: (category: string) => void
}

export function BudgetCategoryList({ items, currency, onOpenMovements }: Props) {
  return (
    <div className="mx-5 mt-2 card-s5 overflow-hidden py-0">
      {items.map((item, idx) => (
        <div key={item.id}>
          {idx > 0 && <div className="h-px bg-separator" />}
          <BudgetCategoryRow
            item={item}
            currency={currency}
            onOpenMovements={onOpenMovements}
          />
        </div>
      ))}
    </div>
  )
}
