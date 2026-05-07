import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { addMonths, getCurrentMonth } from '@/lib/dates'
import { buildEnrichedCardCycles, sumPendingResumenes } from '@/lib/card-summaries'
import { buildCardCycleAmountsMap, isMissingCardCycleAmountsTableError } from '@/lib/card-cycle-amounts'
import type { Card, CardCycle, CardCycleAmount, Expense } from '@/types/database'

export interface CardSummary {
  id: string
  name: string
  closing_day: number | null
  due_day: number | null
  account_id: string | null
  account_name: string | null
  pending_amount: number
  pending_ars: number
  pending_usd: number
  default_currency: 'ARS' | 'USD'
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const currentMonth = getCurrentMonth()
  const periodMonths: string[] = [addMonths(currentMonth, 1)]
  for (let i = 0; i <= 5; i++) periodMonths.push(addMonths(currentMonth, -i))

  const oldest = periodMonths[periodMonths.length - 1]
  const newest = periodMonths[0]

  const [
    { data: config },
    { data: cards, error },
    { data: accountsData },
    { data: storedCycles },
    { data: expenses },
    { data: cycleAmountsData, error: cycleAmountsError },
  ] = await Promise.all([
    supabase.from('user_config').select('default_currency').eq('user_id', user.id).single(),
    supabase
      .from('cards')
      .select('id, name, closing_day, due_day, account_id')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('created_at', { ascending: true }),
    supabase
      .from('accounts')
      .select('id, name')
      .eq('user_id', user.id),
    supabase
      .from('card_cycles')
      .select('*')
      .eq('user_id', user.id)
      .gte('period_month', `${oldest}-01`)
      .lte('period_month', `${newest}-01`),
    supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', `${addMonths(currentMonth, -7)}-01`),
    supabase
      .from('card_cycle_amounts')
      .select('*')
      .eq('user_id', user.id),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (cycleAmountsError && !isMissingCardCycleAmountsTableError(cycleAmountsError.message)) {
    return NextResponse.json({ error: cycleAmountsError.message }, { status: 500 })
  }

  const accountNameById: Record<string, string> = {}
  for (const a of accountsData ?? []) {
    accountNameById[a.id] = a.name
  }

  const cyclesByCard: Record<string, CardCycle[]> = {}
  for (const cycle of (storedCycles ?? []) as CardCycle[]) {
    if (!cyclesByCard[cycle.card_id]) cyclesByCard[cycle.card_id] = []
    cyclesByCard[cycle.card_id].push(cycle)
  }

  const expensesByCard: Record<string, Expense[]> = {}
  for (const expense of (expenses ?? []) as Expense[]) {
    if (!expense.card_id) continue
    if (!expensesByCard[expense.card_id]) expensesByCard[expense.card_id] = []
    expensesByCard[expense.card_id].push(expense)
  }
  const cycleAmountsMap = buildCardCycleAmountsMap((cycleAmountsData ?? []) as CardCycleAmount[])
  const defaultCurrency = (config?.default_currency ?? 'ARS') as 'ARS' | 'USD'

  const result: CardSummary[] = (cards ?? []).map((card) => ({
    id: card.id,
    name: card.name,
    closing_day: card.closing_day,
    due_day: card.due_day,
    account_id: card.account_id,
    account_name: card.account_id ? (accountNameById[card.account_id] ?? null) : null,
    pending_amount: sumPendingResumenes(
      buildEnrichedCardCycles({
        card: card as Card,
        storedCycles: cyclesByCard[card.id] ?? [],
        expenses: expensesByCard[card.id] ?? [],
        periodMonths,
        currency: defaultCurrency,
        cycleAmountsMap,
      }),
      currentMonth,
    ),
    pending_ars: sumPendingResumenes(
      buildEnrichedCardCycles({
        card: card as Card,
        storedCycles: cyclesByCard[card.id] ?? [],
        expenses: expensesByCard[card.id] ?? [],
        periodMonths,
        currency: 'ARS',
        cycleAmountsMap,
      }),
      currentMonth,
    ),
    pending_usd: sumPendingResumenes(
      buildEnrichedCardCycles({
        card: card as Card,
        storedCycles: cyclesByCard[card.id] ?? [],
        expenses: expensesByCard[card.id] ?? [],
        periodMonths,
        currency: 'USD',
        cycleAmountsMap,
      }),
      currentMonth,
    ),
    default_currency: defaultCurrency,
  }))

  return NextResponse.json(result)
}
