import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMonth, addMonths } from '@/lib/dates'
import { FF_YIELD } from '@/lib/flags'
import { todayAR, toDateOnly } from '@/lib/format'
import { isCardPayment, isCreditAccruedExpense, isPerceivedExpense } from '@/lib/movement-classification'
import { MovimientosClient, type ApiResponse } from '@/components/movimientos/MovimientosClient'
import type { Account, Card, Expense, IncomeEntry, Transfer, YieldAccumulator } from '@/types/database'

const PAGE_SIZE = 20

type ApiMovement =
  | { kind: 'expense';  data: Expense }
  | { kind: 'income';   data: IncomeEntry }
  | { kind: 'transfer'; data: Transfer }
  | { kind: 'yield';    data: YieldAccumulator & { accountName: string } }

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { month } = await searchParams
  const initialMonth = month ?? getCurrentMonth()
  const startOfMonth = initialMonth + '-01'
  const endOfMonth   = addMonths(initialMonth, 1) + '-01'

  const [
    { data: expensesData },
    { data: incomeData },
    { data: transfersData },
    { data: yieldData },
    { data: accountsData },
    { data: cardsData },
    { data: statsExpensesData },
    { data: allCatsData },
  ] = await Promise.all([
    supabase.from('expenses').select('*').eq('user_id', user.id)
      .gte('date', startOfMonth).lt('date', endOfMonth)
      .order('date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('income_entries').select('*').eq('user_id', user.id)
      .gte('date', startOfMonth).lt('date', endOfMonth)
      .order('date', { ascending: false }),
    supabase.from('transfers').select('*').eq('user_id', user.id)
      .gte('date', startOfMonth).lt('date', endOfMonth)
      .order('date', { ascending: false }),
    FF_YIELD
      ? supabase.from('yield_accumulator').select('*').eq('user_id', user.id).eq('month', initialMonth)
      : Promise.resolve({ data: [] as YieldAccumulator[], error: null }),
    supabase.from('accounts').select('*').eq('user_id', user.id).eq('archived', false),
    supabase.from('cards').select('*').eq('user_id', user.id).eq('archived', false),
    supabase.from('expenses').select('amount, currency, payment_method, category')
      .eq('user_id', user.id).gte('date', startOfMonth).lt('date', endOfMonth),
    supabase.from('expenses').select('category')
      .eq('user_id', user.id).gte('date', startOfMonth).lt('date', endOfMonth),
  ])

  const accounts   = (accountsData  ?? []) as Account[]
  const cards      = (cardsData     ?? []) as Card[]
  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]))

  // Stats
  const statsExpenses = (statsExpensesData ?? []) as Pick<Expense, 'amount' | 'currency' | 'payment_method' | 'category'>[]
  const statsCurrency: 'ARS' | 'USD' = 'ARS'
  const percibidos  = statsExpenses.filter((e) => isPerceivedExpense(e)       && e.currency === statsCurrency).reduce((s, e) => s + e.amount, 0)
  const tarjeta     = statsExpenses.filter((e) => isCreditAccruedExpense(e)   && e.currency === statsCurrency).reduce((s, e) => s + e.amount, 0)
  const pagoTarjeta = statsExpenses.filter((e) => isCardPayment(e)            && e.currency === statsCurrency).reduce((s, e) => s + e.amount, 0)

  // Categories
  const categories = [...new Set((allCatsData ?? []).map((e: { category: string }) => e.category))].sort()

  // Build & sort movements
  const allExpenses  = (expensesData  ?? []) as Expense[]
  const allIncome    = (incomeData    ?? []) as IncomeEntry[]
  const allTransfers = (transfersData ?? []) as Transfer[]
  const allYield     = (yieldData     ?? []) as YieldAccumulator[]
  const todayStr     = todayAR()

  const allMovements: ApiMovement[] = [
    ...allYield.map((ya) => ({ kind: 'yield'     as const, data: { ...ya, accountName: accountMap[ya.account_id] ?? 'Cuenta' } })),
    ...allIncome.map((e)  => ({ kind: 'income'   as const, data: e })),
    ...allTransfers.map((t) => ({ kind: 'transfer' as const, data: t })),
    ...allExpenses.map((e) => ({ kind: 'expense'  as const, data: e })),
  ].sort((a, b) => {
    const dateA   = a.kind === 'yield' ? toDateOnly(a.data.last_accrued_date ?? a.data.created_at) : toDateOnly(a.data.date)
    const dateB   = b.kind === 'yield' ? toDateOnly(b.data.last_accrued_date ?? b.data.created_at) : toDateOnly(b.data.date)
    const aFuture = dateA > todayStr
    const bFuture = dateB > todayStr
    if (aFuture !== bFuture) return aFuture ? 1 : -1
    if (dateB !== dateA) return dateB.localeCompare(dateA)
    const caA = a.kind !== 'yield' ? a.data.created_at : ''
    const caB = b.kind !== 'yield' ? b.data.created_at : ''
    return caB.localeCompare(caA)
  })

  const filteredSum = allExpenses.filter((e) => e.currency === statsCurrency).reduce((s, e) => s + e.amount, 0)

  const initialData: ApiResponse = {
    movements:           allMovements.slice(0, PAGE_SIZE),
    stats:               { percibidos, tarjeta, pagoTarjeta },
    total:               allMovements.length,
    categories,
    accounts,
    cards,
    filteredSum,
    filteredSumCurrency: statsCurrency,
    statsCurrency,
  }

  return <MovimientosClient initialMonth={initialMonth} initialData={initialData} />
}
