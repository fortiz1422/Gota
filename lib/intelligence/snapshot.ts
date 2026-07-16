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
  FutureInstallmentMonth,
  MonthAggregate,
  SnapshotAccountBalance,
  SnapshotCardCommitment,
  SnapshotGoal,
  SnapshotMovement,
  SnapshotRecurringIncome,
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
> & {
  /** Opcional: la columna puede no existir en bases sin la migración de flags. */
  is_extraordinary?: boolean | null
}

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
  goalsDetail?: SnapshotGoal[]
  recurringIncomes?: SnapshotRecurringIncome[]
  /** Gastos con fecha futura (cuotas ya materializadas más allá del mes). */
  futureExpenses?: SnapshotExpenseRow[]
  yieldAccumulated: number
  expenses: SnapshotExpenseRow[]
  incomeEntries: SnapshotIncomeRow[]
  transfers: SnapshotTransferRow[]
  earliestDataMonth: string | null
  /**
   * Límites de fetch usados por el loader. Si una fuente trae exactamente su
   * límite, la cobertura la marca como potencialmente truncada. Sin límites
   * declarados (fixtures/tests) se asume cobertura completa.
   */
  sourceLimits?: { expenses: number; incomes: number; transfers: number }
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

/** Horizonte de meses futuros que se proyecta para cuotas comprometidas. */
export const FUTURE_INSTALLMENT_MONTHS = 6

function buildFutureInstallments(params: {
  futureExpenses: SnapshotExpenseRow[]
  month: string
}): FutureInstallmentMonth[] {
  const { futureExpenses, month } = params
  const horizonEnd = addMonths(month, FUTURE_INSTALLMENT_MONTHS)
  const byMonth = new Map<string, FutureInstallmentMonth>()

  for (const expense of futureExpenses) {
    if (!expense.installment_number || !expense.installment_total) continue
    const expenseMonth = expense.date.substring(0, 7)
    if (expenseMonth <= month || expenseMonth > horizonEnd) continue
    const entry = byMonth.get(expenseMonth) ?? {
      month: expenseMonth,
      amount: emptyCurrencyTotals(),
      count: 0,
    }
    entry.amount[expense.currency] += expense.amount
    entry.count += 1
    byMonth.set(expenseMonth, entry)
  }

  return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month))
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
      wantsSpend: emptyCurrencyTotals(),
      extraordinarySpend: emptyCurrencyTotals(),
      categories: [],
      categoryMap: new Map(),
    })
    cursor = addMonths(cursor, 1)
  }

  const addCategory = (
    aggregate: { categoryMap: Map<string, CategoryAggregate> },
    expense: SnapshotExpenseRow,
  ) => {
    const key = `${expense.currency}:${expense.category}`
    const current = aggregate.categoryMap.get(key) ?? {
      category: expense.category,
      currency: expense.currency,
      amount: 0,
      count: 0,
      habitualAmount: 0,
      habitualCount: 0,
    }
    current.amount += expense.amount
    current.count += 1
    if (!expense.is_extraordinary) {
      current.habitualAmount += expense.amount
      current.habitualCount += 1
    }
    aggregate.categoryMap.set(key, current)
  }

  for (const income of incomeEntries) {
    const aggregate = aggregateMap.get(income.date.substring(0, 7))
    if (!aggregate) continue
    aggregate.income[income.currency] += income.amount
  }

  const addFlagged = (aggregate: MonthAggregate, expense: SnapshotExpenseRow) => {
    if (expense.is_want) aggregate.wantsSpend[expense.currency] += expense.amount
    if (expense.is_extraordinary) aggregate.extraordinarySpend[expense.currency] += expense.amount
  }

  for (const expense of expenses) {
    const aggregate = aggregateMap.get(expense.date.substring(0, 7))
    if (!aggregate) continue
    if (isPerceivedExpense(expense)) {
      aggregate.perceivedSpend[expense.currency] += expense.amount
      addCategory(aggregate, expense)
      addFlagged(aggregate, expense)
      continue
    }
    if (isApplicableCardPayment(expense)) {
      aggregate.perceivedSpend[expense.currency] += expense.amount
      aggregate.cardPayments[expense.currency] += expense.amount
      continue
    }
    if (isCreditAccruedExpense(expense)) {
      aggregate.accruedSpend[expense.currency] += expense.amount
      addCategory(aggregate, expense)
      addFlagged(aggregate, expense)
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
    isExtraordinary: expense.is_extraordinary ?? null,
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
    isExtraordinary: null,
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
    isExtraordinary: null,
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
  const normalizeDateOnly = <T extends { date: string }>(row: T): T => ({
    ...row,
    date: row.date.substring(0, 10),
  })
  const rawExpenses = inputs.expenses.map(normalizeDateOnly)
  const rawIncomeEntries = inputs.incomeEntries.map(normalizeDateOnly)
  const rawTransfers = inputs.transfers.map(normalizeDateOnly)
  const futureExpenses = (inputs.futureExpenses ?? []).map(normalizeDateOnly)
  const historyStartMonth = addMonths(month, -5)
  const nextMonthDate = `${addMonths(month, 1)}-01`
  const historyStartDate = `${historyStartMonth}-01`

  // Defensa contra contaminación: cuotas/movimientos fechados fuera de la
  // ventana [inicio histórico, fin del mes seleccionado) no entran al snapshot.
  const expenses = rawExpenses.filter(
    (expense) => expense.date >= historyStartDate && expense.date < nextMonthDate,
  )
  const incomeEntries = rawIncomeEntries.filter(
    (income) => income.date >= historyStartDate && income.date < nextMonthDate,
  )
  const transfers = rawTransfers.filter(
    (transfer) => transfer.date >= historyStartDate && transfer.date < nextMonthDate,
  )

  const daysInMonth = daysInMonthOf(month)
  const isCurrentMonth = today.substring(0, 7) === month
  const dayOfMonth = isCurrentMonth ? Number(today.substring(8, 10)) : daysInMonth
  const comparisonDay = isCurrentMonth ? dayOfMonth : null

  // La cobertura se mide sobre las filas crudas (el límite aplica a la query,
  // antes del filtro de ventana). Sin límite declarado, cobertura completa.
  const sourceCoverage = (fetched: number, limit: number | undefined) => ({
    fetched,
    limit: limit ?? Number.MAX_SAFE_INTEGER,
    truncated: limit !== undefined && fetched >= limit,
  })
  const coverage = {
    expenses: sourceCoverage(inputs.expenses.length, inputs.sourceLimits?.expenses),
    incomes: sourceCoverage(inputs.incomeEntries.length, inputs.sourceLimits?.incomes),
    transfers: sourceCoverage(inputs.transfers.length, inputs.sourceLimits?.transfers),
    historyStartDate,
  }

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
    goalsDetail: inputs.goalsDetail ?? [],
    recurringIncomes: inputs.recurringIncomes ?? [],
    futureInstallments: buildFutureInstallments({
      futureExpenses,
      month,
    }),
    yieldAccumulated: inputs.yieldAccumulated,
    movements: buildMovements({ expenses, incomeEntries, transfers }),
    monthAggregates: buildMonthAggregates({ expenses, incomeEntries, historyStartMonth, month }),
    hasOtherCurrencyMovements,
    coverage,
  }
}

