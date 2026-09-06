import { describe, expect, it } from 'vitest'
import { buildCardCycleAmountsMap } from '@/lib/card-cycle-amounts'
import { buildCardPaymentPromptCandidates } from '@/lib/card-payment-prompts'
import type { Card, CardCycle, CardCycleAmount, Expense } from '@/types/database'

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    user_id: 'user-1',
    name: 'Visa',
    closing_day: 20,
    due_day: 10,
    account_id: 'account-1',
    last_four: null,
    archived: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeExpense(overrides: Partial<Expense>): Expense {
  return {
    id: 'expense-1',
    user_id: 'user-1',
    amount: 100,
    currency: 'ARS',
    category: 'Super',
    description: 'Compra',
    is_want: false,
    payment_method: 'CREDIT',
    card_id: 'card-1',
    account_id: null,
    date: '2026-05-01',
    created_at: '2026-05-01T12:00:00.000Z',
    updated_at: '2026-05-01T12:00:00.000Z',
    installment_group_id: null,
    installment_number: null,
    installment_total: null,
    subscription_id: null,
    is_recurring: null,
    is_extraordinary: null,
    card_cycle_id: null,
    is_legacy_card_payment: null,
    source_shared_receipt_id: null,
    ...overrides,
  }
}

function makeCycle(overrides: Partial<CardCycle>): CardCycle {
  return {
    id: 'cycle-1',
    user_id: 'user-1',
    card_id: 'card-1',
    period_month: '2026-05-01',
    closing_date: '2026-05-20',
    due_date: '2026-06-10',
    status: 'open',
    amount_draft: null,
    amount_paid: null,
    paid_at: null,
    dates_confirmed_at: null,
    created_at: '2026-05-20T12:00:00.000Z',
    updated_at: '2026-05-20T12:00:00.000Z',
    ...overrides,
  }
}

function makeCycleAmount(overrides: Partial<CardCycleAmount>): CardCycleAmount {
  return {
    id: 'amount-1',
    user_id: 'user-1',
    card_cycle_id: 'cycle-1',
    currency: 'ARS',
    status: 'open',
    amount_draft: null,
    amount_paid: null,
    paid_at: null,
    created_at: '2026-05-20T12:00:00.000Z',
    updated_at: '2026-05-20T12:00:00.000Z',
    ...overrides,
  }
}

describe('buildCardPaymentPromptCandidates', () => {
  it('suggests the closed statement using the day after previous closing as period start', () => {
    const candidates = buildCardPaymentPromptCandidates({
      cards: [makeCard()],
      storedCycles: [
        makeCycle({
          id: 'april',
          period_month: '2026-04-01',
          closing_date: '2026-04-20',
          status: 'paid',
          paid_at: '2026-05-01T12:00:00.000Z',
        }),
      ],
      expenses: [
        makeExpense({ id: 'previous-close', amount: 900, date: '2026-04-20' }),
        makeExpense({ id: 'included', amount: 1200, date: '2026-04-21' }),
      ],
      selectedMonth: '2026-06',
      isCurrentMonth: true,
      today: '2026-06-01',
    })

    expect(candidates).toHaveLength(1)
    expect(candidates[0].periodMonth).toBe('2026-05')
    expect(candidates[0].blocks[0].cycle.amount).toBe(1200)
    expect(candidates[0].blocks[0].cycle.remaining_amount).toBe(1200)
  })

  it('suggests only remaining amount after a partial payment', () => {
    const cycleAmountsMap = buildCardCycleAmountsMap([
      makeCycleAmount({ card_cycle_id: 'cycle-1', amount_paid: 400 }),
    ])

    const candidates = buildCardPaymentPromptCandidates({
      cards: [makeCard()],
      storedCycles: [makeCycle({ id: 'cycle-1' })],
      expenses: [makeExpense({ amount: 1000, date: '2026-05-05', card_cycle_id: 'cycle-1' })],
      cycleAmountsMap,
      selectedMonth: '2026-06',
      isCurrentMonth: true,
      today: '2026-06-01',
    })

    expect(candidates).toHaveLength(1)
    expect(candidates[0].blocks[0].cycle.amount).toBe(1000)
    expect(candidates[0].blocks[0].cycle.remaining_amount).toBe(600)
    expect(candidates[0].blocks[0].cycle.has_partial_payment).toBe(true)
  })

  it('groups ARS and USD pending balances for the same statement', () => {
    const candidates = buildCardPaymentPromptCandidates({
      cards: [makeCard()],
      storedCycles: [makeCycle({ id: 'cycle-1' })],
      expenses: [
        makeExpense({ id: 'ars', amount: 1000, currency: 'ARS', date: '2026-05-05', card_cycle_id: 'cycle-1' }),
        makeExpense({ id: 'usd', amount: 25, currency: 'USD', date: '2026-05-06', card_cycle_id: 'cycle-1' }),
      ],
      selectedMonth: '2026-06',
      isCurrentMonth: true,
      today: '2026-06-01',
    })

    expect(candidates).toHaveLength(1)
    expect(candidates[0].blocks.map((block) => block.currency)).toEqual(['ARS', 'USD'])
    expect(candidates[0].blocks.map((block) => block.cycle.remaining_amount)).toEqual([1000, 25])
  })

  it('skips paid or zero-balance statements and keeps later cards available', () => {
    const candidates = buildCardPaymentPromptCandidates({
      cards: [makeCard(), makeCard({ id: 'card-2', name: 'Master', created_at: '2026-01-02T00:00:00.000Z' })],
      storedCycles: [
        makeCycle({ id: 'paid-cycle', card_id: 'card-1', status: 'paid', paid_at: '2026-06-01T12:00:00.000Z' }),
        makeCycle({ id: 'open-cycle', card_id: 'card-2' }),
      ],
      expenses: [
        makeExpense({ id: 'paid-expense', card_id: 'card-1', amount: 1000, card_cycle_id: 'paid-cycle' }),
        makeExpense({ id: 'open-expense', card_id: 'card-2', amount: 700, card_cycle_id: 'open-cycle' }),
      ],
      selectedMonth: '2026-06',
      isCurrentMonth: true,
      today: '2026-06-01',
    })

    expect(candidates).toHaveLength(1)
    expect(candidates[0].card.id).toBe('card-2')
    expect(candidates[0].blocks[0].cycle.remaining_amount).toBe(700)
  })

  it('does not suggest prompts outside the current month view', () => {
    const candidates = buildCardPaymentPromptCandidates({
      cards: [makeCard()],
      storedCycles: [makeCycle({ id: 'cycle-1' })],
      expenses: [makeExpense({ amount: 1000, card_cycle_id: 'cycle-1' })],
      selectedMonth: '2026-05',
      isCurrentMonth: false,
      today: '2026-06-01',
    })

    expect(candidates).toEqual([])
  })
})
