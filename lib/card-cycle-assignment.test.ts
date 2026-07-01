import { describe, expect, it } from 'vitest'
import { getCyclePeriodMonthForDate } from '@/lib/card-cycle-assignment'
import type { Card, CardCycle } from '@/types/database'

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    user_id: 'user-1',
    name: 'BNA MASTER',
    closing_day: 2,
    due_day: 13,
    account_id: null,
    archived: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeCycle(overrides: Partial<CardCycle> = {}): CardCycle {
  return {
    id: 'cycle-june',
    user_id: 'user-1',
    card_id: 'card-1',
    period_month: '2026-06-01',
    closing_date: '2026-07-02',
    due_date: '2026-07-13',
    status: 'open',
    amount_draft: null,
    amount_paid: null,
    paid_at: null,
    dates_confirmed_at: '2026-06-30T12:00:00.000Z',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-30T00:00:00Z',
    ...overrides,
  }
}

describe('getCyclePeriodMonthForDate', () => {
  it('assigns a charge before an edited closing date to the still-open previous statement', () => {
    expect(
      getCyclePeriodMonthForDate(makeCard(), '2026-07-01', [
        makeCycle({ period_month: '2026-06-01', closing_date: '2026-07-02' }),
        makeCycle({ period_month: '2026-07-01', closing_date: '2026-08-02' }),
      ]),
    ).toBe('2026-06')
  })

  it('starts the next statement on the day after the previous edited closing date', () => {
    expect(
      getCyclePeriodMonthForDate(makeCard(), '2026-07-03', [
        makeCycle({ period_month: '2026-06-01', closing_date: '2026-07-02' }),
        makeCycle({ period_month: '2026-07-01', closing_date: '2026-08-02' }),
      ]),
    ).toBe('2026-07')
  })
})
