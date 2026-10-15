'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatAmount } from '@/lib/format'
import {
  describeCardSetup,
  expensesSinceClose,
  lastCloseOnOrBefore,
  postponeStatementAsk,
  type StatementAnswer,
} from '@/lib/card-setup-state'
import { todayAR } from '@/lib/format'
import type { Account, Card, Expense } from '@/types/database'

type Props = {
  card: Card
  accounts: Account[]
  expenses: Expense[]
  onCardChange: (card: Card) => void
}

function expenseMeta(expense: Expense): string {
  if (expense.installment_number != null && expense.installment_total != null && expense.installment_total > 1) {
    return `${expense.installment_total} cuotas · ${expense.installment_number} de ${expense.installment_total}`
  }
  const date = expense.date.slice(0, 10)
  const [, month, day] = date.split('-')
  return `${day}/${month} · Crédito`
}

export function CardDetailSetup({ card, accounts, expenses, onCardChange }: Props) {
  const router = useRouter()
  const today = todayAR()
  const described = describeCardSetup(card, expenses, today)
  const [editingDates, setEditingDates] = useState(false)
  const [closing, setClosing] = useState(card.closing_day ? String(card.closing_day) : '')
  const [due, setDue] = useState(card.due_day ? String(card.due_day) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const accountName = accounts.find((account) => account.id === card.account_id)?.name ?? 'Sin cuenta'

  if (!described.tracked) return null
  if (!described.dates && !described.statement && !described.unknownStatement && !described.expenses) return null

  async function patch(body: Record<string, unknown>) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) throw new Error('No pudimos guardar.')
      onCardChange(await response.json() as Card)
      router.refresh()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos guardar.')
    } finally {
      setBusy(false)
    }
  }

  const closeDate = card.closing_day ? lastCloseOnOrBefore(today, card.closing_day) : null
  const sinceExpenses = closeDate ? expensesSinceClose(expenses, closeDate) : []

  return (
    <section className="space-y-4">
      <div className="rounded-card bg-white px-4 py-4 shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle py-3">
          <div>
            <p className="text-[15px] font-semibold text-text-primary">Ciclo habitual</p>
            <p className="text-xs text-text-tertiary">{described.cycleLine}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle py-3">
          <p className="text-[15px] font-semibold text-text-primary">Se paga desde</p>
          <p className="text-xs text-text-tertiary">{accountName}</p>
        </div>
        {described.dates ? (
          <div className="py-3">
            <p className="text-[13px] font-semibold text-text-tertiary">Falta completar</p>
            <p className="mt-2 text-[15px] font-semibold text-text-primary">{described.dates.title}</p>
            <p className="mt-1 text-xs leading-5 text-text-tertiary">{described.dates.body}</p>
            {editingDates ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="text-xs text-text-secondary">
                  Cierre habitual
                  <input inputMode="numeric" value={closing} placeholder="1 a 31" onChange={(event) => setClosing(event.target.value.replace(/\D/g, '').slice(0, 2))} className="mt-1 w-full rounded-input border border-border-strong px-3 py-2 text-sm" />
                </label>
                <label className="text-xs text-text-secondary">
                  Vencimiento habitual
                  <input inputMode="numeric" value={due} placeholder="1 a 31" onChange={(event) => setDue(event.target.value.replace(/\D/g, '').slice(0, 2))} className="mt-1 w-full rounded-input border border-border-strong px-3 py-2 text-sm" />
                </label>
                <button
                  type="button"
                  disabled={busy}
                  className="col-span-2 rounded-button bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={() => {
                    const closingDay = Number(closing)
                    const dueDay = Number(due)
                    if (!Number.isInteger(closingDay) || closingDay < 1 || closingDay > 31 || !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
                      setError('Completá el día de cierre y el de vencimiento.')
                      return
                    }
                    void patch({ closing_day: closingDay, due_day: dueDay })
                  }}
                >
                  Guardar fechas
                </button>
              </div>
            ) : (
              <button type="button" className="mt-3 text-sm font-semibold text-primary" onClick={() => setEditingDates(true)}>
                {described.dates.action}
              </button>
            )}
          </div>
        ) : null}
      </div>

      {described.statement ? (
        <div className="rounded-card bg-white px-4 py-4 shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
          <p className="text-[13px] font-semibold text-text-tertiary">Falta completar</p>
          <p className="mt-2 text-[15px] font-semibold text-text-primary">{described.statement.title}</p>
          <p className="mt-1 text-xs leading-5 text-text-tertiary">{described.statement.body}</p>
          {described.statement.actions.length > 0 ? (
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={busy} className="rounded-button bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void patch({ statement_resolved: 'paid' })}>
                Ya lo pagué
              </button>
              <button type="button" disabled={busy} className="rounded-button border border-border-strong bg-white px-4 py-2.5 text-sm font-semibold text-text-primary disabled:opacity-50" onClick={() => void patch({ statement_ask_after: postponeStatementAsk(today) })}>
                Todavía no
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {described.unknownStatement && !described.dates ? (
        <div className="rounded-card bg-white px-4 py-4 shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
          <p className="text-[13px] font-semibold text-text-tertiary">Falta completar</p>
          <p className="mt-2 text-[15px] font-semibold text-text-primary">¿Tenés un resumen cerrado pendiente de pagar?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(['yes', 'no', 'unknown'] as StatementAnswer[]).map((value) => (
              <button
                key={value}
                type="button"
                disabled={busy}
                className="rounded-full border border-border-strong px-3 py-2 text-sm font-semibold text-text-primary"
                onClick={() => void patch({ statement_answer: value })}
              >
                {value === 'yes' ? 'Sí' : value === 'no' ? 'No' : 'No sé todavía'}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {described.expenses ? (
        <div className="rounded-card bg-white px-4 py-4 shadow-[0_1px_6px_rgba(0,0,0,0.07)]">
          {described.expenses.mode === 'ask' ? (
            <>
              <p className="text-[15px] font-semibold text-text-primary">{described.expenses.question}</p>
              <p className="mt-1 text-xs leading-5 text-text-tertiary">{described.expenses.help}</p>
              <div className="mt-3 flex gap-2">
                <button type="button" className="rounded-button bg-primary px-4 py-2.5 text-sm font-semibold text-white" onClick={() => router.push(`/?cargar=1&card=${card.id}`)}>
                  Sumar gastos
                </button>
                <button type="button" disabled={busy} className="rounded-button border border-border-strong bg-white px-4 py-2.5 text-sm font-semibold text-text-primary disabled:opacity-50" onClick={() => void patch({ post_close_expenses: 'none' })}>
                  No la usé
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[15px] font-semibold text-text-primary">{described.expenses.heading}</p>
              <ul className="mt-3 divide-y divide-border-subtle">
                {sinceExpenses.map((expense) => (
                  <li key={expense.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">{expense.description || expense.category}</p>
                      <p className="text-xs text-text-tertiary">{expenseMeta(expense)}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{formatAmount(expense.amount, expense.currency)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-semibold text-primary">
                <button type="button" onClick={() => router.push(`/?cargar=1&card=${card.id}`)}>+ Agregar gasto</button>
                <span className="text-text-dim">·</span>
                <button type="button" onClick={() => router.push(`/movimientos?tarjetas=${card.id}`)}>Cuotas existentes</button>
              </div>
              <button type="button" disabled={busy} className="mt-4 w-full rounded-button bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50" onClick={() => void patch({ post_close_expenses: 'done' })}>
                Listo, ya están todos
              </button>
            </>
          )}
        </div>
      ) : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </section>
  )
}
