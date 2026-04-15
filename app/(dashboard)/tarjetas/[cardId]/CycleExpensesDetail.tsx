'use client'

import { formatAmount, formatDate } from '@/lib/format'
import type { Expense } from '@/types/database'

interface Props {
  expenses: Expense[]
  paidAt?: string | null
}

export function CycleExpensesDetail({ expenses, paidAt = null }: Props) {
  if (expenses.length === 0) return null

  return (
    <div className="space-y-1 border-t border-border-subtle pb-3 pt-2">
      {expenses.map((expense) => {
        const changedAfterPayment =
          paidAt != null && (expense.created_at > paidAt || expense.updated_at > paidAt)

        return (
          <div key={expense.id} className="flex items-center justify-between gap-3 px-4 py-1">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {changedAfterPayment && (
                  <span
                    aria-label="Cambiado despues del pago"
                    className="h-2 w-2 shrink-0 rounded-full bg-danger"
                    title="Cambiado despues del pago"
                  />
                )}
                <p className="truncate text-xs text-text-primary">
                  {expense.description || expense.category}
                </p>
              </div>
              <p className="text-[10px] text-text-tertiary">
                {formatDate(expense.date)} | {expense.category}
                {expense.installment_number != null && expense.installment_total != null && (
                  <span className="ml-1">| Cuota {expense.installment_number}/{expense.installment_total}</span>
                )}
              </p>
            </div>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-text-primary">
              {formatAmount(expense.amount, expense.currency)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
