import { formatAmount } from '@/lib/format'
import type { Currency, EvidenceItem } from './types'

export function evidenceItem(label: string, value: string, source: string): EvidenceItem {
  return { id: source, label, value, source }
}

export function moneyEvidence(
  label: string,
  amount: number,
  currency: Currency,
  source: string,
): EvidenceItem {
  return { id: source, label, value: formatAmount(Math.round(amount), currency), source }
}

const SHORT_MONTHS_ES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

/** '2026-07-15' → '15 jul' */
export function formatShortDate(date: string): string {
  const day = Number(date.substring(8, 10))
  const monthIndex = Number(date.substring(5, 7)) - 1
  return `${day} ${SHORT_MONTHS_ES[monthIndex] ?? ''}`.trim()
}

/** '2026-10' → 'oct 2026' */
export function formatMonthLabel(month: string): string {
  const monthIndex = Number(month.substring(5, 7)) - 1
  return `${SHORT_MONTHS_ES[monthIndex] ?? month} ${month.substring(0, 4)}`.trim()
}

/** Días de diferencia entre dos fechas YYYY-MM-DD (positivo si to > from). */
export function diffDays(from: string, to: string): number {
  const parse = (value: string) => {
    const [year, month, day] = value.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return Math.round((parse(to) - parse(from)) / 86_400_000)
}

/** Suma días a una fecha YYYY-MM-DD. */
export function addDays(date: string, delta: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day + delta))
  return result.toISOString().substring(0, 10)
}

/** Cantidad de días del mes YYYY-MM. */
export function daysInMonthOf(month: string): number {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(year, monthNumber, 0).getDate()
}

/** Último día del mes YYYY-MM como fecha YYYY-MM-DD. */
export function endOfMonth(month: string): string {
  return `${month}-${String(daysInMonthOf(month)).padStart(2, '0')}`
}

/** 'hoy' | 'mañana' | 'en N días' | 'hace N días' */
export function relativeDayLabel(days: number): string {
  if (days === 0) return 'hoy'
  if (days === 1) return 'mañana'
  if (days > 1) return `en ${days} días`
  if (days === -1) return 'ayer'
  return `hace ${Math.abs(days)} días`
}
