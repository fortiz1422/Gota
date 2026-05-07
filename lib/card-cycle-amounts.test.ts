import { describe, expect, it } from 'vitest'
import { buildCardCycleAmountsMap, getEffectiveCardCycleState } from '@/lib/card-cycle-amounts'
import type { CardCycleAmount } from '@/types/database'

describe('card cycle amounts', () => {
  it('does not leak ARS paid state into USD when only an ARS row exists', () => {
    const map = buildCardCycleAmountsMap([
      {
        id: 'row-1',
        user_id: 'user-1',
        card_cycle_id: 'cycle-1',
        currency: 'ARS',
        status: 'paid',
        amount_draft: 117000,
        amount_paid: 117000,
        paid_at: '2026-04-18T12:00:00+00:00',
        created_at: '2026-05-07T00:00:00Z',
        updated_at: '2026-05-07T00:00:00Z',
      } satisfies CardCycleAmount,
    ])

    const usdState = getEffectiveCardCycleState(
      {
        id: 'cycle-1',
        status: 'paid',
        amount_draft: 117000,
        amount_paid: 117000,
        paid_at: '2026-04-18T12:00:00+00:00',
      },
      'USD',
      map,
    )

    expect(usdState).toEqual({
      status: 'open',
      amount_draft: null,
      amount_paid: null,
      paid_at: null,
    })
  })
})
