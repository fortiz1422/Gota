import { toDateOnly } from '@/lib/format'
import type { YieldMonthlyMovementData } from '@/lib/movimientos-yield'
import type { Expense, IncomeEntry, Transfer } from '@/types/database'

export type PaginatedMovement =
  | { kind: 'expense'; data: Expense }
  | { kind: 'income'; data: IncomeEntry }
  | { kind: 'transfer'; data: Transfer }
  | { kind: 'yield'; data: YieldMonthlyMovementData }

export function paginateMovements(
  movements: PaginatedMovement[],
  page: number,
  pageSize: number,
  today: string,
): { movements: PaginatedMovement[]; total: number } {
  const sorted = [...movements].sort((a, b) => {
    const dateA = toDateOnly(a.data.date)
    const dateB = toDateOnly(b.data.date)
    const aFuture = dateA > today
    const bFuture = dateB > today
    if (aFuture !== bFuture) return aFuture ? 1 : -1
    if (dateB !== dateA) return dateB.localeCompare(dateA)
    const createdAtA = a.kind === 'yield' ? '' : a.data.created_at
    const createdAtB = b.kind === 'yield' ? '' : b.data.created_at
    return createdAtB.localeCompare(createdAtA)
  })
  const offset = (page - 1) * pageSize

  return {
    movements: sorted.slice(offset, offset + pageSize),
    total: sorted.length,
  }
}
