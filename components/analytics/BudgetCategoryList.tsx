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
    <section className="mx-5 mt-3 card-s5 overflow-hidden py-0">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <div>
          <p className="text-[13px] font-semibold text-text-primary">Categorías del plan</p>
          <p className="mt-1 text-[12px] text-text-tertiary">Tocá una fila para abrir sus movimientos.</p>
        </div>
        <span className="shrink-0 rounded-pill bg-bg-secondary px-2.5 py-1 text-[11px] font-semibold text-text-secondary">
          {items.length}
        </span>
      </div>

      <div className="h-px bg-separator" />

      {items.map((item, idx) => (
        <div key={item.id}>
          {idx > 0 && <div className="h-px bg-separator" />}
          <BudgetCategoryRow item={item} currency={currency} onOpenMovements={onOpenMovements} />
        </div>
      ))}
    </section>
  )
}
