'use client'

import type { BudgetItemMetrics } from '@/lib/budgets/types'
import { BudgetCategoryRowV2 } from './BudgetCategoryRowV2'

interface BudgetCategoryGroupProps {
  title: string
  items: BudgetItemMetrics[]
  currency: 'ARS' | 'USD'
  onOpenMovements: (category: string) => void
}

export function BudgetCategoryGroup({ title, items, currency, onOpenMovements }: BudgetCategoryGroupProps) {
  if (items.length === 0) return null

  return (
    <section className="pt-2">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">{title}</p>
        <span className="rounded-pill bg-bg-secondary px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
          {items.length}
        </span>
      </div>

      <div className="border-t border-separator">
        {items.map((item, idx) => (
          <div key={item.id} className={idx > 0 ? 'border-t border-separator' : ''}>
            <BudgetCategoryRowV2 item={item} currency={currency} onOpenMovements={onOpenMovements} />
          </div>
        ))}
      </div>
    </section>
  )
}
