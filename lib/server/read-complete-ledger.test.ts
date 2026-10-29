import { describe, expect, it, vi } from 'vitest'
import { readCompleteLedger } from './read-complete-ledger'

describe('complete financial ledger reads', () => {
  it('reads 1500 rows including an exact page boundary without an extra empty request', async () => {
    const rows = Array.from({ length: 1500 }, (_, n) => ({ id: String(n) }))
    const read = vi.fn(async (from: number, to: number) => ({
      data: rows.slice(from, to + 1),
      error: null,
      count: rows.length,
    }))
    expect((await readCompleteLedger(read)).data).toEqual(rows)
    expect(read).toHaveBeenCalledTimes(3)
    expect(read).toHaveBeenLastCalledWith(1000, 1499)
  })
  it('accepts an explicitly counted empty ledger', async () => {
    expect(
      await readCompleteLedger(async () => ({
        data: [],
        error: null,
        count: 0,
      }))
    ).toEqual({ data: [], error: null })
  })
  it('rejects missing counts, API errors and capped pages rather than publishing partial totals', async () => {
    for (const page of [
      { data: [], error: null, count: null },
      { data: null, error: { message: 'down' }, count: null },
      { data: [{ id: 'one' }], error: null, count: 1001 },
      { data: [{ id: 'one' }], error: null, count: 0 },
    ])
      await expect(readCompleteLedger(async () => page)).rejects.toThrow(
        'balance_unavailable'
      )
  })
  it('rejects count changes and overlapping pages during a concurrent write', async () => {
    const first = Array.from({ length: 500 }, (_, n) => ({ id: String(n) }))
    for (const second of [
      { data: [{ id: '500' }], count: 502, error: null },
      { data: [{ id: '0' }], count: 501, error: null },
      { data: null, count: 501, error: { message: 'second page failed' } },
    ]) {
      const read = vi
        .fn()
        .mockResolvedValueOnce({ data: first, count: 501, error: null })
        .mockResolvedValueOnce(second)
      await expect(readCompleteLedger(read)).rejects.toThrow(
        'balance_unavailable'
      )
    }
  })
})
