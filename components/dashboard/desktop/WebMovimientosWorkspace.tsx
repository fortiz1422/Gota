'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowsLeftRight,
  CaretRight,
  CreditCard,
  MagnifyingGlass,
  TrendUp,
  Wallet,
} from '@phosphor-icons/react'
import { HomePlusButton } from '@/components/dashboard/HomePlusButton'
import { CategoryIcon, getCategoryColors } from '@/components/ui/CategoryIcon'
import { fetchAllMovimientosForMonth, type ApiMovement } from './movimientos-data'
import {
  buildAccountActivityCounts,
  buildWebMovementRows,
  filterWebMovementRows,
  groupWebMovementRows,
  type WebMovementRow,
  type WebMovementType,
} from '@/lib/web-movimientos-model'
import { formatAmount, todayAR } from '@/lib/format'
import type { Account, Card } from '@/types/database'

type AccountBalance = {
  id: string
  name: string
  type: string
  is_primary: boolean
  saldo: number
}

type Props = {
  accounts: Account[]
  cards: Card[]
  accountBalances: AccountBalance[]
  selectedMonth: string
  viewCurrency: 'ARS' | 'USD'
  hidden: boolean
  initialMovements?: ApiMovement[]
  today?: string
  onOpenSettings: () => void
}

const TYPE_OPTIONS: Array<{ value: WebMovementType; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'expense', label: 'Gastos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'transfer', label: 'Transferencias' },
  { value: 'yield', label: 'Rendimientos' },
]

function accountTypeLabel(type: string): string {
  if (type === 'bank') return 'Banco'
  if (type === 'digital') return 'Digital'
  return 'Efectivo'
}

function signedAmountLabel(row: WebMovementRow, hidden: boolean): string {
  if (hidden) return '••••••'
  const prefix = row.tone === 'expense' ? '−' : row.tone === 'income' || row.tone === 'yield' ? '+' : ''
  return `${prefix}${formatAmount(row.amount, row.currency)}`
}

function RowIcon({ row }: { row: WebMovementRow }) {
  if (row.kind === 'expense') {
    const colors = getCategoryColors(row.category ?? '')
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]" style={{ background: colors.colorSoft }}>
        <CategoryIcon category={row.category ?? ''} size={16} />
      </span>
    )
  }
  const meta = {
    income: { Icon: ArrowDownLeft, color: '#1A7A42', bg: 'rgba(26,122,66,0.10)' },
    transfer: { Icon: ArrowsLeftRight, color: '#1B7E9E', bg: 'rgba(27,126,158,0.10)' },
    yield: { Icon: TrendUp, color: '#1A7A42', bg: 'rgba(26,122,66,0.10)' },
  }[row.kind]
  const Icon = meta.Icon
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]" style={{ color: meta.color, background: meta.bg }}>
      <Icon size={16} weight="bold" />
    </span>
  )
}

function MovementDetail({ row, hidden, onClose }: { row: WebMovementRow; hidden: boolean; onClose: () => void }) {
  const source = row.source.data
  const dateLabel = new Date(`${row.date}T12:00:00-03:00`).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  const impactCopy =
    row.kind === 'expense'
      ? 'Descontado de la cuenta indicada y computado según su medio de pago.'
      : row.kind === 'income'
        ? 'Sumado al saldo de la cuenta y al ingreso registrado del período.'
        : row.kind === 'transfer'
          ? 'Movió fondos entre cuentas propias sin contarlo como ingreso ni gasto.'
          : 'Sumado al saldo de la cuenta como rendimiento del instrumento.'

  return (
    <aside data-web-account-context="true" className="web-mov-context rounded-[14px] border border-primary/[0.09] bg-white p-5 shadow-[0_1px_4px_rgba(13,24,41,0.04)]">
      <button type="button" onClick={onClose} className="mb-5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary">
        <ArrowLeft size={13} weight="bold" /> Volver a cuentas
      </button>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.09em] text-text-dim">{row.kind === 'expense' ? 'Gasto' : row.kind === 'income' ? 'Ingreso' : row.kind === 'transfer' ? 'Transferencia' : 'Rendimiento'}</div>
      <h2 className="m-0 text-[20px] font-bold tracking-[-0.025em] text-text-primary">{row.title}</h2>
      <div className={`mt-5 text-[28px] font-extrabold tabular-nums tracking-[-0.04em] ${row.tone === 'income' || row.tone === 'yield' ? 'text-success' : 'text-text-primary'}`}>
        {signedAmountLabel(row, hidden)}
      </div>
      <div className="mt-1 capitalize text-[12px] text-text-dim">{dateLabel}</div>

      <dl className="mt-6 border-y border-primary/[0.08] py-2 text-[12px]">
        {row.category && (
          <div className="flex justify-between gap-4 py-2.5"><dt className="text-text-dim">Categoría</dt><dd className="m-0 text-right font-semibold text-text-primary">{row.category}</dd></div>
        )}
        <div className="flex justify-between gap-4 py-2.5"><dt className="text-text-dim">Origen</dt><dd className="m-0 text-right font-semibold text-text-primary">{row.secondary}</dd></div>
        {'note' in source && source.note && (
          <div className="flex justify-between gap-4 py-2.5"><dt className="text-text-dim">Nota</dt><dd className="m-0 text-right font-semibold text-text-primary">{source.note}</dd></div>
        )}
      </dl>

      <div className="mt-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.09em] text-text-dim">Impacto</div>
        <p className="mb-0 mt-2 text-[12px] leading-5 text-text-secondary">{impactCopy}</p>
      </div>
    </aside>
  )
}

