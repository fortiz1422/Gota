import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    last_four: null,
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
    source_shared_receipt_id: null,
    ...overrides,
  }
}

describe('computeCompromisos card cycle edits', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-01T15:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

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

  it('uses the stored statement amount for the active cycle instead of only live expenses', () => {
    const data = computeCompromisos(
      [makeExpense({ amount: 48_000 })],
      [makeCard()],
      [
        makeCycle({
          status: 'open',
          amount_draft: 606_215,
          amount_paid: null,
          paid_at: null,
        }),
      ],
      7_000_000,
      '2026-06',
      true,
      [],
      'ARS',
    )

    const bna = data.tarjetas.find((tarjeta) => tarjeta.id === 'bna-card')

    expect(bna?.cycleStatus).toBe('en_curso')
    expect(bna?.currentSpend).toBe(606_215)
    expect(data.totalEnCurso).toBe(606_215)
    expect(data.totalComprometido).toBe(606_215)
  })

  it('prioritizes the current future cycle with remaining amount over an empty duplicate future cycle', () => {
    const data = computeCompromisos(
      [
        makeExpense({
          id: 'expense-june-summary',
          amount: 606_215.32,
          card_cycle_id: 'cycle-june',
          date: '2026-06-20',
        }),
        makeExpense({
          id: 'expense-july-noise',
          amount: 48_911,
          card_cycle_id: 'cycle-july',
          date: '2026-06-29',
        }),
      ],
      [makeCard({ closing_day: 2 })],
      [
        makeCycle({
          id: 'cycle-july',
          period_month: '2026-07-01',
          closing_date: '2026-07-02',
          due_date: '2026-07-13',
          status: 'open',
          amount_paid: null,
          paid_at: null,
        }),
        makeCycle({
          id: 'cycle-june',
          period_month: '2026-06-01',
          closing_date: '2026-07-02',
          due_date: '2026-07-13',
          status: 'open',
          amount_paid: null,
          paid_at: null,
        }),
      ],
      7_000_000,
      '2026-06',
      true,
      [],
      'ARS',
    )

    const bna = data.tarjetas.find((tarjeta) => tarjeta.id === 'bna-card')

    expect(bna?.cycleStatus).toBe('en_curso')
    expect(bna?.currentSpend).toBe(606_215.32)
    expect(data.totalEnCurso).toBe(606_215.32)
    expect(data.totalComprometido).toBe(606_215.32)
  })

  it('does not switch commitments to the selected month cycle before the previous edited cycle closes', () => {
    const data = computeCompromisos(
      [
        makeExpense({
          id: 'expense-june-summary',
          amount: 600_000,
          card_cycle_id: 'cycle-june',
          date: '2026-07-01',
        }),
        makeExpense({
          id: 'expense-july-future',
          amount: 300_000,
          card_cycle_id: 'cycle-july',
          date: '2026-07-03',
        }),
      ],
      [makeCard({ closing_day: 2 })],
      [
        makeCycle({
          id: 'cycle-june',
          period_month: '2026-06-01',
          closing_date: '2026-07-02',
          due_date: '2026-07-13',
          status: 'open',
          amount_paid: null,
          paid_at: null,
        }),
        makeCycle({
          id: 'cycle-july',
          period_month: '2026-07-01',
          closing_date: '2026-07-30',
          due_date: '2026-08-08',
          status: 'open',
          amount_paid: null,
          paid_at: null,
        }),
      ],
      7_000_000,
      '2026-07',
      true,
      [],
      'ARS',
    )

    const bna = data.tarjetas.find((tarjeta) => tarjeta.id === 'bna-card')

    expect(bna?.cycleStatus).toBe('en_curso')
    expect(bna?.currentSpend).toBe(600_000)
    expect(data.totalEnCurso).toBe(600_000)
    expect(data.totalComprometido).toBe(600_000)
  })
})
