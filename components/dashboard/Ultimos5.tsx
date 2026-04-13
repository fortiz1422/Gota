'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import {
  ArrowCircleUp,
  ArrowsClockwise,
  ArrowsLeftRight,
  CaretRight,
  TrendUp,
} from '@phosphor-icons/react'
import { formatAmount, formatDate, todayAR, toDateOnly } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import { FF_YIELD } from '@/lib/flags'
import { ExpenseItem } from '@/components/expenses/ExpenseItem'
import { IncomeEditSheet } from '@/components/movimientos/IncomeEditSheet'
import { TransferEditSheet } from '@/components/movimientos/TransferEditSheet'
import type {
  Account,
  Card,
  Expense,
  IncomeEntry,
  RecurringIncome,
  Transfer,
  YieldAccumulator,
} from '@/types/database'

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
  cards: Card[]
  month: string
  yieldAccumulators: YieldAccumulator[]
  isCurrentMonth: boolean
  recurringIncomes?: RecurringIncome[]
}

function getMovementSortDate(mv: Movement): number {
  if (mv.kind === 'yield') {
    const d = mv.data.last_accrued_date ?? mv.data.created_at
    return new Date(d).getTime()
  }
  return new Date(mv.data.date).getTime()
}

function getMovementDateOnly(mv: Movement): string {
  if (mv.kind === 'yield') {
    return toDateOnly(mv.data.last_accrued_date ?? mv.data.created_at)
  }
  return toDateOnly(mv.data.date)
}

