import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMonth, addMonths } from '@/lib/dates'
import { FF_YIELD } from '@/lib/flags'
import { todayAR, toDateOnly } from '@/lib/format'
import {
  isCardPayment,
  isCreditAccruedExpense,
  isPerceivedExpense,
} from '@/lib/movement-classification'
import type { Account, Card, Expense, IncomeEntry, Transfer, YieldAccumulator } from '@/types/database'

const PAGE_SIZE = 20

type TipoFilter = 'gasto' | 'ingreso' | 'transferencia' | 'suscripcion'
type OrigenFilter = 'percibido' | 'tarjeta' | 'pago_tarjeta'
type MonedaFilter = 'ARS' | 'USD'

type ApiMovement =
  | { kind: 'expense'; data: Expense }
  | { kind: 'income'; data: IncomeEntry }
  | { kind: 'transfer'; data: Transfer }
  | { kind: 'yield'; data: YieldAccumulator & { accountName: string } }

function getMovementDate(mv: ApiMovement): string {
  if (mv.kind === 'yield') return toDateOnly(mv.data.last_accrued_date ?? mv.data.created_at)
  return toDateOnly(mv.data.date)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const monthParam = searchParams.get('month')
  const pageParam = parseInt(searchParams.get('page') ?? '1', 10)
  const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam

  const tipos = (searchParams.get('tipos') ?? '').split(',').filter(Boolean) as TipoFilter[]
  const origenes = (searchParams.get('origenes') ?? '').split(',').filter(Boolean) as OrigenFilter[]
  const tarjetas = (searchParams.get('tarjetas') ?? '').split(',').filter(Boolean)
  const cuentas = (searchParams.get('cuentas') ?? '').split(',').filter(Boolean)
  const categorias = (searchParams.get('categorias') ?? '').split(',').filter(Boolean)
  const monedas = (searchParams.get('monedas') ?? '').split(',').filter(Boolean) as MonedaFilter[]
  const activeMonedas = monedas.length >= 2 ? [] : monedas
  const quincenaParam = parseInt(searchParams.get('quincena') ?? '0', 10)
  const quincena = quincenaParam === 1 || quincenaParam === 2 ? (quincenaParam as 1 | 2) : null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const selectedMonth = monthParam ?? getCurrentMonth()
  const startOfMonth = selectedMonth + '-01'
  const endOfMonth = addMonths(selectedMonth, 1) + '-01'

  const effectiveStart = quincena === 2 ? selectedMonth + '-16' : startOfMonth
  const effectiveEnd = quincena === 1 ? selectedMonth + '-16' : endOfMonth

  const wantsExpenses = tipos.length === 0 || tipos.some((t) => t === 'gasto' || t === 'suscripcion')
  const wantsIncome = tipos.length === 0 || tipos.includes('ingreso')
  const wantsTransfers = tipos.length === 0 || tipos.includes('transferencia')

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
    wantsExpenses
      ? supabase
          .from('expenses')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', effectiveStart)
          .lt('date', effectiveEnd)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as Expense[] }),

    wantsIncome
      ? supabase
          .from('income_entries')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', effectiveStart)
          .lt('date', effectiveEnd)
          .order('date', { ascending: false })
      : Promise.resolve({ data: [] as IncomeEntry[] }),

    wantsTransfers
      ? supabase
          .from('transfers')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', effectiveStart)
          .lt('date', effectiveEnd)
          .order('date', { ascending: false })
      : Promise.resolve({ data: [] as Transfer[] }),

    FF_YIELD && page === 1 && wantsIncome
      ? supabase.from('yield_accumulator').select('*').eq('user_id', user.id).eq('month', selectedMonth)
      : Promise.resolve({ data: [] as YieldAccumulator[] }),

    supabase.from('accounts').select('*').eq('user_id', user.id).eq('archived', false),
    supabase.from('cards').select('*').eq('user_id', user.id).eq('archived', false),

    supabase
      .from('expenses')
      .select('amount, currency, payment_method, category')
      .eq('user_id', user.id)
      .gte('date', effectiveStart)
      .lt('date', effectiveEnd),

    supabase
      .from('expenses')
      .select('category')
      .eq('user_id', user.id)
      .gte('date', effectiveStart)
      .lt('date', effectiveEnd),
  ])

  const accounts = (accountsData ?? []) as Account[]
  const cards = (cardsData ?? []) as Card[]
  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]))
  const cardAccountMap = Object.fromEntries(
    cards.filter((c) => c.account_id).map((c) => [c.id, c.account_id as string])
  )

  const allExpenses = (expensesData ?? []) as Expense[]
  const allIncome = (incomeData ?? []) as IncomeEntry[]
  const allTransfers = (transfersData ?? []) as Transfer[]
  const allYield = (yieldData ?? []) as YieldAccumulator[]

  const statsExpenses = (statsExpensesData ?? []) as Pick<
    Expense,
    'amount' | 'currency' | 'payment_method' | 'category'
  >[]

  const statsCurrency: 'ARS' | 'USD' =
    activeMonedas.length === 1 && activeMonedas[0] === 'USD' ? 'USD' : 'ARS'

  const percibidos = statsExpenses
    .filter((e) => isPerceivedExpense(e) && e.currency === statsCurrency)
    .reduce((sum, e) => sum + e.amount, 0)

  const tarjeta = statsExpenses
    .filter((e) => isCreditAccruedExpense(e) && e.currency === statsCurrency)
    .reduce((sum, e) => sum + e.amount, 0)

  const pagoTarjeta = statsExpenses
    .filter((e) => isCardPayment(e) && e.currency === statsCurrency)
    .reduce((sum, e) => sum + e.amount, 0)

  const categories = [...new Set((allCatsData ?? []).map((e: { category: string }) => e.category))].sort()

  let filteredExpenses = allExpenses

  const wantsGasto = tipos.length === 0 || tipos.includes('gasto')
  const wantsSuscripcion = tipos.length === 0 || tipos.includes('suscripcion')
  if (wantsGasto && !wantsSuscripcion) {
    filteredExpenses = filteredExpenses.filter((e) => !e.subscription_id)
  } else if (!wantsGasto && wantsSuscripcion) {
    filteredExpenses = filteredExpenses.filter((e) => !!e.subscription_id)
  }

  if (origenes.length > 0) {
    filteredExpenses = filteredExpenses.filter((e) => {
      if (origenes.includes('percibido') && isPerceivedExpense(e)) return true
      if (origenes.includes('tarjeta') && isCreditAccruedExpense(e)) return true
      if (origenes.includes('pago_tarjeta') && isCardPayment(e)) return true
      return false
    })
  }

  if (activeMonedas.length > 0) {
    filteredExpenses = filteredExpenses.filter((e) => activeMonedas.includes(e.currency))
  }

  if (tarjetas.length > 0) {
    filteredExpenses = filteredExpenses.filter((e) => e.card_id != null && tarjetas.includes(e.card_id))
  }

  if (cuentas.length > 0) {
    filteredExpenses = filteredExpenses.filter((e) => {
      if (e.account_id != null && cuentas.includes(e.account_id)) return true
      if (e.card_id != null) {
        const cardAccId = cardAccountMap[e.card_id]
        if (cardAccId != null && cuentas.includes(cardAccId)) return true
      }
      return false
    })
  }

  if (categorias.length > 0) {
    filteredExpenses = filteredExpenses.filter((e) => categorias.includes(e.category))
  }

  let filteredIncome = allIncome
  if (activeMonedas.length > 0) {
    filteredIncome = filteredIncome.filter((e) => activeMonedas.includes(e.currency))
  }
  if (cuentas.length > 0) {
    filteredIncome = filteredIncome.filter((e) => e.account_id != null && cuentas.includes(e.account_id))
  }

  let filteredTransfers = allTransfers
  if (activeMonedas.length > 0) {
    filteredTransfers = filteredTransfers.filter(
      (t) => activeMonedas.includes(t.currency_from) || activeMonedas.includes(t.currency_to)
    )
  }
  if (cuentas.length > 0) {
    filteredTransfers = filteredTransfers.filter(
      (t) => cuentas.includes(t.from_account_id) || cuentas.includes(t.to_account_id)
    )
  }

  if (origenes.length > 0) {
    filteredIncome = []
    filteredTransfers = []
  }

  if (categorias.length > 0) {
    filteredIncome = []
    filteredTransfers = []
  }

  let filteredYield = allYield
  if (origenes.length > 0 || categorias.length > 0 || tarjetas.length > 0) {
    filteredYield = []
  }
  if (cuentas.length > 0) {
    filteredYield = filteredYield.filter((ya) => cuentas.includes(ya.account_id))
  }
  if (activeMonedas.length > 0 && !activeMonedas.includes('ARS')) {
    filteredYield = []
  }
  const yieldMovements: ApiMovement[] = filteredYield.map((ya) => ({
    kind: 'yield' as const,
    data: { ...ya, accountName: accountMap[ya.account_id] ?? 'Cuenta' },
  }))
  const incomeMovements: ApiMovement[] = filteredIncome.map((e) => ({ kind: 'income' as const, data: e }))
  const transferMovements: ApiMovement[] = filteredTransfers.map((t) => ({
    kind: 'transfer' as const,
    data: t,
  }))
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

  const sumCurrency: 'ARS' | 'USD' =
    activeMonedas.length === 1 && activeMonedas[0] === 'USD' ? 'USD' : 'ARS'

  const expenseAmtTotal = filteredExpenses
    .filter((e) => e.currency === sumCurrency)
    .reduce((s, e) => s + e.amount, 0)

  const incomeAmtTotal = filteredIncome
    .filter((e) => e.currency === sumCurrency)
    .reduce((s, e) => s + e.amount, 0)

  const explicitIncome = tipos.length > 0 && tipos.includes('ingreso') && origenes.length === 0
  const filteredSum = explicitIncome && wantsExpenses
    ? incomeAmtTotal - expenseAmtTotal
    : explicitIncome
      ? incomeAmtTotal
      : expenseAmtTotal

  return NextResponse.json({
    movements,
    stats: { percibidos, tarjeta, pagoTarjeta },
    statsCurrency,
    total,
    categories,
    accounts,
    cards,
    filteredSum,
    filteredSumCurrency: sumCurrency,
  })
}
