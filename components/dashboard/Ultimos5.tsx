'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowCircleUp, X, ArrowRight, ArrowsLeftRight, TrendUp, CaretRight, ArrowsClockwise } from '@phosphor-icons/react'
import { formatAmount, formatDate } from '@/lib/format'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { Modal } from '@/components/ui/Modal'
import { FF_YIELD } from '@/lib/flags'
import type { Account, Expense, IncomeEntry, RecurringIncome, Transfer, YieldAccumulator } from '@/types/database'

const INCOME_LABELS: Record<string, string> = {
  salary: 'Sueldo',
  freelance: 'Freelance',
  other: 'Ingreso',
}

type YieldMovementData = YieldAccumulator & { accountName: string }

type Movement =
  | { kind: 'expense'; data: Expense }
  | { kind: 'income'; data: IncomeEntry }
  | { kind: 'transfer'; data: Transfer }
  | { kind: 'yield'; data: YieldMovementData }

interface Props {
  expenses: Expense[] | null
  incomeEntries: IncomeEntry[]
  transfers: Transfer[]
  accounts: Account[]
  month: string
  yieldAccumulators: YieldAccumulator[]
  isCurrentMonth: boolean
  recurringIncomes?: RecurringIncome[]
}

function getWantDotClass(isWant: boolean | null): string {
  if (isWant === true) return 'bg-want'
  if (isWant === false) return 'bg-success'
  return 'bg-text-dim'
}

function getMovementSortDate(mv: Movement): number {
  if (mv.kind === 'yield') {
    const d = mv.data.last_accrued_date ?? mv.data.created_at
    return new Date(d).getTime()
  }
  return new Date(mv.data.date).getTime()
}

