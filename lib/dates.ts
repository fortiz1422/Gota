const ARGENTINA_TIME_ZONE = 'America/Buenos_Aires'

function getArgentinaDateParts(date: Date): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ARGENTINA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  return {
    year: parts.find((part) => part.type === 'year')?.value ?? '0000',
    month: parts.find((part) => part.type === 'month')?.value ?? '01',
    day: parts.find((part) => part.type === 'day')?.value ?? '01',
  }
}

/** Returns the current month as 'YYYY-MM' in Argentina timezone. */
export function getCurrentMonth(now = new Date()): string {
  const { year, month } = getArgentinaDateParts(now)
  return `${year}-${month}`
}

/** Returns the current day of month (1-31) in Argentina timezone. */
export function getCurrentDayOfMonth(now = new Date()): number {
  const { day } = getArgentinaDateParts(now)
  return Number(day)
}

/** Adds `delta` months to a 'YYYY-MM' string. */
export function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