/** Límites de fetch del loader: declarados para que la cobertura los audite. */
const SNAPSHOT_LIMITS = { expenses: 500, incomes: 200, transfers: 200 } as const

const EXPENSE_BASE_COLUMNS =
  'id, amount, currency, category, description, is_want, payment_method, is_legacy_card_payment, date, installment_number, installment_total'

function isMissingExtraordinaryColumnError(error: unknown): boolean {
  const candidate = error as { message?: string | null; details?: string | null; hint?: string | null }
  return `${candidate?.message ?? ''} ${candidate?.details ?? ''} ${candidate?.hint ?? ''}`
    .toLowerCase()
    .includes('is_extraordinary')
}

/**
 * Query de gastos con `is_extraordinary` cuando la columna existe; si la base
 * no tiene la migración de flags, reintenta sin ella (mismo fallback que los
 * writes de /api/expenses).
 */
async function fetchExpenseRows(options: {
  supabase: SupabaseClient
  userId: string
  fromDate: string
  toDate: string
  onlyInstallments?: boolean
  limit: number
}): Promise<SnapshotExpenseRow[]> {
  const run = (withExtraordinary: boolean) => {
    let query = options.supabase
      .from('expenses')
      .select(withExtraordinary ? `${EXPENSE_BASE_COLUMNS}, is_extraordinary` : EXPENSE_BASE_COLUMNS)
      .eq('user_id', options.userId)
      .gte('date', options.fromDate)
      .lt('date', options.toDate)
    if (options.onlyInstallments) {
      query = query.not('installment_group_id', 'is', null)
    }
    return query
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(options.limit)
  }

  const first = await run(true)
  if (!first.error) return (first.data ?? []) as unknown as SnapshotExpenseRow[]
  if (!isMissingExtraordinaryColumnError(first.error)) throw first.error

  const fallback = await run(false)
  if (fallback.error) throw fallback.error
  return (fallback.data ?? []) as unknown as SnapshotExpenseRow[]
}

