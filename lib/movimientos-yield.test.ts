import { describe, expect, it } from 'vitest'
import type { YieldDailyEntry } from '@/types/database'
import { aggregateYieldDailyEntriesForMovements } from './movimientos-yield'

describe('aggregateYieldDailyEntriesForMovements', () => {
  it('groups daily yield entries into one monthly movement per account', () => {
    const movements = aggregateYieldDailyEntriesForMovements(
      [
        {
          account_id: 'acc-bna',
          date: '2026-06-01',
          currency: 'ARS',
          expected_amount: 767.12,
          actual_amount: null,
          status: 'estimated',
        },
        {
          account_id: 'acc-bna',
          date: '2026-06-02',
          currency: 'ARS',
          expected_amount: 767.12,
          actual_amount: 800,
          status: 'difference',
        },
        {
          account_id: 'acc-other',
          date: '2026-06-02',
          currency: 'ARS',
          expected_amount: 100,
          actual_amount: null,
          status: 'estimated',
        },
      ] satisfies Pick<YieldDailyEntry, 'account_id' | 'date' | 'currency' | 'expected_amount' | 'actual_amount' | 'status'>[],
      { 'acc-bna': 'Banco Nación', 'acc-other': 'Otra cuenta' },
    )

    expect(movements).toEqual([
      {
        kind: 'yield',
        data: expect.objectContaining({
          id: 'yield-acc-bna-2026-06',
          account_id: 'acc-bna',
          accountName: 'Banco Nación',
          date: '2026-06-02',
          amount: 1567.12,
          dayCount: 2,
          estimatedCount: 1,
          actualCount: 1,
          differenceCount: 1,
          status: 'difference',
        }),
      },
      {
        kind: 'yield',
        data: expect.objectContaining({
          id: 'yield-acc-other-2026-06',
          amount: 100,
          dayCount: 1,
          status: 'estimated',
        }),
      },
    ])
  })
})
