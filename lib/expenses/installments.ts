import { toDateOnly } from '@/lib/format'
import type { Expense, ExpenseInsert } from '@/types/database'

type InstallmentBaseExpenseFields = Omit<
  ExpenseInsert,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'installment_group_id' | 'installment_number' | 'installment_total'
>

export function addMonthsPreservingDay(dateStr: string, n: number): string {
  const [year, month, day] = toDateOnly(dateStr).split('-').map(Number)
  const targetMonth = month - 1 + n
  const targetYear = year + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12
  const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate()
  const targetDay = Math.min(day, lastDay)

  return `${targetYear}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`
}

export function buildInstallmentRows({
  userId,
  expenseFields,
  installments,
  installmentStart,
  installmentGrandTotal,
  groupId = crypto.randomUUID(),
}: {
  userId: string
  expenseFields: InstallmentBaseExpenseFields
  installments: number
  installmentStart?: number
  installmentGrandTotal?: number
  groupId?: string
}): ExpenseInsert[] {
  const baseDate = toDateOnly(expenseFields.date ?? new Date().toISOString())
  const isInProgressInstallments = installmentStart != null
  const totalCents = Math.round(expenseFields.amount * 100)
  const baseCents = Math.floor(totalCents / installments)
  const remainderCents = totalCents - baseCents * installments
  const startNumber = installmentStart ?? 1
  const grandTotal = installmentGrandTotal ?? installments

  return Array.from({ length: installments }, (_, i) => ({
    user_id: userId,
    ...expenseFields,
    amount: isInProgressInstallments
      ? expenseFields.amount
      : (baseCents + (i === installments - 1 ? remainderCents : 0)) / 100,
    date: addMonthsPreservingDay(baseDate, i),
    installment_group_id: groupId,
    installment_number: startNumber + i,
    installment_total: grandTotal,
  }))
}

export function summarizeInstallmentGroup(rows: Expense[]) {
  const orderedRows = [...rows].sort((a, b) => {
    const byNumber = (a.installment_number ?? 0) - (b.installment_number ?? 0)
    if (byNumber !== 0) return byNumber
    return a.date.localeCompare(b.date)
  })

  const firstRow = orderedRows[0] ?? null

  return {
    orderedRows,
    firstRow,
    firstInstallmentNumber: firstRow?.installment_number ?? 1,
    recordedInstallments: orderedRows.length,
    totalAmount: orderedRows.reduce((sum, row) => sum + row.amount, 0),
    baseDate: firstRow?.date ? toDateOnly(firstRow.date) : null,
  }
}
