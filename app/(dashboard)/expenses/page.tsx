import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react/dist/ssr'
import { ExpenseItem } from '@/components/expenses/ExpenseItem'
import { IncomeItem } from '@/components/expenses/IncomeItem'
import { TransferItem } from '@/components/expenses/TransferItem'
import { ExpenseFilters } from '@/components/expenses/ExpenseFilters'
import type { Account, Card, Expense, IncomeEntry, Transfer } from '@/types/database'

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string
    category?: string
    payment_method?: string
    page?: string
  }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const currentMonth = getCurrentMonth()
  const month = params.month ?? currentMonth
  const category = params.category ?? ''
  const paymentMethod = params.payment_method ?? ''
  const page = Math.max(1, parseInt(params.page ?? '1'))
  const pageSize = 20
  const offset = (page - 1) * pageSize

  const [y, m] = month.split('-').map(Number)
  const nextMonthDate = new Date(y, m, 1).toISOString().split('T')[0]

  const [{ data: config }, incomeResult, transfersResult, accountsResult, expensesResult] = await Promise.all([
    supabase.from('user_config').select('cards').eq('user_id', user.id).single(),
    supabase
      .from('income_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', `${month}-01`)
      .lt('date', nextMonthDate)
      .order('date', { ascending: false }),
    supabase
      .from('transfers')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', `${month}-01`)
      .lt('date', nextMonthDate)
      .order('date', { ascending: false }),
    supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('archived', false),
    (() => {
      let q = supabase
        .from('expenses')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .gte('date', `${month}-01`)
        .lt('date', nextMonthDate)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1)
      if (category) q = q.eq('category', category)
      if (paymentMethod)
        q = q.eq('payment_method', paymentMethod as 'CASH' | 'DEBIT' | 'TRANSFER' | 'CREDIT')
      return q
    })(),
  ])

  const cards: Card[] = ((config?.cards as Card[]) ?? []).filter((c: Card) => !c.archived)
  const incomeEntries = (incomeResult.data ?? []) as IncomeEntry[]
  const transfers = (transfersResult.data ?? []) as Transfer[]
  const accounts = (accountsResult.data ?? []) as Account[]
  const expenses = (expensesResult.data ?? []) as Expense[]
  const total = expensesResult.count ?? 0
  const totalPages = Math.ceil(total / pageSize)

  // Income and transfers always show on page 1 (filters apply to expenses only)
  type Row =
    | { kind: 'income'; data: IncomeEntry }
    | { kind: 'transfer'; data: Transfer }
    | { kind: 'expense'; data: Expense }

  const rows: Row[] = [
    ...(page === 1 ? incomeEntries.map((e) => ({ kind: 'income' as const, data: e })) : []),
    ...(page === 1 ? transfers.map((t) => ({ kind: 'transfer' as const, data: t })) : []),
    ...expenses.map((e) => ({ kind: 'expense' as const, data: e })),
  ].sort((a, b) => b.data.date.localeCompare(a.data.date))

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="mx-auto max-w-md px-4 pb-6 pt-safe">
        {/* Header */}
        <div className="mb-4 flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-primary/5"
            aria-label="Volver"
          >
            <CaretLeft size={20} />
          </Link>
          <h1 className="text-base font-semibold text-text-primary">Movimientos</h1>
        </div>

        {/* Filters */}
        <div className="mb-4 rounded-card border border-border-ocean bg-bg-secondary p-4">
          <Suspense fallback={null}>
            <ExpenseFilters month={month} category={category} paymentMethod={paymentMethod} />
          </Suspense>
        </div>

        {/* Results count */}
        {total > 0 && (
          <p className="mb-3 text-xs text-text-tertiary">
            {total} gasto{total !== 1 ? 's' : ''}
            {page === 1 && transfers.length > 0 && ` · ${transfers.length} transferencia${transfers.length !== 1 ? 's' : ''}`}
          </p>
        )}

        {/* Merged movement list */}
        {rows.length > 0 ? (
          <div className="space-y-2">
            {rows.map((row) => {
              if (row.kind === 'income') return <IncomeItem key={`i-${row.data.id}`} entry={row.data} />
              if (row.kind === 'transfer') return <TransferItem key={`t-${row.data.id}`} transfer={row.data} accounts={accounts} />
              return <ExpenseItem key={`e-${row.data.id}`} expense={row.data} cards={cards} />
            })}
          </div>
        ) : (
          <div className="rounded-card bg-bg-secondary px-4 py-10 text-center">
            <p className="mb-1 text-2xl">📭</p>
            <p className="text-sm font-medium text-text-secondary">
              {category || paymentMethod
                ? 'Sin gastos con estos filtros'
                : 'Sin movimientos este mes'}
            </p>
            {!category && !paymentMethod && (
              <p className="mt-1 text-xs text-text-tertiary">Registrá gastos desde Home</p>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-4">
            {page > 1 ? (
              <Link
                href={`/expenses?${new URLSearchParams({
                  ...(month !== currentMonth ? { month } : {}),
                  ...(category ? { category } : {}),
                  ...(paymentMethod ? { payment_method: paymentMethod } : {}),
                  page: String(page - 1),
                }).toString()}`}
                className="flex items-center gap-1.5 rounded-button border border-border-ocean bg-bg-secondary px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-primary/5"
              >
                <CaretLeft size={14} />
                Anterior
              </Link>
            ) : (
              <div />
            )}
            <span className="text-sm text-text-tertiary">
              {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={`/expenses?${new URLSearchParams({
                  ...(month !== currentMonth ? { month } : {}),
                  ...(category ? { category } : {}),
                  ...(paymentMethod ? { payment_method: paymentMethod } : {}),
                  page: String(page + 1),
                }).toString()}`}
                className="flex items-center gap-1.5 rounded-button border border-border-ocean bg-bg-secondary px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-primary/5"
              >
                Siguiente
                <CaretRight size={14} />
              </Link>
            ) : (
              <div />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
