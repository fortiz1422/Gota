import { countAvailableComparisonMonths } from '@/lib/analytics/analytics-overview'
import { buildMonthlySeries } from '@/lib/analytics/monthly-series'
import { addMonths, getCurrentMonth } from '@/lib/dates'
import { todayAR } from '@/lib/format'
import {
  isApplicableCardPayment,
  isCardPayment,
  isCreditAccruedExpense,
  isPerceivedExpense,
} from '@/lib/movement-classification'
import { getBudgetSnapshot } from '@/lib/server/budget-queries'
import { readDashboardData } from '@/lib/server/dashboard-queries'
import type { createClient } from '@/lib/supabase/server'
import type { BudgetSnapshot } from '@/lib/budgets/types'
import type { Expense, IncomeEntry, Transfer } from '@/types/database'
import { daysInMonthOf } from './evidence'
import type {
  CategoryAggregate,
  Currency,
  FinancialSnapshot,
  MonthAggregate,
  SnapshotAccountBalance,
  SnapshotCardCommitment,
  SnapshotMovement,
  SnapshotSubscription,
} from './types'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type SnapshotExpenseRow = Pick<
  Expense,
  | 'id'
  | 'amount'
  | 'currency'
  | 'category'
  | 'description'
  | 'is_want'
  | 'payment_method'
  | 'is_legacy_card_payment'
  | 'date'
  | 'installment_number'
  | 'installment_total'
>

export type SnapshotIncomeRow = Pick<
  IncomeEntry,
  'id' | 'amount' | 'currency' | 'description' | 'category' | 'date'
>

export type SnapshotTransferRow = Pick<
  Transfer,
  'id' | 'amount_from' | 'amount_to' | 'currency_from' | 'currency_to' | 'date' | 'note'
>

export type SnapshotInputs = {
  today: string
  month: string
  currency: Currency
  saldoVivo: Record<Currency, number>
  disponibleReal: Record<Currency, number>
  accountBalances: SnapshotAccountBalance[]
  budget: BudgetSnapshot
  cards: SnapshotCardCommitment[]
  subscriptions: SnapshotSubscription[]
  goals: { count: number; committed: Record<Currency, number> }
  yieldAccumulated: number
  expenses: SnapshotExpenseRow[]
  incomeEntries: SnapshotIncomeRow[]
  transfers: SnapshotTransferRow[]
  earliestDataMonth: string | null
}

function emptyCurrencyTotals(): Record<Currency, number> {
  return { ARS: 0, USD: 0 }
}

function installmentLabel(expense: SnapshotExpenseRow): string | null {
  if (expense.installment_number && expense.installment_total) {
    return `${expense.installment_number}/${expense.installment_total}`
  }
  return null
}

function buildMonthAggregates(params: {
  expenses: SnapshotExpenseRow[]
  incomeEntries: SnapshotIncomeRow[]
  historyStartMonth: string
  month: string
}): MonthAggregate[] {
  const { expenses, incomeEntries, historyStartMonth, month } = params

  const aggregateMap = new Map<string, MonthAggregate & { categoryMap: Map<string, CategoryAggregate> }>()
  let cursor = historyStartMonth
  while (cursor <= month) {
    aggregateMap.set(cursor, {
      month: cursor,
      income: emptyCurrencyTotals(),
      perceivedSpend: emptyCurrencyTotals(),
      accruedSpend: emptyCurrencyTotals(),
      cardPayments: emptyCurrencyTotals(),
      categories: [],
      categoryMap: new Map(),
    })
    cursor = addMonths(cursor, 1)
  }

  const addCategory = (
    aggregate: { categoryMap: Map<string, CategoryAggregate> },
    category: string,
    amount: number,
    currency: Currency,
  ) => {
    const key = `${currency}:${category}`
    const current = aggregate.categoryMap.get(key) ?? { category, currency, amount: 0, count: 0 }
    current.amount += amount
    current.count += 1
    aggregate.categoryMap.set(key, current)
  }

  for (const income of incomeEntries) {
    const aggregate = aggregateMap.get(income.date.substring(0, 7))
    if (!aggregate) continue
    aggregate.income[income.currency] += income.amount
  }

  for (const expense of expenses) {
    const aggregate = aggregateMap.get(expense.date.substring(0, 7))
    if (!aggregate) continue
    if (isPerceivedExpense(expense)) {
      aggregate.perceivedSpend[expense.currency] += expense.amount
      addCategory(aggregate, expense.category, expense.amount, expense.currency)
      continue
    }
    if (isApplicableCardPayment(expense)) {
      aggregate.perceivedSpend[expense.currency] += expense.amount
      aggregate.cardPayments[expense.currency] += expense.amount
      continue
    }
    if (isCreditAccruedExpense(expense)) {
      aggregate.accruedSpend[expense.currency] += expense.amount
      addCategory(aggregate, expense.category, expense.amount, expense.currency)
    }
  }

  return Array.from(aggregateMap.values()).map(({ categoryMap, ...aggregate }) => ({
    ...aggregate,
    categories: Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount),
  }))
}

