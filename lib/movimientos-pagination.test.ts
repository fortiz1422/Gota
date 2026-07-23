import { describe, expect, it } from 'vitest'
import { paginateMovements, type PaginatedMovement } from './movimientos-pagination'

function expense(id: string): PaginatedMovement {
  return {
    kind: 'expense',
    data: {
      id,
      date: '2026-07-20',
      created_at: `2026-07-20T12:${id.padStart(2, '0')}:00.000Z`,
    },
  } as PaginatedMovement
}

describe('paginateMovements', () => {
  it('keeps yield rows in the same stable collection on every page', () => {
    const regular = Array.from({ length: 25 }, (_, index) => expense(String(index + 1)))
    const yieldMovement = {
      kind: 'yield',
      data: { id: 'yield-1', date: '2026-07-20' },
    } as PaginatedMovement

    const page1 = paginateMovements([yieldMovement, ...regular], 1, 20, '2026-07-23')
    const page2 = paginateMovements([yieldMovement, ...regular], 2, 20, '2026-07-23')
    const combinedIds = [...page1.movements, ...page2.movements].map((movement) => movement.data.id)

    expect(page1.total).toBe(26)
    expect(page2.total).toBe(26)
    expect(combinedIds).toHaveLength(26)
    expect(new Set(combinedIds).size).toBe(26)
    expect(combinedIds).toEqual(expect.arrayContaining(['yield-1', ...regular.map((movement) => movement.data.id)]))
  })
})
