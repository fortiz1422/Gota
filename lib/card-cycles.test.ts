import { describe, expect, it } from 'vitest'
import { buildLegacyCardCycle, resolveDueMonth } from '@/lib/card-cycles'
import type { Card } from '@/types/database'

function makeCard(overrides: Partial<Card>): Card {
  return {
    id: 'card-1',
    user_id: 'user-1',
    name: 'Test card',
    closing_day: 12,
    due_day: 17,
    account_id: null,
    archived: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('card cycle due date resolution', () => {
  it('keeps due date in the same period month when due_day is after closing_day', () => {
    expect(resolveDueMonth('2026-05', 12, 17)).toBe('2026-05')

    const cycle = buildLegacyCardCycle(makeCard({ closing_day: 12, due_day: 17 }), '2026-05')
    expect(cycle.closing_date).toBe('2026-05-12')
    expect(cycle.due_date).toBe('2026-05-17')
  })

  it('moves due date to the next month when due_day is on or before closing_day', () => {
    expect(resolveDueMonth('2026-05', 26, 1)).toBe('2026-06')
    expect(resolveDueMonth('2026-05', 12, 12)).toBe('2026-06')

    const cycle = buildLegacyCardCycle(makeCard({ closing_day: 26, due_day: 1 }), '2026-05')
    expect(cycle.closing_date).toBe('2026-05-26')
    expect(cycle.due_date).toBe('2026-06-01')
  })
})
