import { countAvailableComparisonMonths } from '@/lib/analytics/analytics-overview'
import type { AnalyticsComparisonContext, MonthlySeriesPoint } from '@/lib/analytics/analytics-overview'
import { addMonths, getCurrentDayOfMonth, getCurrentMonth } from '@/lib/dates'
import { formatAmount, todayAR } from '@/lib/format'
import {
  isApplicableCardPayment,
  isCreditAccruedExpense,
  isPerceivedExpense,
} from '@/lib/movement-classification'
import { getBudgetSnapshot } from '@/lib/server/budget-queries'
import { readDashboardData } from '@/lib/server/dashboard-queries'
import type { createClient } from '@/lib/supabase/server'
import type { Expense, IncomeEntry, Transfer } from '@/types/database'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>
type Currency = 'ARS' | 'USD'

type AssistantExpenseRow = Pick<
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
  | 'created_at'
>

type AssistantIncomeRow = Pick<
  IncomeEntry,
  'id' | 'amount' | 'currency' | 'description' | 'category' | 'date' | 'created_at'
>

type AssistantTransferRow = Pick<
  Transfer,
  | 'id'
  | 'amount_from'
  | 'amount_to'
  | 'currency_from'
  | 'currency_to'
  | 'date'
  | 'note'
  | 'created_at'
>

type MonthAggregate = {
  month: string
  incomeByCurrency: Record<Currency, number>
  perceivedSpendByCurrency: Record<Currency, number>
  accruedSpendByCurrency: Record<Currency, number>
  cardPaymentsByCurrency: Record<Currency, number>
  categories: Map<string, { amount: number; count: number; currency: Currency }>
}

type DetailMovement = {
  date: string
  label: string
  amount: number
  currency: Currency
  category: string
  kind: 'gasto' | 'ingreso' | 'transferencia'
}

const STOPWORDS = new Set([
  'sobre',
  'para',
  'como',
  'cual',
  'cuál',
  'cuando',
  'cuándo',
  'donde',
  'dónde',
  'este',
  'esta',
  'estos',
  'estas',
  'mes',
  'meses',
  'ultimo',
  'último',
  'ultimos',
  'últimos',
  'gaste',
  'gasté',
  'gasto',
  'gastos',
  'ingreso',
  'ingresos',
  'cuanto',
  'cuánto',
  'tengo',
  'tuve',
  'pasado',
  'pasada',
])

function emptyCurrencyTotals(): Record<Currency, number> {
  return { ARS: 0, USD: 0 }
}

function formatNumber(value: number, currency: Currency): string {
  return formatAmount(Math.round(value), currency)
}

function monthLabel(month: string): string {
  const raw = new Date(`${month}-15T12:00:00-03:00`).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function dayOfMonth(date: string): number {
  return Number(date.substring(8, 10))
}

function isCompleteMonth(month: string, currentMonth: string): boolean {
  return month < currentMonth
}

function shouldIncludeDetail(question: string, historyText: string): boolean {
  const text = `${question} ${historyText}`.toLowerCase()
  return [
    'ultima',
    'última',
    'ultimo',
    'último',
    'cuando',
    'cuándo',
    'donde',
    'dónde',
    'detalle',
    'movimiento',
    'transaccion',
    'transacción',
    'compre',
    'compré',
    'rappi',
    'pedido',
    'netflix',
    'viernes',
    'sabado',
    'sábado',
    'domingo',
    'ayer',
    'hoy',
  ].some((term) => text.includes(term))
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token))
}

