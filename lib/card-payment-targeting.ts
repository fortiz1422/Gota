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

  if (!reference.cycle?.period_month) return null

  return (
    cycles.find((cycle) => cycle.period_month.startsWith(reference.cycle!.period_month)) ?? {
      ...buildLegacyCardCycle(card, reference.cycle.period_month),
      closing_date: reference.cycle.closing_date,
      due_date: reference.cycle.due_date,
    }
  )
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