export function WebMovimientosWorkspace({
  accounts,
  cards,
  accountBalances,
  selectedMonth,
  viewCurrency,
  hidden,
  initialMovements,
  today = todayAR(),
  onOpenSettings,
}: Props) {
  const [movements, setMovements] = useState<ApiMovement[]>(initialMovements ?? [])
  const [loading, setLoading] = useState(initialMovements === undefined)
  const [failed, setFailed] = useState(false)
  const [type, setType] = useState<WebMovementType>('all')
  const [accountId, setAccountId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)

  useEffect(() => {
    if (initialMovements !== undefined) return
    let cancelled = false
    void fetchAllMovimientosForMonth(selectedMonth)
      .then((next) => {
        if (!cancelled) {
          setMovements(next)
          setFailed(false)
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [initialMovements, selectedMonth])

  const rows = useMemo(() => buildWebMovementRows(movements, accounts, cards), [accounts, cards, movements])
  const filteredRows = useMemo(
    () => filterWebMovementRows(rows, { type, accountId, query }),
    [accountId, query, rows, type],
  )
  const groups = useMemo(() => groupWebMovementRows(filteredRows, today), [filteredRows, today])
  const activityCounts = useMemo(() => buildAccountActivityCounts(rows), [rows])
  const selectedRow = rows.find((row) => row.id === selectedRowId) ?? null
  const totalBalance = accountBalances.reduce((sum, account) => sum + account.saldo, 0)
  const selectedAccount = accountId ? accountBalances.find((account) => account.id === accountId) : null

  return (
    <section data-web-movimientos-workspace="true" className="mx-auto w-full max-w-[1240px]">
      <style>{`
        .web-mov-layout { display:grid; grid-template-columns:minmax(0, 880px) minmax(250px, 280px); gap:24px; align-items:start; }
        @media (max-width: 1100px) {
          .web-mov-layout { grid-template-columns:minmax(0, 1fr); }
          .web-account-rail { order:1; display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:8px; }
          .web-mov-ledger { order:2; }
          .web-mov-context-heading { grid-column:1/-1; }
        }
        @media (max-width: 680px) {
          .web-mov-toolbar { grid-template-columns:1fr !important; }
          .web-mov-header { align-items:flex-start !important; }
          .web-account-rail { display:flex !important; overflow-x:auto; align-items:stretch; gap:6px; padding:8px !important; scrollbar-width:none; }
          .web-account-rail::-webkit-scrollbar { display:none; }
          .web-mov-context-heading { display:none !important; }
          .web-account-option { min-width:220px; margin-top:0 !important; }
          .web-account-admin { min-width:156px; margin-top:0 !important; border-top:0 !important; border-left:1px solid rgba(33,120,168,.08); padding-top:0 !important; }
        }
      `}</style>

      <header className="web-mov-header mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[26px] font-bold tracking-[-0.035em] text-text-primary">Movimientos</h1>
          <p className="mb-0 mt-1.5 text-[13px] text-text-dim">Todo lo que entró, salió o cambió de lugar.</p>
        </div>
        <HomePlusButton accounts={accounts} cards={cards} currency={viewCurrency} month={selectedMonth} label="Nuevo movimiento" />
      </header>

      <div className="web-mov-toolbar mb-5 grid grid-cols-[minmax(220px,1fr)_180px] gap-2 rounded-[12px] border border-primary/[0.09] bg-white p-2 shadow-[0_1px_3px_rgba(13,24,41,0.03)]">
        <label className="flex h-9 items-center gap-2 rounded-[9px] bg-bg-secondary px-3">
          <MagnifyingGlass size={15} className="shrink-0 text-text-dim" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar descripción, categoría o cuenta…"
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-text-primary outline-none placeholder:text-text-disabled"
          />
        </label>
        <select
          value={type}
          onChange={(event) => setType(event.target.value as WebMovementType)}
          aria-label="Filtrar por tipo"
          className="h-9 rounded-[9px] border border-primary/[0.10] bg-white px-3 text-[12px] font-semibold text-text-secondary outline-none"
        >
          {TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      <div className="web-mov-layout">
        <main data-web-movement-ledger="true" className="web-mov-ledger min-w-0 overflow-hidden rounded-[14px] border border-primary/[0.09] bg-white shadow-[0_1px_4px_rgba(13,24,41,0.04)]">
          <div className="flex items-center justify-between gap-4 border-b border-primary/[0.08] px-5 py-3">
            <div className="min-w-0">
              <div className="truncate text-[12px] font-semibold text-text-primary">{selectedAccount?.name ?? 'Todas las cuentas'}</div>
              <div className="mt-0.5 text-[11px] text-text-dim">{filteredRows.length} movimiento{filteredRows.length === 1 ? '' : 's'} en el período</div>
            </div>
            {(query || type !== 'all' || accountId) && (
              <button type="button" onClick={() => { setQuery(''); setType('all'); setAccountId(null) }} className="shrink-0 text-[11px] font-semibold text-primary">Limpiar filtros</button>
            )}
          </div>

          {loading ? (
            <div className="space-y-1 p-5">{Array.from({ length: 7 }, (_, index) => <div key={index} className="skeleton h-[52px] rounded-[8px]" />)}</div>
          ) : failed ? (
            <div className="px-6 py-14 text-center"><div className="text-[14px] font-semibold text-text-primary">No pudimos cargar los movimientos</div><p className="mb-0 mt-2 text-[12px] text-text-dim">Recargá la página para volver a intentarlo.</p></div>
          ) : groups.length === 0 ? (
            <div className="px-6 py-14 text-center"><div className="text-[14px] font-semibold text-text-primary">No encontramos movimientos</div><p className="mb-0 mt-2 text-[12px] text-text-dim">Probá otra cuenta o limpiá los filtros.</p></div>
          ) : (
            groups.map((group) => (
              <section key={group.date}>
                <div className="border-b border-primary/[0.07] bg-bg-secondary/70 px-5 py-2 text-[10px] font-bold uppercase tracking-[0.07em] text-text-dim">{group.label}</div>
                {group.rows.map((row) => {
                  const selected = row.id === selectedRowId
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelectedRowId(row.id)}
                      className={`flex w-full items-center gap-3 border-b border-primary/[0.07] px-5 py-3 text-left transition-colors last:border-b-0 hover:bg-primary/[0.025] ${selected ? 'bg-primary/[0.055]' : 'bg-white'}`}
                    >
                      <RowIcon row={row} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-text-primary">{row.title}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-text-dim">{row.secondary}</span>
                      </span>
                      <span className={`shrink-0 text-right text-[13px] font-bold tabular-nums ${row.tone === 'income' || row.tone === 'yield' ? 'text-success' : 'text-text-primary'}`}>{signedAmountLabel(row, hidden)}</span>
                      <CaretRight size={13} className="shrink-0 text-text-disabled" />
                    </button>
                  )
                })}
              </section>
            ))
          )}
        </main>

        {selectedRow ? (
          <MovementDetail row={selectedRow} hidden={hidden} onClose={() => setSelectedRowId(null)} />
        ) : (
          <aside data-web-account-context="true" className="web-mov-context web-account-rail rounded-[14px] border border-primary/[0.09] bg-white p-3 shadow-[0_1px_4px_rgba(13,24,41,0.04)]">
            <div className="web-mov-context-heading flex items-center justify-between px-2 pb-2 pt-1">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.09em] text-text-dim">Cuentas</div>
                <div className="mt-1 text-[11px] text-text-dim">Contexto del ledger</div>
              </div>
              <Wallet size={17} className="text-primary" />
            </div>

            <button type="button" onClick={() => setAccountId(null)} className={`web-account-option mt-1 flex w-full items-center gap-3 rounded-[10px] px-3 py-3 text-left ${accountId === null ? 'bg-primary/[0.08]' : 'hover:bg-bg-secondary'}`}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-primary/[0.10] text-primary"><Wallet size={16} /></span>
              <span className="min-w-0 flex-1"><span className="block text-[12px] font-semibold text-text-primary">Todas las cuentas</span><span className="mt-0.5 block text-[10px] text-text-dim">{rows.length} movimientos</span></span>
              <span className="shrink-0 text-[12px] font-bold tabular-nums text-text-primary">{hidden ? '••••' : formatAmount(totalBalance, viewCurrency)}</span>
            </button>

            {accountBalances.map((account) => (
              <button key={account.id} type="button" onClick={() => setAccountId(account.id)} className={`web-account-option mt-1 flex w-full items-center gap-3 rounded-[10px] px-3 py-3 text-left ${accountId === account.id ? 'bg-primary/[0.08]' : 'hover:bg-bg-secondary'}`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-ocean/[0.09] text-[12px] font-bold text-ocean">{account.name.charAt(0).toUpperCase()}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-semibold text-text-primary">{account.name}</span><span className="mt-0.5 block truncate text-[10px] text-text-dim">{accountTypeLabel(account.type)}{account.is_primary ? ' · principal' : ''} · {activityCounts[account.id] ?? 0} mov.</span></span>
                <span className="shrink-0 text-[12px] font-bold tabular-nums text-text-primary">{hidden ? '••••' : formatAmount(account.saldo, viewCurrency)}</span>
              </button>
            ))}

            <button type="button" onClick={onOpenSettings} className="web-account-admin mt-3 flex w-full items-center justify-center gap-2 border-t border-primary/[0.08] px-3 pt-3 text-[11px] font-semibold text-primary">
              <CreditCard size={13} /> Administrar cuentas
            </button>
          </aside>
        )}
      </div>
    </section>
  )
}
