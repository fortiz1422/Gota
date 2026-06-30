import { describe, expect, it } from 'vitest'
import { computeCompromisos } from '@/lib/analytics/computeCompromisos'
import type { Card, CardCycle, Expense } from '@/types/database'

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'bna-card',
    user_id: 'user-1',
    name: 'BNA MASTER',
    closing_day: 30,
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
    card_id: 'bna-card',
    period_month: '2026-06-01',
    closing_date: '2026-07-02',
    due_date: '2026-07-13',
    status: 'paid',
    amount_draft: null,
    amount_paid: 368_719,
    paid_at: '2026-06-10T12:00:00.000Z',
    dates_confirmed_at: '2026-06-30T12:00:00.000Z',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-30T00:00:00Z',
    ...overrides,
  }
}

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'expense-1',
    user_id: 'user-1',
    subscription_id: null,
    amount: 600_000,
    currency: 'ARS',
    category: 'Alimentos',
    description: 'consumos del resumen',
    is_want: false,
    is_recurring: false,
    is_extraordinary: false,
    is_legacy_card_payment: null,
    payment_method: 'CREDIT',
    card_id: 'bna-card',
    card_cycle_id: 'cycle-june',
    account_id: null,
    date: '2026-06-20',
    created_at: '2026-06-20T00:00:00Z',
    updated_at: '2026-06-20T00:00:00Z',
    installment_group_id: null,
    installment_number: null,
    installment_total: null,
    ...overrides,
  }
}

describe('computeCompromisos card cycle edits', () => {
  it('keeps a paid-marked cycle as commitment when edited dates make the statement exceed the paid amount', () => {
    const data = computeCompromisos(
      [makeExpense()],
      [makeCard()],
      [makeCycle()],
      7_000_000,
      '2026-06',
      true,
      [],
      'ARS',
    )

    const bna = data.tarjetas.find((tarjeta) => tarjeta.id === 'bna-card')

    expect(bna?.cycleStatus).toBe('en_curso')
    expect(bna?.currentSpend).toBe(231_281)
    expect(data.totalEnCurso).toBe(231_281)
    expect(data.totalComprometido).toBe(231_281)
  })
})
