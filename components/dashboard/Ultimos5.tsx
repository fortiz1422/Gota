'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowCircleUp, X, ArrowRight, ArrowsLeftRight } from '@phosphor-icons/react'
import { formatAmount, formatDate } from '@/lib/format'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import type { Account, Expense, IncomeEntry, Transfer } from '@/types/database'

const INCOME_LABELS: Record<string, string> = {
  salary: 'Sueldo',
  freelance: 'Freelance',
  other: 'Ingreso',
}

type Movement =
  | { kind: 'expense'; data: Expense }
  | { kind: 'income'; data: IncomeEntry }
  | { kind: 'transfer'; data: Transfer }

interface Props {
  expenses: Expense[] | null
  incomeEntries: IncomeEntry[]
  transfers: Transfer[]
  accounts: Account[]
  month: string
}

function getWantDotClass(isWant: boolean | null): string {
  if (isWant === true) return 'bg-want'
  if (isWant === false) return 'bg-success'
  return 'bg-text-dim'
}

export function Ultimos5({ expenses, incomeEntries, transfers, accounts, month }: Props) {
  const router = useRouter()
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]))

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
    ...transfers.map((t) => ({ kind: 'transfer' as const, data: t })),
  ]
    .sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())
    .slice(0, 5)

  return (
    <div className="px-2">
      <div className="mb-1 flex items-center justify-between">
        <p className="type-label text-text-label">Últimos movimientos</p>
        <Link
          href={`/expenses?month=${month}`}
          className="flex items-center gap-1 text-[11px] font-medium text-primary no-underline"
        >
          Ver todos <ArrowRight size={11} weight="bold" />
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
            const divider = !isLast ? 'border-b border-border-subtle' : ''

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
                      className="flex items-center justify-center text-text-disabled transition-colors hover:text-danger"
                    >
                      <X size={14} weight="bold" />
                    </button>
                  </div>
                </div>
              )
            }

            if (mv.kind === 'transfer') {
              const transfer = mv.data
              const fromName = accountMap[transfer.from_account_id] ?? 'Cuenta'
              const toName = accountMap[transfer.to_account_id] ?? 'Cuenta'
              const sameCurrency = transfer.currency_from === transfer.currency_to
              return (
                <div key={`t-${transfer.id}`} className={`flex items-center gap-3.5 py-3.5 ${divider}`}>
                  <div
                    className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'rgba(27,126,158,0.10)', border: '1px solid rgba(27,126,158,0.20)' }}
                  >
                    <ArrowsLeftRight weight="duotone" size={18} style={{ color: 'var(--color-ocean)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="m-0 truncate text-[13px] font-medium text-text-primary">
                      {fromName} → {toName}
                    </p>
                    <span className="text-[11px] text-text-label">
                      {transfer.note ? `${transfer.note} · ` : ''}
                      {formatDate(transfer.date)}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[14px] font-bold tabular-nums tracking-[-0.01em] text-text-secondary">
                      {formatAmount(transfer.amount_from, transfer.currency_from)}
                    </p>
                    {!sameCurrency && (
                      <p className="text-[11px] text-text-tertiary">
                        {formatAmount(transfer.amount_to, transfer.currency_to)}
                      </p>
                    )}
                  </div>
                </div>
              )
            }

            const expense = mv.data
            const isPagoTarjetas = expense.category === 'Pago de Tarjetas'
            const isUsd = expense.currency === 'USD'
            return (
              <div key={`e-${expense.id}`} className={`flex items-center gap-3.5 py-3.5 ${divider}`}>
                <CategoryIcon category={expense.category} size={18} container />
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
                    {expense.installment_number != null && expense.installment_total != null && (
                      <span className="text-[10px] text-text-tertiary">
                        · Cuota {expense.installment_number}/{expense.installment_total}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`text-[14px] font-bold tabular-nums tracking-[-0.01em] ${isPagoTarjetas ? 'text-primary' : 'text-text-primary'}`}
                  >
                    {formatAmount(expense.amount, expense.currency)}
                  </p>
                  {isUsd && (
                    <span className="text-[10px] font-semibold text-warning">USD</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
