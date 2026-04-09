import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { addMonths, getCurrentMonth } from '@/lib/dates'
import { buildEnrichedCardCycles, sumPendingResumenes } from '@/lib/card-summaries'
import type { Card, CardCycle, Expense } from '@/types/database'

export interface CardSummary {
  id: string
  name: string
  closing_day: number | null
  due_day: number | null
  account_id: string | null
  account_name: string | null
  pending_amount: number
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, name, closing_day, due_day, account_id')
    .eq('user_id', user.id)
    .eq('archived', false)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch accounts to resolve account names
  const accountIds = [...new Set((cards ?? []).map((c) => c.account_id).filter(Boolean))] as string[]
  let accountNameById: Record<string, string> = {}
  if (accountIds.length > 0) {
    const { data: accountsData } = await supabase
      .from('accounts')
      .select('id, name')
      .in('id', accountIds)
    for (const a of accountsData ?? []) {
      accountNameById[a.id] = a.name
    }
  }

  const currentMonth = getCurrentMonth()
  const periodMonths: string[] = [addMonths(currentMonth, 1)]
  for (let i = 0; i <= 5; i++) periodMonths.push(addMonths(currentMonth, -i))

  const oldest = periodMonths[periodMonths.length - 1]
  const newest = periodMonths[0]

  const [{ data: storedCycles }, { data: expenses }] = await Promise.all([
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
  ])

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
      }),
      currentMonth,
    ),
  }))

  return NextResponse.json(result)
}
