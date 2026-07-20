import { describe, expect, it } from 'vitest'
import type { Expense } from '@/types/database'
import { computeMetrics } from './computeMetrics'

function expense(id: string, amount: number): Expense {
  return {
    id,
    amount,
    category: 'Otros',
    currency: 'ARS',
    date: '2026-07-10',
    description: `Gasto ${id}`,
    is_want: true,
    payment_method: 'DEBIT',
  } as Expense
}

describe('computeMetrics small expenses', () => {
  it('uses the lower of the median ticket and 1% of monthly spend', () => {
    const amounts = [5, 5, 10, 20, 30, 30, 100, 200, 300, 300]
    const metrics = computeMetrics(
      amounts.map((amount, index) => expense(String(index), amount)),
      1_000_000,
      'ARS',
      '2026-07'
    )

    expect(metrics.totalGastado).toBe(1000)
    expect(metrics.goteoCount).toBe(3)
    expect(metrics.goteoTotal).toBe(20)
    expect(metrics.pctGoteoDelTotal).toBe(2)
  })

  it('does not classify ordinary tickets as small merely because income is high', () => {
    const metrics = computeMetrics(
      [10, 20, 30, 40].map((amount, index) => expense(String(index), amount)),
      10_000_000,
      'ARS',
      '2026-07'
    )

    expect(metrics.goteoCount).toBe(0)
    expect(metrics.goteoTotal).toBe(0)
    expect(metrics.pctGoteoDelTotal).toBe(0)
  })
})
