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

const STATUS_META = {
  on_track: {
    label: 'En línea',
    color: 'var(--color-success)',
    bg: 'var(--color-success-soft)',
  },
  near_limit: {
    label: 'Al límite',
    color: 'var(--color-warning)',
    bg: 'var(--color-warning-soft)',
  },
  over_budget: {
    label: 'Pasado',
    color: 'var(--color-danger)',
    bg: 'var(--color-danger-soft)',
  },
  ahead_of_pace: {
    label: 'Sobrado',
    color: 'var(--color-primary)',
    bg: 'var(--color-primary-soft)',
  },
} as const

export function BudgetCategoryRow({ item, currency, onOpenMovements }: Props) {
  const meta = STATUS_META[item.status]
  const usedWidth = Math.min(item.usedPct, 1)
  const expectedLeft = Math.min(Math.max(item.expectedPct, 0), 1)

  return (
    <div
      className="flex cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors duration-150 active:bg-black/[0.03]"
      onClick={() => onOpenMovements(item.category)}
    >
      <CategoryIcon category={item.category} size={20} container />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-text-primary">
            {item.category}
          </p>
          <div className="ml-2 flex shrink-0 items-center gap-1">
            <p className="text-[15px] font-bold" style={{ color: meta.color }}>
              {formatAmount(item.spentAmount, currency)}
            </p>
            <CaretRight size={12} className="text-text-dim" />
          </div>
        </div>

        <div className="mt-0.5 flex items-center justify-between gap-3">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ color: meta.color, background: meta.bg }}
          >
            {meta.label}
          </span>
          <span className="shrink-0 text-[11px] text-text-tertiary">
            de {formatAmount(item.amount, currency)}
          </span>
        </div>

        <div
          className="relative mt-2 rounded-full"
          style={{ height: 4, background: '#E6ECF2', overflow: 'visible' }}
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-[width] duration-300"
            style={{ width: `${usedWidth * 100}%`, background: meta.color }}
          />
          <div
            className="absolute rounded-full"
            style={{
              left: `${expectedLeft * 100}%`,
              top: -4,
              width: 2,
              height: 12,
              background: '#B8C9D4',
              transform: 'translateX(-50%)',
            }}
          />
        </div>
      </div>
    </div>
  )
}
