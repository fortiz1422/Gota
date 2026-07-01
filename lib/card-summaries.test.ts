import { describe, expect, it } from 'vitest'
import { shouldDisplayCardCycleInDetail, sumCardSummaryPreview } from '@/lib/card-summaries'
import type { EnrichedCycle } from '@/lib/card-summaries'

function makeCycle(overrides: Partial<EnrichedCycle> = {}): EnrichedCycle {
  return {
    id: 'cycle-july',
    source: 'stored',
    period_month: '2026-07-01',
    period_from: '2026-07-03',
    closing_date: '2026-07-30',
    due_date: '2026-08-08',
    cycleStatus: 'en_curso',
    amount: 42_000,
    paid_at: null,
    amount_paid: null,
    dates_confirmed_at: null,
    remaining_amount: 42_000,
    has_partial_payment: false,
    changed_after_payment: false,
    currency: 'ARS',
    ...overrides,
  }
}

describe('shouldDisplayCardCycleInDetail', () => {
  it('hides a not-yet-started current-month cycle even if it already has assigned expenses', () => {
    expect(shouldDisplayCardCycleInDetail(makeCycle(), '2026-07-01')).toBe(false)
  })

  it('shows the cycle once its real period starts', () => {
    expect(shouldDisplayCardCycleInDetail(makeCycle(), '2026-07-03')).toBe(true)
  })

  it('keeps paid historical cycles visible even when amount is zero', () => {
    expect(
      shouldDisplayCardCycleInDetail(
        makeCycle({
          period_month: '2026-05-01',
          period_from: '2026-05-31',
          closing_date: '2026-06-30',
          cycleStatus: 'pagado',
          amount: 0,
          remaining_amount: 0,
          paid_at: '2026-06-05T12:00:00.000Z',
        }),
        '2026-07-01',
      ),
    ).toBe(true)
  })
})

describe('sumCardSummaryPreview', () => {
  it('includes the started in-course statement in the cards sheet preview', () => {
    expect(sumCardSummaryPreview([
      makeCycle({
        period_month: '2026-06-01',
        period_from: '2026-05-31',
        closing_date: '2026-07-02',
        cycleStatus: 'en_curso',
        remaining_amount: 537_793.34,
      }),
      makeCycle({
        period_month: '2026-07-01',
        period_from: '2026-07-03',
        closing_date: '2026-07-30',
        cycleStatus: 'en_curso',
        remaining_amount: 42_000,
      }),
    ], '2026-07', '2026-07-01')).toBe(537_793.34)
  })

  it('includes closed and overdue unpaid statements', () => {
    expect(sumCardSummaryPreview([
      makeCycle({
        period_month: '2026-06-01',
        period_from: '2026-05-31',
        closing_date: '2026-06-30',
        cycleStatus: 'cerrado',
        remaining_amount: 100_000,
      }),
      makeCycle({
        period_month: '2026-05-01',
        period_from: '2026-05-01',
        closing_date: '2026-05-30',
        cycleStatus: 'vencido',
        remaining_amount: 50_000,
      }),
    ], '2026-07', '2026-07-01')).toBe(150_000)
  })
})