function buildMovements(params: {
  expenses: SnapshotExpenseRow[]
  incomeEntries: SnapshotIncomeRow[]
  transfers: SnapshotTransferRow[]
}): SnapshotMovement[] {
  const expenseMovements: SnapshotMovement[] = params.expenses.map((expense) => ({
    id: expense.id,
    kind: 'gasto',
    date: expense.date,
    description: expense.description,
    category: expense.category,
    amount: expense.amount,
    currency: expense.currency,
    paymentMethod: expense.payment_method,
    isWant: expense.is_want,
    isCardPayment: isCardPayment(expense),
    installmentLabel: installmentLabel(expense),
  }))

  const incomeMovements: SnapshotMovement[] = params.incomeEntries.map((income) => ({
    id: income.id,
    kind: 'ingreso',
    date: income.date,
    description: income.description || income.category,
    category: income.category,
    amount: income.amount,
    currency: income.currency,
    paymentMethod: null,
    isWant: null,
    isCardPayment: false,
    installmentLabel: null,
  }))

  const transferMovements: SnapshotMovement[] = params.transfers.map((transfer) => ({
    id: transfer.id,
    kind: 'transferencia',
    date: transfer.date,
    description: transfer.note || 'Transferencia entre cuentas',
    category: `${transfer.currency_from} → ${transfer.currency_to}`,
    amount: transfer.amount_to,
    currency: transfer.currency_to,
    paymentMethod: null,
    isWant: null,
    isCardPayment: false,
    installmentLabel: null,
  }))

  return [...expenseMovements, ...incomeMovements, ...transferMovements].sort((a, b) =>
    b.date.localeCompare(a.date),
  )
}

/**
 * Ensamblado puro del snapshot: recibe filas crudas + estado derivado del
 * dashboard y produce el FinancialSnapshot normalizado. Sin IO — testeable
 * con fixtures.
 */
export function assembleFinancialSnapshot(inputs: SnapshotInputs): FinancialSnapshot {
  const { today, month, currency } = inputs
  const historyStartMonth = addMonths(month, -5)
  const nextMonthDate = `${addMonths(month, 1)}-01`
  const historyStartDate = `${historyStartMonth}-01`

  // Defensa contra contaminación: cuotas/movimientos fechados fuera de la
  // ventana [inicio histórico, fin del mes seleccionado) no entran al snapshot.
  const expenses = inputs.expenses.filter(
    (expense) => expense.date >= historyStartDate && expense.date < nextMonthDate,
  )
  const incomeEntries = inputs.incomeEntries.filter(
    (income) => income.date >= historyStartDate && income.date < nextMonthDate,
  )
  const transfers = inputs.transfers.filter(
    (transfer) => transfer.date >= historyStartDate && transfer.date < nextMonthDate,
  )

  const daysInMonth = daysInMonthOf(month)
  const isCurrentMonth = today.substring(0, 7) === month
  const dayOfMonth = isCurrentMonth ? Number(today.substring(8, 10)) : daysInMonth
  const comparisonDay = isCurrentMonth ? dayOfMonth : null

  const monthlySeries = buildMonthlySeries({
    expenses: expenses.filter((expense) => expense.currency === currency),
    selectedMonth: month,
    currentMonth: isCurrentMonth ? month : today.substring(0, 7),
    comparisonDay,
    earliestDataMonth: inputs.earliestDataMonth,
  })

  const monthIncome = emptyCurrencyTotals()
  for (const income of incomeEntries) {
    if (income.date.substring(0, 7) === month) {
      monthIncome[income.currency] += income.amount
    }
  }

  const hasOtherCurrencyMovements = expenses.some(
    (expense) => expense.date.substring(0, 7) === month && expense.currency !== currency,
  )

  return {
    referenceDate: today,
    month,
    currency,
    dayOfMonth,
    daysInMonth,
    comparisonDay,
    earliestDataMonth: inputs.earliestDataMonth,
    availableCompletedMonths: countAvailableComparisonMonths(monthlySeries, month),
    saldoVivo: inputs.saldoVivo,
    disponibleReal: inputs.disponibleReal,
    accountBalances: inputs.accountBalances,
    monthIncome,
    hasIncome: monthIncome[currency] > 0,
    monthlySeries,
    budget: inputs.budget,
    cards: inputs.cards,
    subscriptions: inputs.subscriptions,
    goals: inputs.goals,
    yieldAccumulated: inputs.yieldAccumulated,
    movements: buildMovements({ expenses, incomeEntries, transfers }),
    monthAggregates: buildMonthAggregates({ expenses, incomeEntries, historyStartMonth, month }),
    hasOtherCurrencyMovements,
  }
}

