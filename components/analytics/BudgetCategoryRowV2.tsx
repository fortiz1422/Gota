'use client'

import { CaretRight } from '@phosphor-icons/react'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { formatAmount } from '@/lib/format'
import type { BudgetItemMetrics } from '@/lib/budgets/types'

interface Props {
  item: BudgetItemMetrics
  currency: 'ARS' | 'USD'
  onOpenMovements: (category: string) => void
}

function getPrimaryCopy(item: BudgetItemMetrics, currency: 'ARS' | 'USD') {
  if (item.remainingAmount < 0) {
    return `Pasado por ${formatAmount(Math.abs(item.remainingAmount), currency)}`
  }

  if (item.status === 'ahead_of_pace') {
    return `Venís con ${formatAmount(item.remainingAmount, currency)} de margen`
  }

  return `Te quedan ${formatAmount(item.remainingAmount, currency)}`
}

function getSecondaryCopy(item: BudgetItemMetrics, currency: 'ARS' | 'USD') {
  return `Plan ${formatAmount(item.amount, currency)} · ritmo esperado ${Math.round(item.expectedPct * 100)}%`
}

function getPrimaryColor(item: BudgetItemMetrics) {
  if (item.status === 'over_budget') return 'var(--color-danger)'
  if (item.status === 'near_limit') return 'var(--color-warning)'
  return 'var(--color-text-secondary)'
}

export function BudgetCategoryRowV2({ item, currency, onOpenMovements }: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpenMovements(item.category)}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-black/[0.03]"
    >
      <CategoryIcon category={item.category} size={20} container />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium text-text-primary">{item.category}</p>
            <p className="mt-0.5 text-[12px]" style={{ color: getPrimaryColor(item) }}>
              {getPrimaryCopy(item, currency)}
            </p>
            <p className="mt-0.5 text-[11px] text-text-dim">{getSecondaryCopy(item, currency)}</p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <div className="text-right">
              <p className="text-[15px] font-bold tracking-[-0.01em] tabular-nums text-text-primary">
                {formatAmount(item.spentAmount, currency)}
              </p>
            </div>
            <CaretRight size={12} className="text-text-dim" />
          </div>
        </div>
      </div>
    </button>
  )
}
