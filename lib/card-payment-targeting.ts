import { buildLegacyCardCycle, type ResolvedCardCycle } from '@/lib/card-cycles'
import type { Card } from '@/types/database'

export type ExplicitCycleReference = {
  cycle_id?: string | null
  cycle?: {
    period_month: string
    closing_date: string
    due_date: string
  } | null
}

export function resolveExplicitResolvedCycle(
  cycles: ResolvedCardCycle[],
  card: Card,
  reference: ExplicitCycleReference,
): ResolvedCardCycle | null {
  if (reference.cycle_id) {
    return cycles.find((cycle) => cycle.id === reference.cycle_id) ?? null
  }

  const explicitCycle = reference.cycle
  if (!explicitCycle?.period_month) return null

  const matched = cycles.find((cycle) => cycle.period_month.startsWith(explicitCycle.period_month))
  if (matched) return matched

  const legacy = buildLegacyCardCycle(card, explicitCycle.period_month)
  const periodMonth = explicitCycle.period_month.length === 7
    ? `${explicitCycle.period_month}-01`
    : explicitCycle.period_month
  return {
    ...(legacy ?? {
      id: `explicit-${card.id}-${explicitCycle.period_month}`,
      user_id: card.user_id,
      card_id: card.id,
      period_month: periodMonth,
      closing_date: explicitCycle.closing_date,
      due_date: explicitCycle.due_date,
      status: 'open' as const,
      amount_draft: null,
      amount_paid: null,
      paid_at: null,
      dates_confirmed_at: null,
      created_at: explicitCycle.closing_date,
      updated_at: explicitCycle.closing_date,
      source: 'legacy' as const,
    }),
    closing_date: explicitCycle.closing_date,
    due_date: explicitCycle.due_date,
  }
}

export function getAutoTargetCycles<
  T extends { status: string; closing_date: string; due_date: string },
>(cycles: T[], paymentDate: string): T[] {
  const unresolved = cycles.filter((cycle) => cycle.status !== 'paid')
  const closed = unresolved
    .filter((cycle) => cycle.closing_date < paymentDate)
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.closing_date.localeCompare(b.closing_date))
  const nextOpen = unresolved
    .filter((cycle) => cycle.closing_date >= paymentDate)
    .sort((a, b) => a.closing_date.localeCompare(b.closing_date))[0]

  return nextOpen ? [...closed, nextOpen] : closed
}
