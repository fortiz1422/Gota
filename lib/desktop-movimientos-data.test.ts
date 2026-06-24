import { describe, expect, it, vi } from 'vitest'
import type { ApiMovement, MovimientosApiResponse } from '@/components/dashboard/desktop/movimientos-data'
import { fetchAllMovimientosForMonth } from '@/components/dashboard/desktop/movimientos-data'

function response(payload: MovimientosApiResponse, ok = true) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(payload),
  }
}

describe('fetchAllMovimientosForMonth', () => {
  it('fetches every page until total movements are loaded', async () => {
    const page1: ApiMovement[] = Array.from({ length: 20 }, (_, index) =>
      ({
        kind: 'expense',
        data: {
          id: `e-${index + 1}`,
          user_id: 'user-1',
          description: `Gasto ${index + 1}`,
          category: 'Comida',
          amount: 100,
          currency: 'ARS',
          payment_method: 'DEBIT',
          card_id: null,
          account_id: 'acc-1',
          date: '2026-06-10',
          created_at: '2026-06-10T12:00:00.000Z',
        },
      }) as unknown as ApiMovement,
    )

    const page2: ApiMovement[] = [
      {
        kind: 'income',
        data: {
          id: 'i-21',
          user_id: 'user-1',
          category: 'salary',
          amount: 500,
          currency: 'ARS',
          account_id: 'acc-1',
          date: '2026-06-11',
          description: 'Sueldo',
          recurring_income_id: null,
          created_at: '2026-06-11T12:00:00.000Z',
        },
      } as ApiMovement,
    ]

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ movements: page1, total: 21 }))
      .mockResolvedValueOnce(response({ movements: page2, total: 21 }))

    const result = await fetchAllMovimientosForMonth('2026-06', fetchMock)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/movimientos?month=2026-06&page=1&includeYield=false')
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/movimientos?month=2026-06&page=2&includeYield=false')
    expect(result).toHaveLength(21)
    expect(result.at(-1)).toEqual(page2[0])
  })

  it('throws when a page request fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ movements: [], total: 0 }, false))

    await expect(fetchAllMovimientosForMonth('2026-06', fetchMock)).rejects.toThrow(
      'movimientos fetch failed for month 2026-06 page 1',
    )
  })
})
