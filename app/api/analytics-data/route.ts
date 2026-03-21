import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Card, Expense, Subscription } from '@/types/database'

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
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

  const { data: config } = await supabase
    .from('user_config')
    .select('default_currency, cards')
    .eq('user_id', user.id)
    .single()

  const currency = (config?.default_currency ?? 'ARS') as 'ARS' | 'USD'
  const cards = ((config?.cards as Card[]) ?? []).filter((c) => !c.archived)

  const [
    { data: rawExpenses },
    { data: incomeEntries },
    { data: legacyIncome },
    { data: oldestExpense },
    { data: subscriptionsData },
  ] = await Promise.all([
    supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .eq('currency', currency)
      .neq('category', 'Pago de Tarjetas')
      .gte('date', startOfMonth)
      .lt('date', endOfMonth),
    supabase
      .from('income_entries')
      .select('amount, currency')
      .eq('user_id', user.id)
      .eq('currency', currency)
      .gte('date', startOfMonth)
      .lt('date', endOfMonth),
    supabase
      .from('monthly_income')
      .select('amount_ars, amount_usd')
      .eq('user_id', user.id)
      .eq('month', startOfMonth)
      .maybeSingle(),
    supabase
      .from('expenses')
      .select('date')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase.from('subscriptions').select('*').eq('user_id', user.id).eq('is_active', true),
  ])

  const entriesSum = (incomeEntries ?? []).reduce((s, e) => s + e.amount, 0)
  const ingresoMes: number | null =
    entriesSum > 0
      ? entriesSum
      : legacyIncome
        ? currency === 'ARS'
          ? legacyIncome.amount_ars
          : legacyIncome.amount_usd
        : null

  return NextResponse.json({
    rawExpenses: (rawExpenses ?? []) as Expense[],
    ingresoMes,
    subscriptions: (subscriptionsData ?? []) as Subscription[],
    cards,
    currency,
    earliestDataMonth: oldestExpense?.date?.substring(0, 7) ?? null,
    selectedMonth,
  })
}