/**
 * Carga el snapshot desde Supabase reusando las queries existentes
 * (readDashboardData, getBudgetSnapshot) + histórico de movimientos.
 */
export async function loadFinancialSnapshot(params: {
  supabase: SupabaseClient
  userId: string
  month?: string
  /** Dashboard ya resuelto: evita repetir sus queries (guía §19). */
  dashboard?: Awaited<ReturnType<typeof readDashboardData>>
}): Promise<FinancialSnapshot> {
  const { supabase, userId } = params
  const month = params.month ?? getCurrentMonth()
  const today = todayAR()
  const historyStartDate = `${addMonths(month, -5)}-01`
  const nextMonthDate = `${addMonths(month, 1)}-01`
  const futureHorizonDate = `${addMonths(month, FUTURE_INSTALLMENT_MONTHS + 1)}-01`

  let currency: Currency
  if (params.dashboard) {
    currency = params.dashboard.currency
  } else {
    const { data: config } = await supabase
      .from('user_config')
      .select('default_currency')
      .eq('user_id', userId)
      .single()
    currency = (config?.default_currency ?? 'ARS') as Currency
  }

  const [dashboard, budget, expenses, futureExpenses, incomeResult, transfersResult, oldestExpenseResult] =
    await Promise.all([
      params.dashboard ??
        readDashboardData({ supabase, userId, selectedMonth: month, viewCurrency: currency }),
      getBudgetSnapshot({ supabase, userId, month, currency }),
      fetchExpenseRows({
        supabase,
        userId,
        fromDate: historyStartDate,
        toDate: nextMonthDate,
        limit: SNAPSHOT_LIMITS.expenses,
      }),
      fetchExpenseRows({
        supabase,
        userId,
        fromDate: nextMonthDate,
        toDate: futureHorizonDate,
        onlyInstallments: true,
        limit: 400,
      }),
      supabase
        .from('income_entries')
        .select('id, amount, currency, description, category, date')
        .eq('user_id', userId)
        .gte('date', historyStartDate)
        .lt('date', nextMonthDate)
        .order('date', { ascending: false })
        .limit(SNAPSHOT_LIMITS.incomes),
      supabase
        .from('transfers')
        .select('id, amount_from, amount_to, currency_from, currency_to, date, note')
        .eq('user_id', userId)
        .gte('date', historyStartDate)
        .lt('date', nextMonthDate)
        .order('date', { ascending: false })
        .limit(SNAPSHOT_LIMITS.transfers),
      supabase
        .from('expenses')
        .select('date')
        .eq('user_id', userId)
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ])

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

  const goalsDetail: SnapshotGoal[] = dashboard.goals.map((goal) => ({
    id: goal.id,
    name: goal.name,
    status: goal.status,
    currency: goal.currency,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    remainingAmount: goal.remainingAmount,
    progressPct: goal.progressPct,
    targetDate: goal.targetDate,
    monthsRemaining: goal.monthsRemaining,
    requiredMonthlyContribution: goal.requiredMonthlyContribution,
    plannedMonthlyContribution: goal.plannedMonthlyContribution,
    paceStatus: goal.paceStatus,
  }))

  const pendingRecurringIds = new Set(dashboard.recurringPending.map((income) => income.id))
  const recurringIncomes: SnapshotRecurringIncome[] = dashboard.activeRecurring.map((income) => ({
    id: income.id,
    description: income.description || income.category,
    amount: income.amount,
    currency: income.currency as Currency,
    dayOfMonth: income.day_of_month,
    pendingThisMonth: pendingRecurringIds.has(income.id),
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
    goalsDetail,
    recurringIncomes,
    futureExpenses,
    yieldAccumulated: dashboard.dashboardData?.saldo_vivo?.rendimientos ?? 0,
    expenses,
    incomeEntries: (incomeResult.data ?? []) as SnapshotIncomeRow[],
    transfers: (transfersResult.data ?? []) as SnapshotTransferRow[],
    earliestDataMonth: oldestExpenseResult.data?.date?.substring(0, 7) ?? null,
    sourceLimits: SNAPSHOT_LIMITS,
  })
}
