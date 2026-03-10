'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowCircleUp } from '@phosphor-icons/react'
import { formatAmount, formatDate } from '@/lib/format'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import type { Expense, IncomeEntry } from '@/types/database'

const INCOME_LABELS: Record<string, string> = {
  salary: 'Sueldo',
  freelance: 'Freelance',
  other: 'Ingreso',
}

type Movement =
  | { kind: 'expense'; data: Expense }
  | { kind: 'income'; data: IncomeEntry }

interface Props {
  expenses: Expense[] | null
  incomeEntries: IncomeEntry[]
  month: string
}

function getWantDotClass(isWant: boolean | null): string {
  if (isWant === true) return 'bg-want'
  if (isWant === false) return 'bg-success'
  return 'bg-text-dim'
}

export function Ultimos5({ expenses, incomeEntries, month }: Props) {
  const router = useRouter()
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

  const handleDeleteIncome = async (id: string) => {
    setDeletedIds((prev) => new Set([...prev, id]))
    try {
      await fetch(`/api/income-entries/${id}`, { method: 'DELETE' })
      router.refresh()
    } catch {
      setDeletedIds((prev) => {
        const s = new Set(prev)
        s.delete(id)
        return s
      })
    }
  }

  const movements: Movement[] = [
    ...(expenses ?? []).map((e) => ({ kind: 'expense' as const, data: e })),
    ...incomeEntries
      .filter((e) => !deletedIds.has(e.id))
      .map((e) => ({ kind: 'income' as const, data: e })),
  ]
    .sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())
    .slice(0, 5)

  return (
    <div className="px-2">
      <div className="mb-1 flex items-center justify-between">
        <p className="type-label text-text-label">Últimos movimientos</p>
        <Link
          href={`/expenses?month=${month}`}
          className="text-[11px] font-medium text-primary no-underline"
        >
          Ver todos →
        </Link>
      </div>

      {movements.length === 0 ? (
        <p className="mt-2.5 text-[13px] text-text-tertiary">
          Sin movimientos registrados este mes.
        </p>
      ) : (
        <div>
          {movements.map((mv, idx) => {
            const isLast = idx === movements.length - 1
            const divider = !isLast ? 'border-b border-primary/12' : ''

            if (mv.kind === 'income') {
              const entry = mv.data
              return (
                <div key={`i-${entry.id}`} className={`flex items-center gap-3.5 py-3.5 ${divider}`}>
                  <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-success/20 bg-success/10">
                    <ArrowCircleUp weight="duotone" size={18} className="text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="m-0 truncate text-[13px] font-medium text-text-primary">
                      {entry.description || INCOME_LABELS[entry.category] || 'Ingreso'}
                    </p>
                    <span className="text-[11px] text-text-label">
                      {INCOME_LABELS[entry.category]} · {formatDate(entry.date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-bold tabular-nums tracking-[-0.01em] text-success">
                      +{formatAmount(entry.amount, entry.currency)}
                    </p>
                    <button
                      onClick={() => handleDeleteIncome(entry.id)}
                      aria-label="Eliminar ingreso"
                      className="text-lg leading-none text-text-disabled transition-colors hover:text-danger"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )
            }

            const expense = mv.data
            const isPagoTarjetas = expense.category === 'Pago de Tarjetas'
            return (
              <div key={`e-${expense.id}`} className={`flex items-center gap-3.5 py-3.5 ${divider}`}>
                <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-border-ocean bg-primary/6">
                  <CategoryIcon category={expense.category} size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="m-0 truncate text-[13px] font-medium text-text-primary">
                    {expense.description || expense.category}
                  </p>
                  <div className="mt-[3px] flex items-center gap-1.5">
                    <span
                      className={`inline-block h-[5px] w-[5px] shrink-0 rounded-full ${getWantDotClass(expense.is_want)}`}
                    />
                    <span className="text-[11px] text-text-label">
                      {expense.category} · {formatDate(expense.date)}
                    </span>
                  </div>
                </div>
                <p
                  className={`text-[14px] font-bold tabular-nums tracking-[-0.01em] ${isPagoTarjetas ? 'text-primary' : 'text-text-primary'}`}
                >
                  {formatAmount(expense.amount, expense.currency)}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
