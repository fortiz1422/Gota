import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMonth, addMonths } from '@/lib/dates'
import {
  isCreditAccruedExpense,
  isPerceivedExpense,
} from '@/lib/movement-classification'
import type { Card, CardCycle, Expense, Subscription } from '@/types/database'

function isMissingTableError(message: string | undefined): boolean {
  return !!message && message.toLowerCase().includes('card_cycles')
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
  const startOfMonth = selectedMonth + '-01'
  const endOfMonth = addMonths(selectedMonth, 1) + '-01'

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
    { data: rawExpenses },
    { data: compromisoExpensesData },
    { data: incomeEntries },
    { data: oldestExpense },
    { data: subscriptionsData },
    { data: unpaidCyclesData, error: unpaidCyclesError },
    { data: paidCyclesThisMonthData, error: paidCyclesError },
  ] = await Promise.all([
    // Current month expenses — for computeMetrics and hero engine
    supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .eq('currency', currency)
      .gte('date', startOfMonth)
      .lt('date', endOfMonth),

    // Credit expenses + card payments in selected currency — for net commitments by card
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

    // All non-paid cycles (any period) — for current month debt calculation
    supabase
      .from('card_cycles')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'paid'),

    // Paid cycles with due_date in selected month — for historical view
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

  const currentMonthExpenses = ((rawExpenses ?? []) as Expense[]).filter(
    (expense) => isPerceivedExpense(expense) || isCreditAccruedExpense(expense),
  )

  // Merge non-paid cycles + paid cycles in selected month
  const allCardCycles: CardCycle[] = [
    ...((unpaidCyclesError ? [] : (unpaidCyclesData ?? [])) as CardCycle[]),
    ...((paidCyclesError ? [] : (paidCyclesThisMonthData ?? [])) as CardCycle[]),
  ]

  return NextResponse.json({
    rawExpenses: currentMonthExpenses,
    compromisoExpenses: (compromisoExpensesData ?? []) as Expense[],
    ingresoMes,
    subscriptions: (subscriptionsData ?? []) as Subscription[],
    cardCycles: allCardCycles,
    cards,
    currency,
    earliestDataMonth: oldestExpense?.date?.substring(0, 7) ?? null,
    selectedMonth,
  })
}
