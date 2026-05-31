'use client'

import { formatAmount } from '@/lib/format'
import type { BudgetSummary } from '@/lib/budgets/types'

interface Props {
  summary: BudgetSummary
  currency: 'ARS' | 'USD'
  totalCategories: number
}

function getSummaryTone(summary: BudgetSummary): { bar: string; chip: string; chipText: string } {
  if (summary.totalRemaining < 0 || summary.overBudgetCount > 0) {
    return {
      bar: 'var(--color-danger)',
      chip: 'var(--color-danger-soft)',
      chipText: 'var(--color-danger)',
    }
  }

  if (summary.nearLimitCount > 0) {
    return {
      bar: 'var(--color-warning)',
      chip: 'var(--color-warning-soft)',
      chipText: 'var(--color-warning)',
    }
  }

  return {
    bar: 'var(--color-primary)',
    chip: 'var(--color-primary-soft)',
    chipText: 'var(--color-primary)',
  }
}

function getCountChip(count: number, label: string, activeBg: string, activeColor: string) {
  const isActive = count > 0

  return (
    <span
      className="inline-flex items-center justify-center rounded-pill px-3 py-1 text-[11px] font-semibold"
      style={{
        background: isActive ? activeBg : 'var(--color-bg-secondary)',
        color: isActive ? activeColor : 'var(--color-text-tertiary)',
      }}
    >
      {count} {label}
    </span>
  )
}

export function BudgetSummaryCard({ summary, currency, totalCategories }: Props) {
  const tone = getSummaryTone(summary)
  const spentPct = summary.totalBudgeted > 0 ? summary.totalSpent / summary.totalBudgeted : 0
  const progressPct = Math.min(Math.max(spentPct, 0), 1)
  const spentPctLabel = Math.round(spentPct * 100)
  const availableLabel = summary.totalRemaining >= 0 ? 'Disponible del plan' : 'Te pasaste del plan'
  const balanceCopy =
    summary.totalRemaining >= 0
      ? `Todavía te quedan ${formatAmount(summary.totalRemaining, currency)} para repartir sin salirte del plan.`
      : `Ya superaste el plan total por ${formatAmount(Math.abs(summary.totalRemaining), currency)}.`

  return (
    <section className="mx-5 card-s5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">{availableLabel}</p>
          <h3
            className="mt-2 text-[30px] font-extrabold leading-none tracking-[-0.03em] tabular-nums"
            style={{ color: summary.totalRemaining < 0 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}
          >
            {formatAmount(summary.totalRemaining, currency)}
          </h3>
          <p className="mt-2 text-[13px] leading-5 text-text-secondary">{balanceCopy}</p>
        </div>

        <div
          className="shrink-0 rounded-card px-3 py-2.5"
          style={{ background: 'var(--color-bg-secondary)', minWidth: 112 }}
        >
          <p className="text-[11px] font-medium text-text-secondary">Gastado</p>
          <p className="mt-1 text-right text-[17px] font-bold tabular-nums text-text-primary">
            {formatAmount(summary.totalSpent, currency)}
          </p>
          <p className="mt-1 text-right text-[11px] text-text-tertiary">de {formatAmount(summary.totalBudgeted, currency)}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-2 text-[12px]">
          <span className="font-medium text-text-secondary">Consumo del plan</span>
          <span className="font-semibold tabular-nums text-text-primary">{spentPctLabel}% usado</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-bg-tertiary">
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${progressPct * 100}%`, background: tone.bar }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-card bg-bg-secondary px-3 py-2.5">
          <p className="text-[11px] font-medium text-text-secondary">Plan</p>
          <p className="mt-1 text-[14px] font-bold tabular-nums text-text-primary">
            {formatAmount(summary.totalBudgeted, currency)}
          </p>
        </div>
        <div className="rounded-card bg-bg-secondary px-3 py-2.5">
          <p className="text-[11px] font-medium text-text-secondary">Categorías</p>
          <p className="mt-1 text-[14px] font-bold tabular-nums text-text-primary">{totalCategories}</p>
        </div>
        <div className="rounded-card px-3 py-2.5" style={{ background: tone.chip }}>
          <p className="text-[11px] font-medium" style={{ color: tone.chipText }}>
            Alertas
          </p>
          <p className="mt-1 text-[14px] font-bold tabular-nums" style={{ color: tone.chipText }}>
            {summary.overBudgetCount + summary.nearLimitCount}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {getCountChip(summary.overBudgetCount, 'pasadas', 'var(--color-danger-soft)', 'var(--color-danger)')}
        {getCountChip(summary.nearLimitCount, 'al límite', 'var(--color-warning-soft)', 'var(--color-warning)')}
        {getCountChip(summary.aheadOfPaceCount, 'con aire', 'var(--color-primary-soft)', 'var(--color-primary)')}
      </div>
    </section>
  )
}
