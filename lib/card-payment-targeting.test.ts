import { describe, expect, it } from 'vitest'
import { getAutoTargetCycles, resolveExplicitResolvedCycle } from '@/lib/card-payment-targeting'
import type { Card } from '@/types/database'

const card: Card = {
  id: 'card-1',
  user_id: 'user-1',
  name: 'MercadoPago',
  closing_day: 12,
  due_day: 17,
  account_id: null,
  archived: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('card payment targeting', () => {
  it('keeps the selected statement when cycle_id is explicit', () => {
    const cycles = [
      {
        id: 'march',
        user_id: 'user-1',
        card_id: 'card-1',
        period_month: '2026-03-01',
        closing_date: '2026-03-12',
        due_date: '2026-04-17',
        status: 'open' as const,
        amount_draft: null,
        amount_paid: null,
        paid_at: null,
        created_at: '2026-03-01T00:00:00Z',
        updated_at: '2026-03-01T00:00:00Z',
        source: 'stored' as const,
      },
      {
        id: 'april',
        user_id: 'user-1',
        card_id: 'card-1',
        period_month: '2026-04-01',
        closing_date: '2026-04-12',
        due_date: '2026-05-17',
        status: 'open' as const,
        amount_draft: null,
        amount_paid: null,
        paid_at: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: '2026-04-01T00:00:00Z',
        source: 'stored' as const,
      },
    ]

    const resolved = resolveExplicitResolvedCycle(cycles, card, { cycle_id: 'april' })
    expect(resolved?.id).toBe('april')
  })

  it('auto-targets closed cycles first and then the next open cycle when no explicit cycle exists', () => {
    const cycles = [
      { id: 'march', status: 'open', closing_date: '2026-03-12', due_date: '2026-04-17' },
      { id: 'april', status: 'open', closing_date: '2026-04-12', due_date: '2026-05-17' },
      { id: 'may', status: 'open', closing_date: '2026-05-12', due_date: '2026-06-17' },
    ]

    expect(getAutoTargetCycles(cycles, '2026-04-18').map((cycle) => cycle.id)).toEqual([
      'march',
      'april',
      'may',
    ])
  })
})
