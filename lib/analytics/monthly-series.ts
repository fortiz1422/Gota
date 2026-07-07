import type { MonthlySeriesPoint } from '@/lib/analytics/analytics-overview'
import { addMonths } from '@/lib/dates'
import {
  isApplicableCardPayment,
  isCreditAccruedExpense,
  isPerceivedExpense,
} from '@/lib/movement-classification'

export type MonthlySeriesExpense = {
  date: string
  amount: number
  category: string
  payment_method: string
  is_legacy_card_payment?: boolean | null
}

export function formatMonthShortLabel(month: string): string {
  const raw = new Date(`${month}-15T12:00:00`).toLocaleDateString('es-AR', {
    month: 'short',
  })
  const cleaned = raw.replace('.', '')
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

function getMonthDay(date: string): number {
  return Number(date.substring(8, 10))
}

function isCompleteMonth(month: string, currentMonth: string): boolean {
  return month < currentMonth
}

export function buildMonthlySeries(params: {
  expenses: MonthlySeriesExpense[]
  selectedMonth: string
  currentMonth: string
  comparisonDay: number | null
  earliestDataMonth: string | null
  labelFor?: (month: string) => string
}): MonthlySeriesPoint[] {
  const { expenses, selectedMonth, currentMonth, comparisonDay, earliestDataMonth } = params
  const labelFor = params.labelFor ?? formatMonthShortLabel
  const historyFloor = addMonths(selectedMonth, -5)
  const seriesStart =
    earliestDataMonth && earliestDataMonth > historyFloor ? earliestDataMonth : historyFloor

  const monthMap = new Map<string, MonthlySeriesPoint>()
  let cursor = seriesStart
  while (cursor <= selectedMonth) {
    monthMap.set(cursor, {
      month: cursor,
      label: labelFor(cursor),
      percibidoTotal: 0,
      percibidoDevengadoTotal: 0,
      sameDayPercibidoTotal: comparisonDay ? 0 : null,
      sameDayPercibidoDevengadoTotal: comparisonDay ? 0 : null,
      isCurrent: cursor === selectedMonth,
      isComplete: isCompleteMonth(cursor, currentMonth),
    })
    cursor = addMonths(cursor, 1)
  }

  for (const expense of expenses) {
    const month = expense.date.substring(0, 7)
    const point = monthMap.get(month)
    if (!point) continue

    const perceived = isPerceivedExpense(expense) || isApplicableCardPayment(expense)
    const accrued = isCreditAccruedExpense(expense)
    const day = getMonthDay(expense.date)

    if (perceived) {
      point.percibidoTotal += expense.amount
      point.percibidoDevengadoTotal += expense.amount
      if (comparisonDay !== null && point.sameDayPercibidoTotal !== null && day <= comparisonDay) {
        point.sameDayPercibidoTotal += expense.amount
      }
      if (
        comparisonDay !== null &&
        point.sameDayPercibidoDevengadoTotal !== null &&
        day <= comparisonDay
      ) {
        point.sameDayPercibidoDevengadoTotal += expense.amount
      }
      continue
    }

    if (!accrued) continue

    point.percibidoDevengadoTotal += expense.amount
    if (
      comparisonDay !== null &&
      point.sameDayPercibidoDevengadoTotal !== null &&
      day <= comparisonDay
    ) {
      point.sameDayPercibidoDevengadoTotal += expense.amount
    }
  }

  return Array.from(monthMap.values())
}
