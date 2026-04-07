import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getCurrentMonth } from '@/lib/dates'

export interface CardSummary {
  id: string
  name: string
  closing_day: number | null
  due_day: number | null
  account_id: string | null
  account_name: string | null
  devengado: number
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
  const { data: expenses } = await supabase
    .from('expenses')
    .select('card_id, amount')
    .eq('user_id', user.id)
    .eq('payment_method', 'CREDIT')
    .neq('category', 'Pago de Tarjetas')
    .gte('date', `${currentMonth}-01`)

  const devengadoByCard: Record<string, number> = {}
  for (const exp of expenses ?? []) {
    if (exp.card_id) {
      devengadoByCard[exp.card_id] = (devengadoByCard[exp.card_id] ?? 0) + exp.amount
    }
  }

  const result: CardSummary[] = (cards ?? []).map((card) => ({
    id: card.id,
    name: card.name,
    closing_day: card.closing_day,
    due_day: card.due_day,
    account_id: card.account_id,
    account_name: card.account_id ? (accountNameById[card.account_id] ?? null) : null,
    devengado: devengadoByCard[card.id] ?? 0,
  }))

  return NextResponse.json(result)
}
