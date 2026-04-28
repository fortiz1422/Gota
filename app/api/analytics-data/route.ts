import { NextResponse } from 'next/server'
import type {
  AnalyticsComparisonContext,
  MonthlySeriesPoint,
} from '@/lib/analytics/analytics-overview'
import { addMonths, getCurrentMonth } from '@/lib/dates'
import {
  isCreditAccruedExpense,
  isPerceivedExpense,
} from '@/lib/movement-classification'
import { createClient } from '@/lib/supabase/server'
import type { Card, CardCycle, Expense, Subscription } from '@/types/database'

function isMissingTableError(message: string | undefined): boolean {
  return !!message && message.toLowerCase().includes('card_cycles')
}

function monthLabel(month: string): string {
  const raw = new Date(`${month}-15T12:00:00`).toLocaleDateString('es-AR', {
    month: 'short',
  })
  const cleaned = raw.replace('.', '')
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

function getMonthDay(date: string): number {
  return Number(date.substring(8, 10))
}

function isCompleteMonth(month: string, currentMonth: string): boolean {
  return month < currentMonth
}

function buildMonthlySeries(params: {
  expenses: Expense[]
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
      label: monthLabel(cursor),
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

    const perceived = isPerceivedExpense(expense)
    const accrued = isCreditAccruedExpense(expense)
    const day = getMonthDay(expense.date)

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const monthParam = searchParams.get('month')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const selectedMonth = monthParam ?? getCurrentMonth()
  const currentMonth = getCurrentMonth()
  const startOfMonth = `${selectedMonth}-01`
  const endOfMonth = `${addMonths(selectedMonth, 1)}-01`
  const historyStartMonth = addMonths(selectedMonth, -5)
  const historyStartDate = `${historyStartMonth}-01`

  const [{ data: config }, { data: cardsData }] = await Promise.all([
    supabase.from('user_config').select('default_currency').eq('user_id', user.id).single(),
    supabase
      .from('cards')
      .select('*')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('created_at', { ascending: true }),
  ])

  const currencyParam = searchParams.get('currency')
  const currency = (currencyParam ?? config?.default_currency ?? 'ARS') as 'ARS' | 'USD'
  const cards = (cardsData ?? []) as Card[]

  const [
    { data: rawExpensesData },
    { data: historicalExpensesData },
    { data: compromisoExpensesData },
    { data: incomeEntries },
    { data: oldestExpense },
    { data: subscriptionsData },
    { data: unpaidCyclesData, error: unpaidCyclesError },
    { data: paidCyclesThisMonthData, error: paidCyclesError },
  ] = await Promise.all([
    supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .eq('currency', currency)
      .gte('date', startOfMonth)
      .lt('date', endOfMonth),

    supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .eq('currency', currency)
      .gte('date', historyStartDate)
      .lt('date', endOfMonth),

    supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .eq('currency', currency)
      .or('payment_method.eq.CREDIT,category.eq.Pago de Tarjetas'),

    supabase
      .from('income_entries')
      .select('amount, currency')
      .eq('user_id', user.id)
      .eq('currency', currency)
      .gte('date', startOfMonth)
      .lt('date', endOfMonth),

    supabase
      .from('expenses')
      .select('date')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle(),

    supabase.from('subscriptions').select('*').eq('user_id', user.id).eq('is_active', true),

    supabase
      .from('card_cycles')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'paid'),

    supabase
      .from('card_cycles')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'paid')
      .gte('due_date', startOfMonth)
      .lt('due_date', endOfMonth),
  ])

  const cyclesError = unpaidCyclesError ?? paidCyclesError
  if (cyclesError && !isMissingTableError(cyclesError.message)) {
    return NextResponse.json({ error: cyclesError.message }, { status: 500 })
  }

  const ingresoMes = (incomeEntries ?? []).reduce((sum, entry) => sum + entry.amount, 0)
  const earliestDataMonth = oldestExpense?.date?.substring(0, 7) ?? null
  const rawExpenses = ((rawExpensesData ?? []) as Expense[]).filter(
    (expense) => isPerceivedExpense(expense) || isCreditAccruedExpense(expense),
  )
  const historicalExpenses = ((historicalExpensesData ?? []) as Expense[]).filter(
    (expense) => isPerceivedExpense(expense) || isCreditAccruedExpense(expense),
  )
  const comparisonDay = selectedMonth === currentMonth ? new Date().getDate() : null
  const monthlySeries = buildMonthlySeries({
    expenses: historicalExpenses,
    selectedMonth,
    currentMonth,
    comparisonDay,
    earliestDataMonth,
  })
  const comparisonContext: AnalyticsComparisonContext = {
    selectedMonth,
    isCurrentMonth: selectedMonth === currentMonth,
    availableCompletedMonths: monthlySeries.filter(
      (point) => point.month < selectedMonth && point.isComplete,
    ).length,
    comparisonDay,
  }

  const allCardCycles: CardCycle[] = [
    ...((unpaidCyclesError ? [] : (unpaidCyclesData ?? [])) as CardCycle[]),
    ...((paidCyclesError ? [] : (paidCyclesThisMonthData ?? [])) as CardCycle[]),
  ]

  return NextResponse.json({
    rawExpenses,
    compromisoExpenses: (compromisoExpensesData ?? []) as Expense[],
    ingresoMes,
    subscriptions: (subscriptionsData ?? []) as Subscription[],
    cardCycles: allCardCycles,
    cards,
    currency,
    earliestDataMonth,
    selectedMonth,
    monthlySeries,
    comparisonContext,
  })
}
