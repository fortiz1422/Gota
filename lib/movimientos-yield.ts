import type { YieldDailyEntry } from '@/types/database'

export type YieldMonthlyMovementData = {
  id: string
  account_id: string
  accountName: string
  date: string
  month: string
  currency: 'ARS' | 'USD'
  amount: number
  dayCount: number
  estimatedCount: number
  actualCount: number
  differenceCount: number
  status: 'estimated' | 'matched' | 'actual_only' | 'difference' | 'mixed'
}

export type YieldMonthlyMovement = {
  kind: 'yield'
  data: YieldMonthlyMovementData
}

type YieldEntryLike = Pick<
  YieldDailyEntry,
  'account_id' | 'date' | 'currency' | 'expected_amount' | 'actual_amount' | 'status'
>

export function aggregateYieldDailyEntriesForMovements(
  entries: YieldEntryLike[],
  accountMap: Record<string, string>,
): YieldMonthlyMovement[] {
  const groups = new Map<string, YieldMonthlyMovementData>()

  for (const entry of entries) {
    const month = entry.date.slice(0, 7)
    const key = `${entry.account_id}-${month}`
    const amount = Number(entry.actual_amount ?? entry.expected_amount ?? 0)
    const current = groups.get(key) ?? {
      id: `yield-${entry.account_id}-${month}`,
      account_id: entry.account_id,
      accountName: accountMap[entry.account_id] ?? 'Cuenta',
      date: entry.date,
      month,
      currency: entry.currency,
      amount: 0,
      dayCount: 0,
      estimatedCount: 0,
      actualCount: 0,
      differenceCount: 0,
      status: 'estimated' as const,
    }

    current.amount = roundMoney(current.amount + amount)
    current.dayCount += 1
    if (entry.date > current.date) current.date = entry.date
    if (entry.actual_amount != null) current.actualCount += 1
    else current.estimatedCount += 1
    if (entry.status === 'difference') current.differenceCount += 1
    current.status = resolveGroupStatus(current)
    groups.set(key, current)
  }

  return [...groups.values()]
    .sort((a, b) => b.date.localeCompare(a.date) || a.accountName.localeCompare(b.accountName))
    .map((data) => ({ kind: 'yield' as const, data }))
}

function resolveGroupStatus(group: YieldMonthlyMovementData): YieldMonthlyMovementData['status'] {
  if (group.differenceCount > 0) return 'difference'
  if (group.actualCount > 0 && group.estimatedCount > 0) return 'mixed'
  if (group.actualCount > 0) return 'matched'
  return 'estimated'
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
