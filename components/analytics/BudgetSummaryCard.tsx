'use client'

import { formatAmount } from '@/lib/format'
import type { BudgetSummary } from '@/lib/budgets/types'

interface Props {
  summary: BudgetSummary
  currency: 'ARS' | 'USD'
}

export function BudgetSummaryCard({ summary, currency }: Props) {
  return (
    <section className="mx-5 card-s5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
            Disponible este mes
          </p>
          <h3 className="mt-1 text-[22px] font-bold text-text-primary">
            {formatAmount(summary.totalRemaining, currency)}
          </h3>
          <p className="mt-1 text-[12px] text-text-tertiary">
            de {formatAmount(summary.totalBudgeted, currency)} presupuestados
          </p>
        </div>
        <div className="rounded-2xl px-3 py-2 text-right" style={{ background: 'rgba(33,120,168,0.06)' }}>
          <p className="text-[11px] font-medium text-text-secondary">Gastado</p>
          <p className="text-[15px] font-semibold text-text-primary">
            {formatAmount(summary.totalSpent, currency)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <div
          className="flex flex-1 items-center justify-center rounded-pill py-1.5 text-center"
          style={{ background: 'rgba(196,78,62,0.12)', color: 'var(--color-danger)' }}
        >
          <span className="text-[11px] font-bold">{summary.overBudgetCount} pasados</span>
        </div>
        <div
          className="flex flex-1 items-center justify-center rounded-pill py-1.5 text-center"
          style={{ background: 'rgba(229,166,10,0.14)', color: 'var(--color-warning)' }}
        >
          <span className="text-[11px] font-bold">{summary.nearLimitCount} al límite</span>
        </div>
        <div
          className="flex flex-1 items-center justify-center rounded-pill py-1.5 text-center"
          style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}
        >
          <span className="text-[11px] font-bold">{summary.aheadOfPaceCount} sobrados</span>
        </div>
      </div>
    </section>
  )
}