export function Ultimos5({
  expenses,
  incomeEntries,
  transfers,
  accounts,
  cards,
  month,
  yieldAccumulators,
  isCurrentMonth,
  recurringIncomes,
}: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [editingIncome, setEditingIncome] = useState<IncomeEntry | null>(null)
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null)
  const [yieldSheetItem, setYieldSheetItem] = useState<YieldMovementData | null>(null)
  const [overrideAmount, setOverrideAmount] = useState('')
  const [isSavingOverride, setIsSavingOverride] = useState(false)
  const [gestionarEntry, setGestionarEntry] = useState<{
    entry: IncomeEntry
    ri: RecurringIncome
  } | null>(null)
  const [isDeactivating, setIsDeactivating] = useState(false)

  const recurringMap = new Map((recurringIncomes ?? []).map((ri) => [ri.id, ri]))
  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]))
  const today = todayAR()

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['account-breakdown'] })
    router.refresh()
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
        body: JSON.stringify({
          accumulated: Number(overrideAmount),
          is_manual_override: true,
        }),
      })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['account-breakdown'] })
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
    ...incomeEntries.map((e) => ({ kind: 'income' as const, data: e })),
    ...transfers.map((t) => ({ kind: 'transfer' as const, data: t })),
    ...yieldMovements,
  ]
    .sort((a, b) => {
      const dateA = getMovementDateOnly(a)
      const dateB = getMovementDateOnly(b)
      const aFuture = dateA > today
      const bFuture = dateB > today

      if (aFuture !== bFuture) return aFuture ? 1 : -1
      if (dateB !== dateA) return dateB.localeCompare(dateA)
      return getMovementSortDate(b) - getMovementSortDate(a)
    })
    .slice(0, 5)

  const inputClass =
    'w-full rounded-input border border-transparent bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-primary focus:outline-none'

  const openMovimientos = () => {
    const params = new URLSearchParams()
    if (month) params.set('month', month)
    const query = params.toString()
    router.push(query ? `/movimientos?${query}` : '/movimientos')
  }

  return (
    <div className="px-2">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="type-label text-text-secondary">Últimos movimientos</p>
        <button
          onClick={openMovimientos}
          className="rounded-button border border-primary/20 px-3 py-1.5 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/5"
        >
          Ver todas
        </button>
      </div>

      {movements.length === 0 ? (
        <p className="mt-3 text-[15px] text-text-secondary">
          Sin movimientos registrados este mes.
        </p>
      ) : (
        <div>
          {movements.map((mv, idx) => {
            const isLast = idx === movements.length - 1
            const divider = !isLast ? 'border-b border-[color:var(--color-separator)]' : ''

            if (mv.kind === 'yield') {
              const ya = mv.data
              const isClosed = !!ya.confirmed_at

              return (
                <div
                  key={`y-${ya.account_id}`}
                  className={`flex items-center gap-3 py-3.5 ${divider} ${isCurrentMonth && !isClosed ? 'cursor-pointer' : ''}`}
                  onClick={() => isCurrentMonth && !isClosed && handleOpenYieldSheet(ya)}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-success/20 bg-success/10">
                    <TrendUp weight="duotone" size={16} className="text-success" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[15px] font-medium text-text-primary">
                      {ya.accountName}
                    </p>
                    <span className="text-[12px] text-text-dim">
                      Rendimiento · {isClosed ? formatDate(ya.confirmed_at!) : 'en curso'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="text-right">
                      <p className="text-[16px] font-bold tracking-[-0.01em] tabular-nums text-success">
                        +{formatAmount(ya.accumulated, 'ARS')}
                      </p>
                      {!isClosed && (
                        <p className="text-[10px] leading-none text-text-disabled">est.</p>
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
              const linkedRi = entry.recurring_income_id
                ? recurringMap.get(entry.recurring_income_id)
                : null

              return (
                <div
                  key={`i-${entry.id}`}
                  onClick={() => setEditingIncome(entry)}
                  className={`flex cursor-pointer items-center gap-3 py-3.5 ${divider}`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-success/20 bg-success/10">
                    <ArrowCircleUp weight="duotone" size={16} className="text-success" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[15px] font-medium text-text-primary">
                      {entry.description || INCOME_LABELS[entry.category] || 'Ingreso'}
                    </p>
                    <span className="text-[12px] text-text-dim">
                      {INCOME_LABELS[entry.category]} · {formatDate(entry.date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[16px] font-bold tracking-[-0.01em] tabular-nums text-success">
                      +{formatAmount(entry.amount, entry.currency)}
                    </p>
                    {linkedRi && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setGestionarEntry({ entry, ri: linkedRi })
                        }}
                        aria-label="Gestionar ingreso recurrente"
                        className="flex items-center justify-center text-primary/50 transition-colors hover:text-primary"
                      >
                        <ArrowsClockwise size={14} weight="bold" />
                      </button>
                    )}
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
                <div
                  key={`t-${transfer.id}`}
                  onClick={() => setEditingTransfer(transfer)}
                  className={`flex cursor-pointer items-center gap-3 py-3.5 ${divider}`}
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: 'rgba(27,126,158,0.10)',
                      border: '1px solid rgba(27,126,158,0.20)',
                    }}
                  >
                    <ArrowsLeftRight
                      weight="duotone"
                      size={16}
                      style={{ color: 'var(--color-ocean)' }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[15px] font-medium text-text-primary">
                      {fromName} → {toName}
                    </p>
                    <span className="text-[12px] text-text-dim">
                      {transfer.note ? `${transfer.note} · ` : ''}
                      {formatDate(transfer.date)}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[16px] font-bold tracking-[-0.01em] tabular-nums text-text-secondary">
                      {formatAmount(transfer.amount_from, transfer.currency_from)}
                    </p>
                    {!sameCurrency && (
                      <p className="text-[12px] text-text-dim">
                        {formatAmount(transfer.amount_to, transfer.currency_to)}
                      </p>
                    )}
                  </div>
                </div>
              )
            }

            return (
              <ExpenseItem
                key={`e-${mv.data.id}`}
                expense={mv.data}
                cards={cards}
                accounts={accounts}
                onUpdate={handleRefresh}
              />
            )
          })}
        </div>
      )}

      {editingIncome && (
        <IncomeEditSheet
          entry={editingIncome}
          accounts={accounts}
          onClose={() => setEditingIncome(null)}
          onUpdate={() => {
            setEditingIncome(null)
            handleRefresh()
          }}
        />
      )}

      {editingTransfer && (
        <TransferEditSheet
          transfer={editingTransfer}
          accounts={accounts}
          onClose={() => setEditingTransfer(null)}
          onUpdate={() => {
            setEditingTransfer(null)
            handleRefresh()
          }}
        />
      )}

      {gestionarEntry && (
        <Modal open onClose={() => setGestionarEntry(null)}>
          <div className="space-y-4">
            <div>
              <p className="mb-0.5 text-xs text-text-tertiary">Ingreso recurrente</p>
              <h2 className="text-lg font-bold text-text-primary">
                {gestionarEntry.ri.description ||
                  INCOME_LABELS[gestionarEntry.ri.category] ||
                  'Ingreso'}
              </h2>
            </div>
            <div className="space-y-1.5 rounded-card bg-bg-tertiary px-4 py-3">
              <div className="flex justify-between text-[13px]">
                <span className="text-text-secondary">Monto esperado</span>
                <span className="font-semibold tabular-nums text-text-primary">
                  {formatAmount(
                    gestionarEntry.ri.amount,
                    gestionarEntry.ri.currency as 'ARS' | 'USD'
                  )}
                </span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-text-secondary">Repite el día</span>
                <span className="font-semibold text-text-primary">
                  {gestionarEntry.ri.day_of_month} de cada mes
                </span>
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

      {yieldSheetItem && (
        <Modal open onClose={() => setYieldSheetItem(null)}>
          <div className="space-y-4">
            <div>
              <p className="mb-0.5 text-xs text-text-tertiary">Rendimiento estimado</p>
              <h2 className="text-lg font-bold text-text-primary">
                {yieldSheetItem.accountName}
              </h2>
            </div>
            <p className="text-[13px] text-text-secondary">
              Si conocés el número real desde la app del banco, ingresalo acá. Gota dejará de
              estimar este mes.
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