/**
 * Carga el snapshot desde Supabase reusando las queries existentes
 * (readDashboardData, getBudgetSnapshot) + histórico de movimientos.
 */
export async function loadFinancialSnapshot(params: {
  supabase: SupabaseClient
  userId: string
  month?: string
}): Promise<FinancialSnapshot> {
  const { supabase, userId } = params
  const month = params.month ?? getCurrentMonth()
  const today = todayAR()
  const historyStartDate = `${addMonths(month, -5)}-01`
  const nextMonthDate = `${addMonths(month, 1)}-01`

  const { data: config } = await supabase
    .from('user_config')
    .select('default_currency')
    .eq('user_id', userId)
    .single()

  const currency = (config?.default_currency ?? 'ARS') as Currency

  const [dashboard, budget, expensesResult, incomeResult, transfersResult, oldestExpenseResult] =
    await Promise.all([
      readDashboardData({ supabase, userId, selectedMonth: month, viewCurrency: currency }),
      getBudgetSnapshot({ supabase, userId, month, currency }),
      supabase
        .from('expenses')
        .select(
          'id, amount, currency, category, description, is_want, payment_method, is_legacy_card_payment, date, installment_number, installment_total',
        )
        .eq('user_id', userId)
        .gte('date', historyStartDate)
        .lt('date', nextMonthDate)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('income_entries')
        .select('id, amount, currency, description, category, date')
        .eq('user_id', userId)
        .gte('date', historyStartDate)
        .lt('date', nextMonthDate)
        .order('date', { ascending: false })
        .limit(200),
      supabase
        .from('transfers')
        .select('id, amount_from, amount_to, currency_from, currency_to, date, note')
        .eq('user_id', userId)
        .gte('date', historyStartDate)
        .lt('date', nextMonthDate)
        .order('date', { ascending: false })
        .limit(200),
      supabase
        .from('expenses')
        .select('date')
        .eq('user_id', userId)
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ])

  if (expensesResult.error) throw expensesResult.error
  if (incomeResult.error) throw incomeResult.error
  if (transfersResult.error) throw transfersResult.error
  if (oldestExpenseResult.error) throw oldestExpenseResult.error

  const cards: SnapshotCardCommitment[] = (dashboard.compromisos?.tarjetas ?? []).map((tarjeta) => ({
    cardId: tarjeta.id,
    cardName: tarjeta.name,
    currentCycleSpend: tarjeta.currentSpend,
    daysUntilClosing: tarjeta.daysUntilClosing,
    pendingStatements: tarjeta.debtCycles.map((cycle) => ({
      periodMonth: cycle.periodMonth,
      amount: cycle.amount,
      dueDate: cycle.dueDate,
      status: cycle.cycleStatus,
    })),
  }))

  const subscriptions: SnapshotSubscription[] = dashboard.activeSubscriptions.map((sub) => ({
    description: sub.description,
    category: sub.category,
    amount: sub.amount,
    currency: sub.currency,
    paymentMethod: sub.payment_method,
    dayOfMonth: sub.day_of_month,
  }))

  return assembleFinancialSnapshot({
    today,
    month,
    currency,
    saldoVivo: dashboard.heroBreakdown,
    disponibleReal: dashboard.availableBreakdown,
    accountBalances: dashboard.accountBalances.map((account) => ({
      id: account.id,
      name: account.name,
      saldo: account.saldo,
    })),
    budget,
    cards,
    subscriptions,
    goals: { count: dashboard.goals.length, committed: dashboard.goalCommitmentsBreakdown },
    yieldAccumulated: dashboard.dashboardData?.saldo_vivo?.rendimientos ?? 0,
    expenses: (expensesResult.data ?? []) as SnapshotExpenseRow[],
    incomeEntries: (incomeResult.data ?? []) as SnapshotIncomeRow[],
    transfers: (transfersResult.data ?? []) as SnapshotTransferRow[],
    earliestDataMonth: oldestExpenseResult.data?.date?.substring(0, 7) ?? null,
  })
}
