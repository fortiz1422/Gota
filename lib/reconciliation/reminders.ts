import type { Currency } from '@/types/database'

/** Call on server/app entry; a PWA timer is not the scheduler. */
export function reminderOccurrence(now: string, timeZone = 'America/Argentina/Buenos_Aires'): {
  date: string; reason: 'weekly' | 'month_end'
} | null {
  const date = new Date(now)
  if (!Number.isFinite(date.getTime())) throw new Error('INVALID_TIMESTAMP')
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)!.value
  const year = Number(get('year')); const month = Number(get('month')); const day = Number(get('day'))
  const hour = Number(get('hour'))
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const localDate = `${get('year')}-${get('month')}-${get('day')}`
  // Initial configurable product policy: 20:00 local month-end; Saturday from 09:00.
  if (day === days && hour >= 20) return { date: localDate, reason: 'month_end' }
  if (weekday === 6 && hour >= 9) return { date: localDate, reason: 'weekly' }
  return null
}

/** One inbox task per user/account/currency, independent of checkpoint count or reminder date. */
export function reconciliationTaskKey(input: { userId: string; accountId: string; currency: Currency }): string {
  return JSON.stringify(['balance_confirmation', input.userId, input.accountId, input.currency])
}

export type ResumePointer = {
  schemaVersion: 1
  userId: string
  accountId: string
  currency: Currency
  checkpointId: string
  step: 'difference' | 'resolve' | 'movement_draft'
}

/** Only a route pointer: financial values must be reloaded from authoritative persistence. */
export function parseResumePointer(serialized: string, currentUserId: string): ResumePointer | null {
  try {
    const input: unknown = JSON.parse(serialized)
    if (input === null || typeof input !== 'object') return null
    const row = input as Record<string, unknown>
    if (row.schemaVersion !== 1 || row.userId !== currentUserId) return null
    if (typeof row.accountId !== 'string' || !row.accountId || typeof row.checkpointId !== 'string' || !row.checkpointId) return null
    if (row.currency !== 'ARS' && row.currency !== 'USD') return null
    if (!['difference', 'resolve', 'movement_draft'].includes(String(row.step))) return null
    return {
      schemaVersion: 1, userId: currentUserId, accountId: row.accountId,
      currency: row.currency, checkpointId: row.checkpointId, step: row.step as ResumePointer['step'],
    }
  } catch { return null }
}
