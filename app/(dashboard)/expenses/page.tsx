import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ExpenseItem } from '@/components/expenses/ExpenseItem'
import { IncomeItem } from '@/components/expenses/IncomeItem'
import { ExpenseFilters } from '@/components/expenses/ExpenseFilters'
import type { Card, Expense, IncomeEntry } from '@/types/database'

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

  const [{ data: config }, incomeResult, expensesResult] = await Promise.all([
    supabase.from('user_config').select('cards').eq('user_id', user.id).single(),
    supabase
      .from('income_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', `${month}-01`)
      .lt('date', nextMonthDate)
      .order('date', { ascending: false }),
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
  const expenses = (expensesResult.data ?? []) as Expense[]
  const total = expensesResult.count ?? 0
  const totalPages = Math.ceil(total / pageSize)

  // Only show income entries on first page when no filters active
  const showIncome = page === 1 && !category && !paymentMethod && incomeEntries.length > 0

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
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-base font-semibold text-text-primary">Movimientos</h1>
        </div>

        {/* Filters */}
        <div className="mb-4 rounded-card border border-border-ocean bg-bg-secondary p-4">
          <Suspense fallback={null}>
            <ExpenseFilters month={month} category={category} paymentMethod={paymentMethod} />
          </Suspense>
        </div>

        {/* Income entries */}
        {showIncome && (
          <div className="mb-4 space-y-2">
            {incomeEntries.map((entry) => (
              <IncomeItem key={entry.id} entry={entry} />
            ))}
          </div>
        )}

        {/* Results count */}
        {total > 0 && (
          <p className="mb-3 text-xs text-text-tertiary">
            {total} gasto{total !== 1 ? 's' : ''}
          </p>
        )}

        {/* Expense list */}
        {expenses.length > 0 ? (
          <div className="space-y-2">
            {expenses.map((expense) => (
              <ExpenseItem key={expense.id} expense={expense} cards={cards} />
            ))}
          </div>
        ) : (
          <div className="rounded-card bg-bg-secondary px-4 py-10 text-center">
            <p className="mb-1 text-2xl">📭</p>
            <p className="text-sm font-medium text-text-secondary">
              {category || paymentMethod
                ? 'Sin gastos con estos filtros'
                : 'Sin gastos este mes'}
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
                <ChevronLeft size={14} />
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
                <ChevronRight size={14} />
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
