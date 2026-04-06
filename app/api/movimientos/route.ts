import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMonth, addMonths } from '@/lib/dates'
import { FF_YIELD } from '@/lib/flags'
import { todayAR, toDateOnly } from '@/lib/format'
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
  if (mv.kind === 'yield') {
    return toDateOnly(mv.data.last_accrued_date ?? mv.data.created_at)
  }
  return toDateOnly(mv.data.date)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const monthParam = searchParams.get('month')
  const pageParam = parseInt(searchParams.get('page') ?? '1', 10)
  const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam

  // New filter params
  const tiposParam = searchParams.get('tipos') ?? ''
  const origenesParam = searchParams.get('origenes') ?? ''
  const cuentasParam = searchParams.get('cuentas') ?? ''
  const categoriasParam = searchParams.get('categorias') ?? ''
  const monedasParam = searchParams.get('monedas') ?? ''

  const tipos = tiposParam ? (tiposParam.split(',').filter(Boolean) as TipoFilter[]) : []
  const origenes = origenesParam ? (origenesParam.split(',').filter(Boolean) as OrigenFilter[]) : []
  const cuentas = cuentasParam ? cuentasParam.split(',').filter(Boolean) : []
  const categorias = categoriasParam ? categoriasParam.split(',').filter(Boolean) : []
  const monedas = monedasParam ? (monedasParam.split(',').filter(Boolean) as MonedaFilter[]) : []

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const selectedMonth = monthParam ?? getCurrentMonth()
  const startOfMonth = selectedMonth + '-01'
  const endOfMonth = addMonths(selectedMonth, 1) + '-01'

  // Determine which collections to fetch
  const wantsExpenses =
    tipos.length === 0 || tipos.some((t) => t === 'gasto' || t === 'suscripcion')
  const wantsIncome = tipos.length === 0 || tipos.includes('ingreso')
  const wantsTransfers = tipos.length === 0 || tipos.includes('transferencia')

  // Fetch all data in parallel
  const [
    { data: expensesData },
    { data: incomeData },
    { data: transfersData },
    { data: yieldData },
    { data: accountsData },
    { data: cardsData },
  ] = await Promise.all([
    wantsExpenses
      ? supabase
          .from('expenses')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', startOfMonth)
          .lt('date', endOfMonth)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as Expense[] }),

    wantsIncome
      ? supabase
          .from('income_entries')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', startOfMonth)
          .lt('date', endOfMonth)
          .order('date', { ascending: false })
      : Promise.resolve({ data: [] as IncomeEntry[] }),

    wantsTransfers
      ? supabase
          .from('transfers')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', startOfMonth)
          .lt('date', endOfMonth)
          .order('date', { ascending: false })
      : Promise.resolve({ data: [] as Transfer[] }),

    // Yield (only for page 1, when income is visible)
    FF_YIELD && page === 1 && wantsIncome
      ? supabase
          .from('yield_accumulator')
          .select('*')
          .eq('user_id', user.id)
          .eq('month', selectedMonth)
      : Promise.resolve({ data: [] as YieldAccumulator[] }),

    supabase.from('accounts').select('*').eq('user_id', user.id).eq('archived', false),

    supabase.from('cards').select('*').eq('user_id', user.id).eq('archived', false),
  ])

  const accounts = (accountsData ?? []) as Account[]
  const cards = (cardsData ?? []) as Card[]
  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.name]))
  // card_id → account_id, for resolving credit card expenses to their linked account
  const cardAccountMap = Object.fromEntries(
    cards.filter((c) => c.account_id).map((c) => [c.id, c.account_id as string])
  )

  const allExpenses = (expensesData ?? []) as Expense[]
  const allIncome = (incomeData ?? []) as IncomeEntry[]
  const allTransfers = (transfersData ?? []) as Transfer[]
  const allYield = (yieldData ?? []) as YieldAccumulator[]

  // ──────────────────────────────────────────
  // Stats (always from full expense set)
  // ──────────────────────────────────────────
  const { data: statsExpensesData } = await supabase
    .from('expenses')
    .select('amount, currency, payment_method, category')
    .eq('user_id', user.id)
    .gte('date', startOfMonth)
    .lt('date', endOfMonth)

  const statsExpenses = (statsExpensesData ?? []) as Pick<
    Expense,
    'amount' | 'currency' | 'payment_method' | 'category'
  >[]

  const percibidos = statsExpenses
    .filter((e) => e.currency === 'ARS')
    .reduce((sum, e) => {
      if (e.category === 'Pago de Tarjetas') return sum + e.amount
      if (e.payment_method !== 'CREDIT') return sum + e.amount
      return sum
    }, 0)

  const tarjeta = statsExpenses
    .filter(
      (e) =>
        e.payment_method === 'CREDIT' &&
        e.category !== 'Pago de Tarjetas' &&
        e.currency === 'ARS'
    )
    .reduce((sum, e) => sum + e.amount, 0)

  const pagoTarjeta = statsExpenses
    .filter((e) => e.category === 'Pago de Tarjetas' && e.currency === 'ARS')
    .reduce((sum, e) => sum + e.amount, 0)

  // ──────────────────────────────────────────
  // Available categories (for filter UI)
  // ──────────────────────────────────────────
  const { data: allCatsData } = await supabase
    .from('expenses')
    .select('category')
    .eq('user_id', user.id)
    .gte('date', startOfMonth)
    .lt('date', endOfMonth)

  const categories = [
    ...new Set((allCatsData ?? []).map((e: { category: string }) => e.category)),
  ].sort()

  // ──────────────────────────────────────────
  // Filter expenses
  // ──────────────────────────────────────────
  let filteredExpenses = allExpenses

  // Tipo: gasto vs suscripcion
  const wantsGasto = tipos.length === 0 || tipos.includes('gasto')
  const wantsSuscripcion = tipos.length === 0 || tipos.includes('suscripcion')
  if (wantsGasto && !wantsSuscripcion) {
    filteredExpenses = filteredExpenses.filter((e) => !e.subscription_id)
  } else if (!wantsGasto && wantsSuscripcion) {
    filteredExpenses = filteredExpenses.filter((e) => !!e.subscription_id)
  }

  // Origen: percibido / tarjeta / pago_tarjeta
  if (origenes.length > 0) {
    filteredExpenses = filteredExpenses.filter((e) => {
      if (
        origenes.includes('percibido') &&
        e.payment_method !== 'CREDIT' &&
        e.category !== 'Pago de Tarjetas'
      )
        return true
      if (
        origenes.includes('tarjeta') &&
        e.payment_method === 'CREDIT' &&
        e.category !== 'Pago de Tarjetas'
      )
        return true
      if (origenes.includes('pago_tarjeta') && e.category === 'Pago de Tarjetas') return true
      return false
    })
  }

  // Moneda
  if (monedas.length > 0) {
    filteredExpenses = filteredExpenses.filter((e) => monedas.includes(e.currency))
  }

  // Cuenta — match via account_id directly, or via card's linked account for credit expenses
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

  // Categoría
  if (categorias.length > 0) {
    filteredExpenses = filteredExpenses.filter((e) => categorias.includes(e.category))
  }

  // ──────────────────────────────────────────
  // Filter income
  // ──────────────────────────────────────────
  let filteredIncome = allIncome

  if (monedas.length > 0) {
    filteredIncome = filteredIncome.filter((e) => monedas.includes(e.currency))
  }
  if (cuentas.length > 0) {
    filteredIncome = filteredIncome.filter(
      (e) => e.account_id != null && cuentas.includes(e.account_id)
    )
  }

  // ──────────────────────────────────────────
  // Filter transfers
  // ──────────────────────────────────────────
  let filteredTransfers = allTransfers

  if (monedas.length > 0) {
    filteredTransfers = filteredTransfers.filter(
      (t) => monedas.includes(t.currency_from) || monedas.includes(t.currency_to)
    )
  }
  if (cuentas.length > 0) {
    filteredTransfers = filteredTransfers.filter(
      (t) => cuentas.includes(t.from_account_id) || cuentas.includes(t.to_account_id)
    )
  }

  // Origen is an expense-only concept — income and transfers have no origen,
  // so they cannot satisfy an origen filter
  if (origenes.length > 0) {
    filteredIncome = []
    filteredTransfers = []
  }

  // ──────────────────────────────────────────
  // Build movements list
  // ──────────────────────────────────────────
  const yieldMovements: ApiMovement[] = allYield.map((ya) => ({
    kind: 'yield' as const,
    data: { ...ya, accountName: accountMap[ya.account_id] ?? 'Cuenta' },
  }))

  const incomeMovements: ApiMovement[] = filteredIncome.map((e) => ({
    kind: 'income' as const,
    data: e,
  }))
  const transferMovements: ApiMovement[] = filteredTransfers.map((t) => ({
    kind: 'transfer' as const,
    data: t,
  }))
  const expenseMovements: ApiMovement[] = filteredExpenses.map((e) => ({
    kind: 'expense' as const,
    data: e,
  }))

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

  // ──────────────────────────────────────────
  // Filtered sum for the filter row display
  // ──────────────────────────────────────────
  const sumCurrency: 'ARS' | 'USD' =
    monedas.length === 1 && monedas[0] === 'USD' ? 'USD' : 'ARS'

  const expenseAmtTotal = filteredExpenses
    .filter((e) => e.currency === sumCurrency)
    .reduce((s, e) => s + e.amount, 0)

  const incomeAmtTotal = filteredIncome
    .filter((e) => e.currency === sumCurrency)
    .reduce((s, e) => s + e.amount, 0)

  // Net only when tipos explicitly includes ingreso AND no origen filter is active.
  // When tipos=[] (all) or when origenes is set, default to expense-only sum.
  const explicitIncome = tipos.length > 0 && tipos.includes('ingreso') && origenes.length === 0
  const filteredSum = explicitIncome && wantsExpenses
    ? incomeAmtTotal - expenseAmtTotal
    : explicitIncome
      ? incomeAmtTotal
      : expenseAmtTotal

  return NextResponse.json({
    movements,
    stats: { percibidos, tarjeta, pagoTarjeta },
    total,
    categories,
    accounts,
    cards,
    filteredSum,
    filteredSumCurrency: sumCurrency,
  })
}
