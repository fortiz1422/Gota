'use client'

import { useState } from 'react'
import { ArrowCircleUp, ArrowsLeftRight, Funnel, TrendUp } from '@phosphor-icons/react'
import { formatAmount, formatDate, todayAR } from '@/lib/format'
import { ExpenseItem } from '@/components/expenses/ExpenseItem'
import { IncomeEditSheet } from './IncomeEditSheet'
import { TransferEditSheet } from './TransferEditSheet'
import type {
  Account,
  Card,
  Expense,
  IncomeEntry,
  Transfer,
  YieldAccumulator,
} from '@/types/database'

const INCOME_LABELS: Record<string, string> = {
  salary: 'Sueldo',
  freelance: 'Freelance',
  other: 'Ingreso',
}

type ApiMovement =
  | { kind: 'expense'; data: Expense }
  | { kind: 'income'; data: IncomeEntry }
  | { kind: 'transfer'; data: Transfer }
  | { kind: 'yield'; data: YieldAccumulator & { accountName: string } }

function getMovementDate(mv: ApiMovement): string {
  if (mv.kind === 'yield') {
    return (mv.data.last_accrued_date ?? mv.data.created_at).substring(0, 10)
  }
  return mv.data.date.substring(0, 10)
}

function groupByDate(movements: ApiMovement[]): [string, ApiMovement[]][] {
  const map = new Map<string, ApiMovement[]>()
  for (const mv of movements) {
    const date = getMovementDate(mv)
    if (!map.has(date)) map.set(date, [])
    map.get(date)!.push(mv)
  }
  const today = todayAR()
  return [...map.entries()].sort(([a], [b]) => {
    const aFuture = a > today
    const bFuture = b > today
    if (aFuture !== bFuture) return aFuture ? 1 : -1
    return b.localeCompare(a)
  })
}

function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

interface Props {
  movements: ApiMovement[]
  total: number
  isLoadingMore: boolean
  onLoadMore: () => void
  accounts: Account[]
  cards: Card[]
  onRefresh: () => void
  activeCount: number
  onOpenFilters: () => void
  onClearFilters: () => void
  activeFilterSummary: string
  showActiveFilter: boolean
}

export function MovimientosGroupedList({
  movements,
  total,
  isLoadingMore,
  onLoadMore,
  accounts,
  cards,
  onRefresh,
  activeCount,
  onOpenFilters,
  onClearFilters,
  activeFilterSummary,
  showActiveFilter,
}: Props) {
  const [editingIncome, setEditingIncome] = useState<IncomeEntry | null>(null)
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null)

  if (movements.length === 0) {
    return (
      <p className="py-8 text-center text-[15px] text-text-secondary">
        Sin movimientos para este período.
      </p>
    )
  }

  const grouped = groupByDate(movements)

  return (
    <div>
      {grouped.map(([date, items], groupIndex) => (
        <div key={date}>
          <div className="flex items-center justify-between py-3">
            <span className="text-[12px] capitalize text-text-dim">{formatDayLabel(date)}</span>
            {groupIndex === 0 && (
              <button
                onClick={onOpenFilters}
                className="relative flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-opacity hover:opacity-70 active:opacity-50"
                aria-label="Filtrar movimientos"
              >
                <Funnel size={18} weight="light" />
                {activeCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold text-white">
                    {activeCount}
                  </span>
                )}
              </button>
            )}
          </div>

          <div>
            {items.map((mv, idx) => {
              const isLast = idx === items.length - 1
              const divider = !isLast ? 'border-b border-[color:var(--color-separator)]' : ''

              if (mv.kind === 'yield') {
                const ya = mv.data
                const isClosed = !!ya.confirmed_at

                return (
                  <div
                    key={`y-${ya.account_id}-${ya.id}`}
                    className={`flex items-center gap-3 py-3.5 ${divider}`}
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
                    <p className="text-[16px] font-bold tracking-[-0.01em] tabular-nums text-success">
                      +{formatAmount(ya.accumulated, 'ARS')}
                    </p>
                  </div>
                )
              }

              if (mv.kind === 'income') {
                const entry = mv.data

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
                        {INCOME_LABELS[entry.category]}
                      </span>
                    </div>
                    <p className="text-[16px] font-bold tracking-[-0.01em] tabular-nums text-success">
                      +{formatAmount(entry.amount, entry.currency)}
                    </p>
                  </div>
                )
              }

              if (mv.kind === 'transfer') {
                const transfer = mv.data
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
                        Transferencia
                      </p>
                      {transfer.note && (
                        <span className="text-[12px] text-text-dim">{transfer.note}</span>
                      )}
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
                  onUpdate={onRefresh}
                />
              )
            })}
          </div>
        </div>
      ))}

      {total > movements.length && (
        <div className="flex justify-center py-4">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="rounded-button border border-[color:var(--color-separator)] px-4 py-2 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-bg-secondary disabled:opacity-50"
          >
            {isLoadingMore ? 'Cargando...' : 'Cargar más'}
          </button>
        </div>
      )}

      {editingIncome && (
        <IncomeEditSheet
          entry={editingIncome}
          accounts={accounts}
          onClose={() => setEditingIncome(null)}
          onUpdate={() => {
            setEditingIncome(null)
            onRefresh()
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
            onRefresh()
          }}
        />
      )}
    </div>
  )
}
