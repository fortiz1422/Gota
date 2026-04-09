import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { buildEnrichedCardCycles } from '@/lib/card-summaries'
import { addMonths, getCurrentMonth } from '@/lib/dates'
import { CardDetailClient } from './CardDetailClient'
import type { Account, Card, CardCycle, CardCycleInsert, Expense } from '@/types/database'

export type EnrichedCycle = {
  id: string
  source: 'stored' | 'legacy'
  period_month: string   // YYYY-MM-01
  period_from: string    // YYYY-MM-DD — day after previous cycle's closing_date
  closing_date: string   // YYYY-MM-DD
  due_date: string       // YYYY-MM-DD
  cycleStatus: 'en_curso' | 'cerrado' | 'vencido' | 'pagado'
  amount: number
  paid_at: string | null
  amount_paid: number | null
}

export default async function TarjetaPage({
  params,
}: {
  params: Promise<{ cardId: string }>
}) {
  const { cardId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: card, error: cardError } = await supabase
    .from('cards')
    .select('*')
    .eq('id', cardId)
    .eq('user_id', user.id)
    .eq('archived', false)
    .single()

  if (cardError || !card) notFound()

  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('archived', false)
    .neq('type', 'cash')
    .order('created_at', { ascending: true })

  // Months: next + current + last 5
  const currentMonth = getCurrentMonth()
  const periodMonths: string[] = [addMonths(currentMonth, 1)]
  for (let i = 0; i <= 5; i++) periodMonths.push(addMonths(currentMonth, -i))

  const oldest = periodMonths[periodMonths.length - 1]
  const newest = periodMonths[0]

  const { data: storedCycles } = await supabase
    .from('card_cycles')
    .select('*')
    .eq('user_id', user.id)
    .eq('card_id', cardId)
    .gte('period_month', `${oldest}-01`)
    .lte('period_month', `${newest}-01`)
    .order('period_month', { ascending: false })

  // Expenses for amount calculation — 8 months of coverage
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .eq('card_id', cardId)
    .gte('date', `${addMonths(currentMonth, -7)}-01`)

  const enriched: EnrichedCycle[] = buildEnrichedCardCycles({
    card: card as Card,
    storedCycles: (storedCycles ?? []) as CardCycle[],
    expenses: (expenses ?? []) as Expense[],
    periodMonths,
  })

  // Auto-materialize legacy past cycles so their date ranges freeze permanently.
  // Uses INSERT ... ON CONFLICT (card_id, period_month) DO NOTHING so existing rows are untouched.
  const legacyPastToMaterialize = enriched.filter(
    (c) => c.source === 'legacy' && c.period_month.substring(0, 7) < currentMonth
  )
  if (legacyPastToMaterialize.length > 0) {
    const cyclesToUpsert: CardCycleInsert[] = legacyPastToMaterialize.map((c) => ({
      user_id: user.id,
      card_id: cardId,
      period_month: c.period_month,
      closing_date: c.closing_date,
      due_date: c.due_date,
      status: c.cycleStatus === 'pagado' ? 'paid' : 'open',
      amount_paid: c.amount_paid,
      paid_at: c.paid_at,
    }))

    await supabase.from('card_cycles').upsert(
      cyclesToUpsert,
      { onConflict: 'card_id,period_month', ignoreDuplicates: true }
    )
  }

  // Upcoming = next month's cycle (for "Próximo cierre" in config)
  const upcomingCycle = enriched.find((c) => c.period_month.substring(0, 7) > currentMonth) ?? null

  // Resúmenes: current + past, only if have gastos or are paid.
  const resumenes = enriched.filter((c) => {
    if (c.period_month.substring(0, 7) > currentMonth) return false
    return c.amount > 0 || c.cycleStatus === 'pagado'
  })

  return (
    <CardDetailClient
      card={card as Card}
      accounts={(accounts ?? []) as Account[]}
      resumenes={resumenes}
      upcomingClosingDate={upcomingCycle?.closing_date ?? null}
      expenses={(expenses ?? []) as Expense[]}
    />
  )
}
