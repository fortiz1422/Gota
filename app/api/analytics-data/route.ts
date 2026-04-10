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
    supabase.from('cards').select('*').eq('user_id', user.id).eq('archived', false).order('created_at', { ascending: true }),
  ])

  const currency = (config?.default_currency ?? 'ARS') as 'ARS' | 'USD'
  const cards = (cardsData ?? []) as Card[]

  const prevMonthStart = addMonths(selectedMonth, -1) + '-01'

  const [
    { data: rawExpenses },
    { data: prevCreditExpenses },
    { data: incomeEntries },
    { data: oldestExpense },
    { data: subscriptionsData },
    { data: cardCyclesData, error: cardCyclesError },
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
      .gte('date', prevMonthStart)
      .lt('date', startOfMonth),
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
      .in('period_month', [startOfMonth, prevMonthStart]),
  ])

  if (cardCyclesError && !isMissingTableError(cardCyclesError.message)) {
    return NextResponse.json({ error: cardCyclesError.message }, { status: 500 })
  }

  const ingresoMes = (incomeEntries ?? []).reduce((sum, entry) => sum + entry.amount, 0)
  const currentMonthExpenses = ((rawExpenses ?? []) as Expense[]).filter(
    (expense) => isPerceivedExpense(expense) || isCreditAccruedExpense(expense),
  )
  const previousMonthCreditExpenses = ((prevCreditExpenses ?? []) as Expense[]).filter(
    (expense) => isCreditAccruedExpense(expense),
  )

  return NextResponse.json({
    rawExpenses: currentMonthExpenses,
    prevMonthExpenses: previousMonthCreditExpenses,
    ingresoMes,
    subscriptions: (subscriptionsData ?? []) as Subscription[],
    cardCycles: (cardCyclesError ? [] : (cardCyclesData ?? [])) as CardCycle[],
    cards,
    currency,
    earliestDataMonth: oldestExpense?.date?.substring(0, 7) ?? null,
    selectedMonth,
  })
}
