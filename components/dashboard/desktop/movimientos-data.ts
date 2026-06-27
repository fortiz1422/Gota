import type { YieldMonthlyMovementData } from '@/lib/movimientos-yield'
import type { Expense, IncomeEntry, Transfer } from '@/types/database'

export type ApiMovement =
  | { kind: 'expense'; data: Expense }
  | { kind: 'income'; data: IncomeEntry }
  | { kind: 'transfer'; data: Transfer }
  | { kind: 'yield'; data: YieldMonthlyMovementData }

export type MovimientosApiResponse = {
  movements: ApiMovement[]
  total: number
}

type FetchLike = (input: string, init?: RequestInit) => Promise<{
  ok: boolean
  json(): Promise<MovimientosApiResponse>
}>

export async function fetchAllMovimientosForMonth(
  month: string,
  fetchImpl: FetchLike = fetch as FetchLike,
): Promise<ApiMovement[]> {
  const allMovements: ApiMovement[] = []
  let total = Infinity
  let page = 1

  while (allMovements.length < total) {
    const response = await fetchImpl(
      `/api/movimientos?month=${encodeURIComponent(month)}&page=${page}&includeYield=false`,
    )
    if (!response.ok) {
      throw new Error(`movimientos fetch failed for month ${month} page ${page}`)
    }

    const payload = await response.json()
    const pageMovements = payload.movements ?? []
    total = payload.total ?? 0
    allMovements.push(...pageMovements)

    if (pageMovements.length === 0 || allMovements.length >= total) {
      break
    }

    page += 1
  }

  return allMovements
}