export function Ultimos5({ expenses, incomeEntries, transfers, accounts, month, yieldAccumulators, isCurrentMonth, recurringIncomes }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [yieldSheetItem, setYieldSheetItem] = useState<YieldMovementData | null>(null)
  const [overrideAmount, setOverrideAmount] = useState('')
  const [isSavingOverride, setIsSavingOverride] = useState(false)
  const [gestionarEntry, setGestionarEntry] = useState<{ entry: IncomeEntry; ri: RecurringIncome } | null>(null)
  const [isDeactivating, setIsDeactivating] = useState(false)

  const recurringMap = new Map((recurringIncomes ?? []).map((ri) => [ri.id, ri]))

  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]))

  const handleDeleteIncome = async (id: string) => {
    setDeletedIds((prev) => new Set([...prev, id]))
    try {
      await fetch(`/api/income-entries/${id}`, { method: 'DELETE' })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      router.refresh()
    } catch {
      setDeletedIds((prev) => {
        const s = new Set(prev)
        s.delete(id)
        return s
      })
    }
  }

  const handleDeleteTransfer = async (id: string) => {
    setDeletedIds((prev) => new Set([...prev, id]))
    try {
      await fetch(`/api/transfers/${id}`, { method: 'DELETE' })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['account-breakdown'] })
      router.refresh()
    } catch {
      setDeletedIds((prev) => {
        const s = new Set(prev)
        s.delete(id)
        return s
      })
    }
  }

  const handleOpenYieldSheet = (ya: YieldMovementData) => {
    setOverrideAmount(String(ya.accumulated))
    setYieldSheetItem(ya)
  }

  const handleDeactivateRecurring = async () => {
    if (!gestionarEntry) return
    setIsDeactivating(true)
    try {
      await fetch(`/api/recurring-incomes/${gestionarEntry.ri.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setGestionarEntry(null)
    } catch {
      alert('Error al desactivar el recordatorio.')
    } finally {
      setIsDeactivating(false)
    }
  }

  const handleSaveOverride = async () => {
    if (!yieldSheetItem || overrideAmount === '') return
    setIsSavingOverride(true)
    try {
      await fetch(`/api/yield-accumulator/${yieldSheetItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accumulated: Number(overrideAmount), is_manual_override: true }),
      })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setYieldSheetItem(null)
    } catch {
      alert('Error al guardar rendimiento.')
    } finally {
      setIsSavingOverride(false)
    }
  }

  const yieldMovements: Movement[] = FF_YIELD
    ? yieldAccumulators.map((ya) => ({
        kind: 'yield' as const,
        data: { ...ya, accountName: accountMap[ya.account_id] ?? 'Cuenta' },
      }))
    : []

  const movements: Movement[] = [
    ...(expenses ?? []).map((e) => ({ kind: 'expense' as const, data: e })),
    ...incomeEntries
      .filter((e) => !deletedIds.has(e.id))
      .map((e) => ({ kind: 'income' as const, data: e })),
    ...transfers.filter((t) => !deletedIds.has(t.id)).map((t) => ({ kind: 'transfer' as const, data: t })),
    ...yieldMovements,
  ]
    .sort((a, b) => getMovementSortDate(b) - getMovementSortDate(a))
    .slice(0, 5)

  const inputClass =
    'w-full rounded-input border border-transparent bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-primary focus:outline-none'

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

            if (mv.kind === 'yield') {
              const ya = mv.data
              const isClosed = !!ya.confirmed_at
              return (
                <div
                  key={`y-${ya.account_id}`}
                  className={`flex items-center gap-3.5 py-3.5 ${divider} ${isCurrentMonth && !isClosed ? 'cursor-pointer' : ''}`}
                  onClick={() => isCurrentMonth && !isClosed && handleOpenYieldSheet(ya)}
                >
                  <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-success/20 bg-success/10">
                    <TrendUp weight="duotone" size={18} className="text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="m-0 truncate text-[13px] font-medium text-text-primary">
                      {ya.accountName}
                    </p>
                    <span className="text-[11px] text-text-label">
                      Rendimiento · {isClosed ? formatDate(ya.confirmed_at!) : 'en curso'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="text-right">
                      <p className="text-[14px] font-bold tabular-nums tracking-[-0.01em] text-success">
                        +{formatAmount(ya.accumulated, 'ARS')}
                      </p>
                      {!isClosed && (
                        <p className="text-[10px] text-text-disabled leading-none">est.</p>
                      )}
                    </div>
                    {isCurrentMonth && !isClosed && (
                      <CaretRight size={12} className="text-text-dim" />
                    )}
                  </div>
                </div>
              )
            }

            if (mv.kind === 'income') {
              const entry = mv.data
              const linkedRi = entry.recurring_income_id ? recurringMap.get(entry.recurring_income_id) : null
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
                    {linkedRi && (
                      <button
                        onClick={() => setGestionarEntry({ entry, ri: linkedRi })}
                        aria-label="Gestionar ingreso recurrente"
                        className="flex items-center justify-center text-primary/50 transition-colors hover:text-primary"
                      >
                        <ArrowsClockwise size={14} weight="bold" />
                      </button>
                    )}
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
                  <div className="flex items-center gap-2">
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
                    <button
                      onClick={() => handleDeleteTransfer(transfer.id)}
                      aria-label="Eliminar transferencia"
                      className="flex items-center justify-center text-text-disabled transition-colors hover:text-danger"
                    >
                      <X size={14} weight="bold" />
                    </button>
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

      {/* Gestionar ingreso recurrente */}
      {gestionarEntry && (
        <Modal open onClose={() => setGestionarEntry(null)}>
          <div className="space-y-4">
            <div>
              <p className="mb-0.5 text-xs text-text-tertiary">Ingreso recurrente</p>
              <h2 className="text-lg font-bold text-text-primary">
                {gestionarEntry.ri.description || INCOME_LABELS[gestionarEntry.ri.category] || 'Ingreso'}
              </h2>
            </div>
            <div className="rounded-card bg-bg-tertiary px-4 py-3 space-y-1.5">
              <div className="flex justify-between text-[13px]">
                <span className="text-text-secondary">Monto esperado</span>
                <span className="font-semibold text-text-primary tabular-nums">
                  {formatAmount(gestionarEntry.ri.amount, gestionarEntry.ri.currency as 'ARS' | 'USD')}
                </span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-text-secondary">Repite el día</span>
                <span className="font-semibold text-text-primary">{gestionarEntry.ri.day_of_month} de cada mes</span>
              </div>
            </div>
            <button
              onClick={handleDeactivateRecurring}
              disabled={isDeactivating}
              className="w-full rounded-button border border-danger/30 py-3 text-sm font-medium text-danger transition-colors hover:bg-danger/5 disabled:opacity-50"
            >
              {isDeactivating ? 'Desactivando...' : 'Desactivar recordatorio'}
            </button>
          </div>
        </Modal>
      )}

      {/* Override manual sheet — solo mes en curso */}
      {yieldSheetItem && (
        <Modal open onClose={() => setYieldSheetItem(null)}>
          <div className="space-y-4">
            <div>
              <p className="mb-0.5 text-xs text-text-tertiary">Rendimiento estimado</p>
              <h2 className="text-lg font-bold text-text-primary">{yieldSheetItem.accountName}</h2>
            </div>
            <p className="text-[13px] text-text-secondary">
              Si conocés el número real desde la app del banco, ingresalo acá. Gota dejará de estimar este mes.
            </p>
            <label className="block space-y-1">
              <span className="text-[10px] text-text-disabled">Acumulado del mes (ARS)</span>
              <input
                type="number"
                inputMode="decimal"
                value={overrideAmount}
                onChange={(e) => setOverrideAmount(e.target.value)}
                className={inputClass}
                autoFocus
              />
            </label>
            <button
              onClick={handleSaveOverride}
              disabled={isSavingOverride || overrideAmount === ''}
              className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-bg-primary transition-all duration-150 hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              {isSavingOverride ? 'Guardando...' : 'Guardar monto real'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
