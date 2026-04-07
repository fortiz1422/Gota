import { addMonths, getCurrentMonth } from '@/lib/dates'
import { todayAR } from '@/lib/format'
import type { Card, CardCycle } from '@/types/database'

export type ResolvedCardCycle = CardCycle & {
  source: 'stored' | 'legacy'
}

function toMonthStart(periodMonth: string): string {
  return `${periodMonth}-01`
}

function clampDay(periodMonth: string, day: number | null): number {
  const safeDay = day && day > 0 ? day : 1
  const [year, month] = periodMonth.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  return Math.min(safeDay, lastDay)
}

export function buildCycleDate(periodMonth: string, day: number | null): string {
  const normalizedDay = clampDay(periodMonth, day)
  return `${periodMonth}-${String(normalizedDay).padStart(2, '0')}`
}

export function buildLegacyCardCycle(card: Card, periodMonth: string): ResolvedCardCycle {
  const closingDate = buildCycleDate(periodMonth, card.closing_day ?? 1)
  const nextMonth = addMonths(periodMonth, 1)
  const dueDate = buildCycleDate(nextMonth, card.due_day ?? Math.min((card.closing_day ?? 1) + 10, 31))

  return {
    id: `legacy-${card.id}-${periodMonth}`,
    user_id: card.user_id,
    card_id: card.id,
    period_month: toMonthStart(periodMonth),
    closing_date: closingDate,
    due_date: dueDate,
    status: 'open',
    amount_draft: null,
    amount_paid: null,
    paid_at: null,
    created_at: closingDate,
    updated_at: closingDate,
    source: 'legacy',
  }
}

export function mergeResolvedCycles(card: Card, storedCycles: CardCycle[], periodMonths: string[]): ResolvedCardCycle[] {
  const storedByMonth = new Map(
    storedCycles.map((cycle) => [cycle.period_month.substring(0, 7), { ...cycle, source: 'stored' as const }])
  )

  return periodMonths
    .map((periodMonth) => storedByMonth.get(periodMonth) ?? buildLegacyCardCycle(card, periodMonth))
    .sort((a, b) => b.period_month.localeCompare(a.period_month))
}

export function defaultCyclePeriodMonths(currentMonth = getCurrentMonth()): string[] {
  return [
    addMonths(currentMonth, 1),
    currentMonth,
    addMonths(currentMonth, -1),
    addMonths(currentMonth, -2),
  ]
}

export function getUpcomingCycle(cycles: ResolvedCardCycle[]): ResolvedCardCycle | null {
  const today = todayAR()
  const future = cycles
    .filter((cycle) => cycle.due_date >= today || cycle.closing_date >= today)
    .sort((a, b) => a.closing_date.localeCompare(b.closing_date))

  return future[0] ?? cycles.slice().sort((a, b) => b.closing_date.localeCompare(a.closing_date))[0] ?? null
}