function buildMonthlySeries(params: {
  expenses: AssistantExpenseRow[]
  selectedMonth: string
  currentMonth: string
  comparisonDay: number | null
  earliestDataMonth: string | null
}): MonthlySeriesPoint[] {
  const { expenses, selectedMonth, currentMonth, comparisonDay, earliestDataMonth } = params
  const historyFloor = addMonths(selectedMonth, -5)
  const seriesStart =
    earliestDataMonth && earliestDataMonth > historyFloor ? earliestDataMonth : historyFloor

  const monthMap = new Map<string, MonthlySeriesPoint>()
  let cursor = seriesStart
  while (cursor <= selectedMonth) {
    monthMap.set(cursor, {
      month: cursor,
      label: monthLabel(cursor).split(' ')[0],
      percibidoTotal: 0,
      percibidoDevengadoTotal: 0,
      sameDayPercibidoTotal: comparisonDay ? 0 : null,
      sameDayPercibidoDevengadoTotal: comparisonDay ? 0 : null,
      isCurrent: cursor === selectedMonth,
      isComplete: isCompleteMonth(cursor, currentMonth),
    })
    cursor = addMonths(cursor, 1)
  }

  for (const expense of expenses) {
    const month = expense.date.substring(0, 7)
    const point = monthMap.get(month)
    if (!point) continue

    const perceived = isPerceivedExpense(expense) || isApplicableCardPayment(expense)
    const accrued = isCreditAccruedExpense(expense)
    const day = dayOfMonth(expense.date)

    if (perceived) {
      point.percibidoTotal += expense.amount
      point.percibidoDevengadoTotal += expense.amount
      if (comparisonDay !== null && point.sameDayPercibidoTotal !== null && day <= comparisonDay) {
        point.sameDayPercibidoTotal += expense.amount
      }
      if (
        comparisonDay !== null &&
        point.sameDayPercibidoDevengadoTotal !== null &&
        day <= comparisonDay
      ) {
        point.sameDayPercibidoDevengadoTotal += expense.amount
      }
      continue
    }

    if (!accrued) continue

    point.percibidoDevengadoTotal += expense.amount
    if (
      comparisonDay !== null &&
      point.sameDayPercibidoDevengadoTotal !== null &&
      day <= comparisonDay
    ) {
      point.sameDayPercibidoDevengadoTotal += expense.amount
    }
  }

  return Array.from(monthMap.values())
}

function addCategory(
  aggregate: MonthAggregate,
  category: string,
  amount: number,
  currency: Currency,
): void {
  const key = `${currency}:${category}`
  const current = aggregate.categories.get(key) ?? { amount: 0, count: 0, currency }
  current.amount += amount
  current.count += 1
  aggregate.categories.set(key, current)
}

