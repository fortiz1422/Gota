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
    color: 'var(--color-text-secondary)',
    amountColor: 'var(--color-text-primary)',
    bg: 'var(--color-bg-secondary)',
    bar: 'var(--color-primary)',
  },
  near_limit: {
    label: 'Al límite',
    color: 'var(--color-warning)',
    amountColor: 'var(--color-warning)',
    bg: 'var(--color-warning-soft)',
    bar: 'var(--color-warning)',
  },
  over_budget: {
    label: 'Pasado',
    color: 'var(--color-danger)',
    amountColor: 'var(--color-danger)',
    bg: 'var(--color-danger-soft)',
    bar: 'var(--color-danger)',
  },
  ahead_of_pace: {
    label: 'Con aire',
    color: 'var(--color-primary)',
    amountColor: 'var(--color-text-primary)',
    bg: 'var(--color-primary-soft)',
    bar: 'var(--color-primary)',
  },
} as const

function getBalanceCopy(item: BudgetItemMetrics, currency: 'ARS' | 'USD') {
  if (item.remainingAmount < 0) {
    return `Superaste por ${formatAmount(Math.abs(item.remainingAmount), currency)}`
  }

  if (item.status === 'ahead_of_pace') {
    return `Venís con ${formatAmount(item.remainingAmount, currency)} de margen`
  }

  return `Te quedan ${formatAmount(item.remainingAmount, currency)}`
}

export function BudgetCategoryRow({ item, currency, onOpenMovements }: Props) {
  const meta = STATUS_META[item.status]
  const usedWidth = Math.min(Math.max(item.usedPct, 0), 1)
  const expectedLeft = Math.min(Math.max(item.expectedPct, 0), 1)
  const usedPctLabel = Math.round(item.usedPct * 100)
  const expectedPctLabel = Math.round(item.expectedPct * 100)
  const balanceCopy = getBalanceCopy(item, currency)

  return (
    <button
      type="button"
      className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors duration-150 active:bg-black/[0.03]"
      onClick={() => onOpenMovements(item.category)}
    >
      <CategoryIcon category={item.category} size={20} container />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-[15px] font-semibold text-text-primary">{item.category}</p>
              <span
                className="shrink-0 rounded-pill px-2 py-0.5 text-[10px] font-semibold"
                style={{ color: meta.color, background: meta.bg }}
              >
                {meta.label}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 text-[12px]">
              <span className="min-w-0 truncate text-text-secondary">{balanceCopy}</span>
              <span className="shrink-0 text-text-tertiary">Plan {formatAmount(item.amount, currency)}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <div className="text-right">
              <p className="text-[15px] font-bold tabular-nums" style={{ color: meta.amountColor }}>
                {formatAmount(item.spentAmount, currency)}
              </p>
              <p className="mt-0.5 text-[11px] text-text-tertiary">gastados</p>
            </div>
            <CaretRight size={12} className="text-text-dim" />
          </div>
        </div>

        <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-bg-tertiary">
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-[width] duration-300"
            style={{ width: `${usedWidth * 100}%`, background: meta.bar }}
          />
          <div
            className="absolute rounded-full"
            style={{
              left: `${expectedLeft * 100}%`,
              top: -3,
              width: 2,
              height: 14,
              background: '#B8C9D4',
              transform: 'translateX(-50%)',
            }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-text-tertiary">
          <span>Usaste {usedPctLabel}%</span>
          <span>Ritmo esperado {expectedPctLabel}%</span>
        </div>
      </div>
    </button>
  )
}
