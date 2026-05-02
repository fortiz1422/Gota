import { describe, expect, it } from 'vitest'
import type { ExpenseInsert } from '@/types/database'
import { addMonthsPreservingDay, buildInstallmentRows } from './installments'

const baseExpenseFields: Omit<
  ExpenseInsert,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'installment_group_id' | 'installment_number' | 'installment_total'
> = {
  amount: 100,
  currency: 'ARS',
  category: 'Indumentaria',
  description: 'Compra en cuotas',
  is_want: false,
  is_legacy_card_payment: null,
  payment_method: 'CREDIT',
  card_id: 'card-1',
  account_id: null,
  date: '2026-01-31',
}

describe('addMonthsPreservingDay', () => {
  it('preserves month-end dates when possible and clamps shorter months', () => {
    expect(addMonthsPreservingDay('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonthsPreservingDay('2024-01-31', 2)).toBe('2024-03-31')
    expect(addMonthsPreservingDay('2026-01-31', 1)).toBe('2026-02-28')
  })
})

describe('buildInstallmentRows', () => {
  it('splits cents across installments and assigns sequential dates', () => {
    const rows = buildInstallmentRows({
      userId: 'user-1',
      expenseFields: baseExpenseFields,
      installments: 3,
      groupId: 'group-1',
    })

    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.amount)).toEqual([33.33, 33.33, 33.34])
    expect(rows.map((row) => row.date)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ])
    expect(rows.map((row) => row.installment_group_id)).toEqual([
      'group-1',
      'group-1',
      'group-1',
    ])
    expect(rows.map((row) => row.installment_number)).toEqual([1, 2, 3])
    expect(rows.map((row) => row.installment_total)).toEqual([3, 3, 3])
    expect(rows.every((row) => row.user_id === 'user-1')).toBe(true)
  })

  it('keeps each row amount when importing installments already in progress', () => {
    const rows = buildInstallmentRows({
      userId: 'user-1',
      expenseFields: {
        ...baseExpenseFields,
        amount: 500,
        date: '2026-05-15',
      },
      installments: 2,
      installmentStart: 4,
      installmentGrandTotal: 6,
      groupId: 'group-2',
    })

    expect(rows.map((row) => row.amount)).toEqual([500, 500])
    expect(rows.map((row) => row.date)).toEqual(['2026-05-15', '2026-06-15'])
    expect(rows.map((row) => row.installment_number)).toEqual([4, 5])
    expect(rows.map((row) => row.installment_total)).toEqual([6, 6])
  })

  it('stores explicit card cycle assignments when provided', () => {
    const rows = buildInstallmentRows({
      userId: 'user-1',
      expenseFields: baseExpenseFields,
      installments: 2,
      cycleAssignments: [
        { card_cycle_id: 'cycle-1', cycle_date: '2026-01-26' },
        { card_cycle_id: 'cycle-2', cycle_date: '2026-02-26' },
      ],
      groupId: 'group-3',
    })

    expect(rows.map((row) => row.card_cycle_id)).toEqual(['cycle-1', 'cycle-2'])
  })
})