function movementMatches(movement: DetailMovement, terms: string[]): boolean {
  if (terms.length === 0) return true
  const haystack = `${movement.label} ${movement.category}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return terms.some((term) => haystack.includes(term))
}

function buildDetailMovements(params: {
  expenses: AssistantExpenseRow[]
  incomeEntries: AssistantIncomeRow[]
  transfers: AssistantTransferRow[]
  question: string
}): DetailMovement[] {
  const terms = tokenize(params.question)
  const expenseMovements: DetailMovement[] = params.expenses.map((expense) => ({
    date: expense.date,
    label: expense.description,
    amount: -expense.amount,
    currency: expense.currency,
    category: expense.category,
    kind: 'gasto',
  }))
  const incomeMovements: DetailMovement[] = params.incomeEntries.map((income) => ({
    date: income.date,
    label: income.description || income.category,
    amount: income.amount,
    currency: income.currency,
    category: income.category,
    kind: 'ingreso',
  }))
  const transferMovements: DetailMovement[] = params.transfers.map((transfer) => ({
    date: transfer.date,
    label: transfer.note || 'Transferencia entre cuentas',
    amount: transfer.amount_to,
    currency: transfer.currency_to,
    category: `${transfer.currency_from} -> ${transfer.currency_to}`,
    kind: 'transferencia',
  }))

  return [...expenseMovements, ...incomeMovements, ...transferMovements]
    .filter((movement) => movementMatches(movement, terms))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 25)
}

function buildContextText(params: {
  today: string
  selectedMonth: string
  currency: Currency
  aggregates: MonthAggregate[]
  monthlySeries: MonthlySeriesPoint[]
  comparisonContext: AnalyticsComparisonContext
  dashboard: Awaited<ReturnType<typeof readDashboardData>>
  budget: Awaited<ReturnType<typeof getBudgetSnapshot>>
  detailMovements: DetailMovement[]
  detailIncluded: boolean
}): string {
  const {
    today,
    selectedMonth,
    currency,
    aggregates,
    monthlySeries,
    comparisonContext,
    dashboard,
    budget,
    detailMovements,
    detailIncluded,
  } = params

  const lines: string[] = []
  lines.push(`Fecha de referencia: ${today}`)
  lines.push(`Mes actual: ${selectedMonth} (${monthLabel(selectedMonth)})`)
  lines.push(`Moneda principal del usuario: ${currency}`)
  lines.push('')

  lines.push('ESTADO ACTUAL')
  lines.push(`Saldo Vivo ARS: ${formatNumber(dashboard.heroBreakdown.ARS, 'ARS')}`)
  lines.push(`Saldo Vivo USD: ${formatNumber(dashboard.heroBreakdown.USD, 'USD')}`)
  lines.push(`Disponible Real ARS: ${formatNumber(dashboard.availableBreakdown.ARS, 'ARS')}`)
  lines.push(`Disponible Real USD: ${formatNumber(dashboard.availableBreakdown.USD, 'USD')}`)
  if (dashboard.accountBalances.length > 0) {
    lines.push(
      `Saldos por cuenta (${dashboard.viewCurrency}): ${dashboard.accountBalances
        .map((account) => `${account.name} ${formatNumber(account.saldo, dashboard.viewCurrency)}`)
        .join('; ')}`,
    )
  }
  if (dashboard.compromisos) {
    lines.push(
      `Compromisos ${dashboard.viewCurrency}: a pagar ${formatNumber(
        dashboard.compromisos.totalAPagar,
        dashboard.viewCurrency,
      )}; en curso ${formatNumber(dashboard.compromisos.totalEnCurso, dashboard.viewCurrency)}`,
    )
  }
  if (dashboard.activeSubscriptions.length > 0) {
    lines.push(
      `Suscripciones activas: ${dashboard.activeSubscriptions
        .slice(0, 12)
        .map((sub) => `${sub.description} ${formatNumber(sub.amount, sub.currency)} dia ${sub.day_of_month}`)
        .join('; ')}`,
    )
  }
  if (dashboard.activeInstruments.length > 0) {
    lines.push(
      `Instrumentos activos: ${dashboard.activeInstruments
        .slice(0, 8)
        .map((instrument) => `${instrument.label || instrument.type} ${formatNumber(instrument.amount, instrument.currency)}`)
        .join('; ')}`,
    )
  }
  lines.push('')

  lines.push('PRESUPUESTO DEL MES')
  if (budget.plan) {
    lines.push(
      `Plan activo ${budget.plan.baseCurrency}: usado ${formatNumber(
        budget.summary.totalSpent,
        budget.plan.baseCurrency,
      )} de ${formatNumber(budget.summary.totalBudgeted, budget.plan.baseCurrency)}`,
    )
    const budgetItems = budget.items
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.spentAmount - a.spentAmount)
      .slice(0, 8)
      .map((item) => `${item.category}: ${formatNumber(item.spentAmount, budget.plan!.baseCurrency)} / ${formatNumber(item.amount, budget.plan!.baseCurrency)} (${item.usedPct}%)`)
    if (budgetItems.length > 0) lines.push(`Categorias de presupuesto: ${budgetItems.join('; ')}`)
  } else {
    lines.push('No hay presupuesto activo cargado para el mes actual.')
  }
  lines.push('')

  lines.push('RESUMEN POR MES')
  for (const aggregate of aggregates) {
    lines.push(`${monthLabel(aggregate.month)}:`)
    lines.push(
      `  Ingresos: ARS ${formatNumber(aggregate.incomeByCurrency.ARS, 'ARS')}; USD ${formatNumber(
        aggregate.incomeByCurrency.USD,
        'USD',
      )}`,
    )
    lines.push(
      `  Gastos percibidos: ARS ${formatNumber(
        aggregate.perceivedSpendByCurrency.ARS,
        'ARS',
      )}; USD ${formatNumber(aggregate.perceivedSpendByCurrency.USD, 'USD')}`,
    )
    lines.push(
      `  Gastos devengados tarjeta: ARS ${formatNumber(
        aggregate.accruedSpendByCurrency.ARS,
        'ARS',
      )}; USD ${formatNumber(aggregate.accruedSpendByCurrency.USD, 'USD')}`,
    )
    lines.push(
      `  Pagos de tarjeta: ARS ${formatNumber(
        aggregate.cardPaymentsByCurrency.ARS,
        'ARS',
      )}; USD ${formatNumber(aggregate.cardPaymentsByCurrency.USD, 'USD')}`,
    )
    const categories = Array.from(aggregate.categories.entries())
      .sort(([, a], [, b]) => b.amount - a.amount)
      .slice(0, 10)
      .map(([key, value]) => `${key.split(':')[1]} ${formatNumber(value.amount, value.currency)} (${value.count})`)
    if (categories.length > 0) lines.push(`  Categorias principales: ${categories.join('; ')}`)
  }
  lines.push('')

  lines.push('TENDENCIA')
  lines.push(
    `Comparacion disponible: ${comparisonContext.availableCompletedMonths} meses completos; dia comparable: ${
      comparisonContext.comparisonDay ?? 'no aplica'
    }`,
  )
  for (const point of monthlySeries) {
    lines.push(
      `${point.label}: percibido ${formatNumber(point.percibidoTotal, currency)}; percibido + devengado ${formatNumber(
        point.percibidoDevengadoTotal,
        currency,
      )}`,
    )
  }
  lines.push('')

  if (detailIncluded) {
    lines.push('DETALLE RELEVANTE')
    if (detailMovements.length === 0) {
      lines.push('No se encontraron movimientos individuales relevantes para la pregunta dentro del periodo consultado.')
    } else {
      for (const movement of detailMovements) {
        lines.push(
          `${movement.date} | ${movement.kind} | ${movement.label} | ${formatNumber(
            Math.abs(movement.amount),
            movement.currency,
          )} | ${movement.category}`,
        )
      }
    }
  } else {
    lines.push('DETALLE RELEVANTE')
    lines.push('No incluido: la pregunta parece responderse con agregados. Si hace falta detalle fino, deci que no esta en este contexto.')
  }

  return lines.join('\n')
}

export async function buildAssistantFinancialContext(params: {
  supabase: SupabaseClient
  userId: string
  question: string
  historyText: string
}): Promise<{ text: string; detailIncluded: boolean }> {
  const { supabase, userId, question, historyText } = params
  const selectedMonth = getCurrentMonth()
  const currentMonth = selectedMonth
  const today = todayAR()
  const historyStartMonth = addMonths(selectedMonth, -5)
  const historyStartDate = `${historyStartMonth}-01`
  const nextMonthDate = `${addMonths(selectedMonth, 1)}-01`

  const { data: config } = await supabase
    .from('user_config')
    .select('default_currency')
    .eq('user_id', userId)
    .single()

  const currency = (config?.default_currency ?? 'ARS') as Currency

  const [
    dashboard,
    budget,
    expensesResult,
    incomeResult,
    transfersResult,
    oldestExpenseResult,
  ] = await Promise.all([
    readDashboardData({
      supabase,
      userId,
      selectedMonth,
      viewCurrency: currency,
    }),
    getBudgetSnapshot({
      supabase,
      userId,
      month: selectedMonth,
      currency,
    }),
    supabase
      .from('expenses')
      .select('id, amount, currency, category, description, is_want, payment_method, is_legacy_card_payment, date, created_at')
      .eq('user_id', userId)
      .gte('date', historyStartDate)
      .lt('date', nextMonthDate)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('income_entries')
      .select('id, amount, currency, description, category, date, created_at')
      .eq('user_id', userId)
      .gte('date', historyStartDate)
      .lt('date', nextMonthDate)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('transfers')
      .select('id, amount_from, amount_to, currency_from, currency_to, date, note, created_at')
      .eq('user_id', userId)
      .gte('date', historyStartDate)
      .lt('date', nextMonthDate)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('expenses').select('date').eq('user_id', userId).order('date', { ascending: true }).limit(1).maybeSingle(),
  ])

  if (expensesResult.error) throw expensesResult.error
  if (incomeResult.error) throw incomeResult.error
  if (transfersResult.error) throw transfersResult.error
  if (oldestExpenseResult.error) throw oldestExpenseResult.error

  const expenses = (expensesResult.data ?? []) as AssistantExpenseRow[]
  const incomeEntries = (incomeResult.data ?? []) as AssistantIncomeRow[]
  const transfers = (transfersResult.data ?? []) as AssistantTransferRow[]

  const aggregateMap = new Map<string, MonthAggregate>()
  let cursor = historyStartMonth
  while (cursor <= selectedMonth) {
    aggregateMap.set(cursor, {
      month: cursor,
      incomeByCurrency: emptyCurrencyTotals(),
      perceivedSpendByCurrency: emptyCurrencyTotals(),
      accruedSpendByCurrency: emptyCurrencyTotals(),
      cardPaymentsByCurrency: emptyCurrencyTotals(),
      categories: new Map(),
    })
    cursor = addMonths(cursor, 1)
  }

  for (const income of incomeEntries) {
    const aggregate = aggregateMap.get(income.date.substring(0, 7))
    if (!aggregate) continue
    aggregate.incomeByCurrency[income.currency] += income.amount
  }

  for (const expense of expenses) {
    const aggregate = aggregateMap.get(expense.date.substring(0, 7))
    if (!aggregate) continue
    if (isPerceivedExpense(expense)) {
      aggregate.perceivedSpendByCurrency[expense.currency] += expense.amount
      addCategory(aggregate, expense.category, expense.amount, expense.currency)
      continue
    }
    if (isApplicableCardPayment(expense)) {
      aggregate.perceivedSpendByCurrency[expense.currency] += expense.amount
      aggregate.cardPaymentsByCurrency[expense.currency] += expense.amount
      addCategory(aggregate, expense.category, expense.amount, expense.currency)
      continue
    }
    if (isCreditAccruedExpense(expense)) {
      aggregate.accruedSpendByCurrency[expense.currency] += expense.amount
      addCategory(aggregate, expense.category, expense.amount, expense.currency)
    }
  }

  const comparisonDay = getCurrentDayOfMonth()
  const monthlySeries = buildMonthlySeries({
    expenses: expenses.filter((expense) => expense.currency === currency),
    selectedMonth,
    currentMonth,
    comparisonDay,
    earliestDataMonth: oldestExpenseResult.data?.date?.substring(0, 7) ?? null,
  })
  const comparisonContext: AnalyticsComparisonContext = {
    selectedMonth,
    isCurrentMonth: true,
    availableCompletedMonths: countAvailableComparisonMonths(monthlySeries, selectedMonth),
    comparisonDay,
  }
  const detailIncluded = shouldIncludeDetail(question, historyText)
  const detailMovements = detailIncluded
    ? buildDetailMovements({ expenses, incomeEntries, transfers, question: `${question} ${historyText}` })
    : []

  return {
    detailIncluded,
    text: buildContextText({
      today,
      selectedMonth,
      currency,
      aggregates: Array.from(aggregateMap.values()),
      monthlySeries,
      comparisonContext,
      dashboard,
      budget,
      detailMovements,
      detailIncluded,
    }),
  }
}
