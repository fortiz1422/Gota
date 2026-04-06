import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMonth, addMonths } from '@/lib/dates'
import { FF_YIELD } from '@/lib/flags'
import { todayAR, toDateOnly } from '@/lib/format'
import type { Account, Card, Expense, IncomeEntry, Transfer, YieldAccumulator } from '@/types/database'

const PAGE_SIZE = 20

type MovementType = 'all' | 'gastos' | 'ingresos' | 'tarjeta' | 'transferencias'

type ApiMovement =
  | { kind: 'expense'; data: Expense }
  | { kind: 'income'; data: IncomeEntry }
  | { kind: 'transfer'; data: Transfer }
  | { kind: 'yield'; data: YieldAccumulator & { accountName: string } }

function getMovementDate(mv: ApiMovement): string {
  if (mv.kind === 'yield') {
    return toDateOnly(mv.data.last_accrued_date ?? mv.data.created_at)
  }
  return toDateOnly(mv.data.date)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const monthParam = searchParams.get('month')
  const typeParam = (searchParams.get('type') ?? 'all') as MovementType
  const categoriesParam = searchParams.get('categories') ?? ''
  const pageParam = parseInt(searchParams.get('page') ?? '1', 10)
  const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const selectedMonth = monthParam ?? getCurrentMonth()
  const startOfMonth = selectedMonth + '-01'
  const endOfMonth = addMonths(selectedMonth, 1) + '-01'

  const selectedCategories = categoriesParam
    ? categoriesParam.split(',').map((c) => c.trim()).filter(Boolean)
    : []

  const [
    { data: expensesData },
    { data: incomeData },
    { data: transfersData },
    { data: yieldData },
    { data: accountsData },
    { data: cardsData },
  ] = await Promise.all([
    typeParam === 'ingresos' || typeParam === 'transferencias'
      ? Promise.resolve({ data: [] as Expense[] })
      : supabase
          .from('expenses')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', startOfMonth)
          .lt('date', endOfMonth)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false }),

    typeParam === 'gastos' || typeParam === 'tarjeta' || typeParam === 'transferencias'
      ? Promise.resolve({ data: [] as IncomeEntry[] })
      : supabase
          .from('income_entries')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', startOfMonth)
          .lt('date', endOfMonth)
          .order('date', { ascending: false }),

    typeParam === 'gastos' || typeParam === 'tarjeta' || typeParam === 'ingresos'
      ? Promise.resolve({ data: [] as Transfer[] })
      : supabase
          .from('transfers')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', startOfMonth)
          .lt('date', endOfMonth)
          .order('date', { ascending: false }),

    FF_YIELD && page === 1 && (typeParam === 'all' || typeParam === 'ingresos')
      ? supabase
          .from('yield_accumulator')
          .select('*')
          .eq('user_id', user.id)
          .eq('month', selectedMonth)
      : Promise.resolve({ data: [] as YieldAccumulator[] }),

    supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('archived', false),

    supabase
      .from('cards')
      .select('*')
      .eq('user_id', user.id)
      .eq('archived', false),
  ])

  const accounts = (accountsData ?? []) as Account[]
  const cards = (cardsData ?? []) as Card[]
  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]))

  const allExpenses = (expensesData ?? []) as Expense[]
  const allIncome = (incomeData ?? []) as IncomeEntry[]
  const allTransfers = (transfersData ?? []) as Transfer[]
  const allYield = (yieldData ?? []) as YieldAccumulator[]

  const { data: statsExpensesData } = await supabase
    .from('expenses')
    .select('amount, currency, payment_method, category')
    .eq('user_id', user.id)
    .gte('date', startOfMonth)
    .lt('date', endOfMonth)

  const statsExpenses = (statsExpensesData ?? []) as Pick<Expense, 'amount' | 'currency' | 'payment_method' | 'category'>[]

  const percibidos = statsExpenses
    .filter((e) => e.currency === 'ARS')
    .reduce((sum, e) => {
      if (e.category === 'Pago de Tarjetas') return sum + e.amount
      if (e.payment_method !== 'CREDIT') return sum + e.amount
      return sum
    }, 0)

  const tarjeta = statsExpenses
    .filter((e) => e.payment_method === 'CREDIT' && e.category !== 'Pago de Tarjetas' && e.currency === 'ARS')
    .reduce((sum, e) => sum + e.amount, 0)

  const pagoTarjeta = statsExpenses
    .filter((e) => e.category === 'Pago de Tarjetas' && e.currency === 'ARS')
    .reduce((sum, e) => sum + e.amount, 0)

  const { data: allCatsData } = await supabase
    .from('expenses')
    .select('category')
    .eq('user_id', user.id)
    .gte('date', startOfMonth)
    .lt('date', endOfMonth)

  const categories = [...new Set((allCatsData ?? []).map((e: { category: string }) => e.category))].sort()

  let filteredExpenses = allExpenses
  if (typeParam === 'tarjeta') {
    filteredExpenses = allExpenses.filter((e) => e.payment_method === 'CREDIT' && e.category !== 'Pago de Tarjetas')
  } else if (typeParam === 'gastos') {
    filteredExpenses = allExpenses.filter((e) => e.category !== 'Pago de Tarjetas' || e.payment_method !== 'CREDIT')
  }

  if (selectedCategories.length > 0) {
    filteredExpenses = filteredExpenses.filter((e) => selectedCategories.includes(e.category))
  }

  const yieldMovements: ApiMovement[] = allYield.map((ya) => ({
    kind: 'yield' as const,
    data: { ...ya, accountName: accountMap[ya.account_id] ?? 'Cuenta' },
  }))

  const incomeMovements: ApiMovement[] = allIncome.map((e) => ({ kind: 'income' as const, data: e }))
  const transferMovements: ApiMovement[] = allTransfers.map((t) => ({ kind: 'transfer' as const, data: t }))
  const expenseMovements: ApiMovement[] = filteredExpenses.map((e) => ({ kind: 'expense' as const, data: e }))

  const todayStr = todayAR()

  const allMovements: ApiMovement[] = [
    ...(page === 1 ? yieldMovements : []),
    ...incomeMovements,
    ...transferMovements,
    ...expenseMovements,
  ].sort((a, b) => {
    const dateA = getMovementDate(a)
    const dateB = getMovementDate(b)
    const aFuture = dateA > todayStr
    const bFuture = dateB > todayStr
    if (aFuture !== bFuture) return aFuture ? 1 : -1
    if (dateB !== dateA) return dateB.localeCompare(dateA)
    const caA = a.kind !== 'yield' ? a.data.created_at : ''
    const caB = b.kind !== 'yield' ? b.data.created_at : ''
    return caB.localeCompare(caA)
  })

  const total = allMovements.length
  const offset = (page - 1) * PAGE_SIZE
  const movements = allMovements.slice(offset, offset + PAGE_SIZE)

  return NextResponse.json({
    movements,
    stats: { percibidos, tarjeta, pagoTarjeta },
    total,
    categories,
    accounts,
    cards,
  })
}
