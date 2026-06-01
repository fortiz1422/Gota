'use client'

import { formatAmount } from '@/lib/format'
import type { BudgetSummary } from '@/lib/budgets/types'

interface BudgetControlHeroProps {
  summary: BudgetSummary
  currency: 'ARS' | 'USD'
  totalCategories: number
  planExists: boolean
}

function buildStatusCopy(summary: BudgetSummary, totalCategories: number) {
  if (summary.overBudgetCount > 0) {
    return `${summary.overBudgetCount} ${summary.overBudgetCount === 1 ? 'frente para mirar hoy' : 'frentes para mirar hoy'}`
  }

  if (summary.nearLimitCount > 0) {
    const total = summary.nearLimitCount + summary.overBudgetCount
    return `${total} ${total === 1 ? 'categoría necesita atención' : 'categorías necesitan atención'}`
  }

  if (summary.aheadOfPaceCount > 0) {
    return `Mes en línea. ${summary.aheadOfPaceCount} ${summary.aheadOfPaceCount === 1 ? 'categoría viene con aire' : 'categorías vienen con aire'}`
  }

  return totalCategories > 0
    ? `Mes ordenado. ${totalCategories} ${totalCategories === 1 ? 'categoría en seguimiento' : 'categorías en seguimiento'}`
    : 'Mes ordenado por ahora'
}

export function BudgetControlHero({ summary, currency, totalCategories, planExists }: BudgetControlHeroProps) {
  const isOver = summary.totalRemaining < 0
  const mainValue = planExists
    ? formatAmount(isOver ? Math.abs(summary.totalRemaining) : summary.totalRemaining, currency)
    : 'Sin presupuesto activo'

  const contextCopy = planExists
    ? isOver
      ? `ya te corriste sobre un plan de ${formatAmount(summary.totalBudgeted, currency)}`
      : `sobre un plan de ${formatAmount(summary.totalBudgeted, currency)}`
    : 'Definí un marco simple para no perder el hilo del mes.'

  const statusCopy = planExists
    ? buildStatusCopy(summary, totalCategories)
    : 'Armalo en minutos o cloná el del mes pasado.'

  return (
    <section className="px-[22px] pb-8 pt-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.74)' }}>
        CONTROL DEL MES
      </p>

      <h2
        className="mt-3 font-extrabold tracking-[-0.03em] tabular-nums text-white"
        style={{ fontSize: planExists ? 40 : 28, lineHeight: planExists ? '40px' : '32px', textWrap: 'balance' }}
      >
        {planExists ? `${isOver ? 'Te pasaste' : 'Te quedan'} ${mainValue}` : mainValue}
      </h2>

      <p className="mt-3 text-[13px]" style={{ color: 'rgba(255,255,255,0.72)' }}>
        {contextCopy}
      </p>

      <p className="mt-4 text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.92)' }}>
        {statusCopy}
      </p>
    </section>
  )
}
