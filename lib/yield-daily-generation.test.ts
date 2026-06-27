import { describe, expect, it } from 'vitest'
import { buildEstimatedDailyYieldEntries } from './yield-daily'

describe('buildEstimatedDailyYieldEntries', () => {
  it('creates one estimated entry per calendar day using BNA cap and 365-day TNA', () => {
    const entries = buildEstimatedDailyYieldEntries({
      accountId: 'acc-bna',
      userId: 'user-1',
      fromDate: '2026-06-27',
      toDate: '2026-06-29',
      baseBalance: 8_900_000,
      rateTna: 14,
      capAmount: 2_000_000,
      existingEntries: [],
    })

    expect(entries.map((entry) => entry.date)).toEqual(['2026-06-27', '2026-06-28', '2026-06-29'])
    expect(entries.map((entry) => entry.expected_amount)).toEqual([767.12, 767.12, 767.12])
    expect(entries.every((entry) => entry.status === 'estimated')).toBe(true)
  })

  it('does not overwrite imported or manually adjusted days', () => {
    const entries = buildEstimatedDailyYieldEntries({
      accountId: 'acc-bna',
      userId: 'user-1',
      fromDate: '2026-06-27',
      toDate: '2026-06-29',
      baseBalance: 8_900_000,
      rateTna: 14,
      capAmount: 2_000_000,
      existingEntries: [
        { date: '2026-06-28', status: 'matched' },
        { date: '2026-06-29', status: 'manual_adjusted' },
      ],
    })

    expect(entries.map((entry) => entry.date)).toEqual(['2026-06-27'])
  })
})
