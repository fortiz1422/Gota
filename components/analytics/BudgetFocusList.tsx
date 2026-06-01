'use client'

import { CaretRight } from '@phosphor-icons/react'
import { formatAmount } from '@/lib/format'
import type { BudgetItemMetrics } from '@/lib/budgets/types'

interface BudgetFocusListProps {
  items: BudgetItemMetrics[]
  currency: 'ARS' | 'USD'
  onOpenMovements: (category: string) => void
}

const statusRank: Record<BudgetItemMetrics['status'], number> = {
  over_budget: 0,
  near_limit: 1,
  on_track: 2,
  ahead_of_pace: 3,
}

function buildFocusCopy(item: BudgetItemMetrics, currency: 'ARS' | 'USD') {
  if (item.status === 'over_budget') {
    return `Pasado por ${formatAmount(Math.abs(item.remainingAmount), currency)}`
  }

  if (item.status === 'near_limit') {
    return `Va arriba del ritmo esperado por ${Math.max(Math.round(item.paceDelta * 100), 1)} pts.`
  }

  if (item.status === 'ahead_of_pace') {
    return `Viene con ${formatAmount(item.remainingAmount, currency)} de margen` 
  }

  return 'No necesita atención por ahora'
}

export function BudgetFocusList({ items, currency, onOpenMovements }: BudgetFocusListProps) {
  const sorted = [...items].sort((a, b) => {
    const byStatus = statusRank[a.status] - statusRank[b.status]
    if (byStatus !== 0) return byStatus
    return Math.abs(b.remainingAmount) - Math.abs(a.remainingAmount)
  })

  const urgent = sorted.filter((item) => item.status === 'over_budget' || item.status === 'near_limit')
  const focusItems = (urgent.length > 0 ? urgent : sorted).slice(0, 3)
  const calmState = urgent.length === 0

  return (
    <section className="px-4 pb-1 pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Focos del mes</p>
          <p className="mt-1 text-[13px] text-text-tertiary">
            {calmState ? 'Todo viene bastante en línea.' : 'Empezá por estos frentes.'}
          </p>
        </div>
      </div>

      <div className="space-y-1">
        {focusItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpenMovements(item.category)}
            className="flex w-full items-start justify-between gap-3 rounded-card px-1 py-2 text-left transition-colors active:bg-black/[0.03]"
          >
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-text-primary">{item.category}</p>
              <p className="mt-0.5 text-[12px] text-text-secondary">{buildFocusCopy(item, currency)}</p>
            </div>
            <CaretRight size={12} className="mt-1 shrink-0 text-text-dim" />
          </button>
        ))}
      </div>
    </section>
  )
}
