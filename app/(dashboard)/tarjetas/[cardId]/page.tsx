import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { buildEnrichedCardCycles } from '@/lib/card-summaries'
import { addMonths, getCurrentMonth } from '@/lib/dates'
import { CardDetailClient } from './CardDetailClient'
import type { EnrichedCycle } from '@/lib/card-summaries'
import type { Account, Card, CardCycle, CardCycleInsert, Expense } from '@/types/database'

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

  const currentMonth = getCurrentMonth()
  const periodMonths: string[] = [addMonths(currentMonth, 1)]
  for (let i = 0; i <= 5; i++) periodMonths.push(addMonths(currentMonth, -i))

  const oldest = periodMonths[periodMonths.length - 1]
  const newest = periodMonths[0]

  const [{ data: accounts }, { data: storedCycles }, { data: expenses }] = await Promise.all([
    supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('archived', false)
      .neq('type', 'cash')
      .order('created_at', { ascending: true }),
    supabase
      .from('card_cycles')
      .select('*')
      .eq('user_id', user.id)
      .eq('card_id', cardId)
      .gte('period_month', `${oldest}-01`)
      .lte('period_month', `${newest}-01`)
      .order('period_month', { ascending: false }),
    supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .eq('card_id', cardId)
      .gte('date', `${addMonths(currentMonth, -7)}-01`),
  ])

  const enriched: EnrichedCycle[] = buildEnrichedCardCycles({
    card: card as Card,
    storedCycles: (storedCycles ?? []) as CardCycle[],
    expenses: (expenses ?? []) as Expense[],
    periodMonths,
  })

  const legacyPastToMaterialize = enriched.filter(
    (cycle) => cycle.source === 'legacy' && cycle.period_month.substring(0, 7) < currentMonth
  )
  if (legacyPastToMaterialize.length > 0) {
    const cyclesToUpsert: CardCycleInsert[] = legacyPastToMaterialize.map((cycle) => ({
      user_id: user.id,
      card_id: cardId,
      period_month: cycle.period_month,
      closing_date: cycle.closing_date,
      due_date: cycle.due_date,
      status: cycle.cycleStatus === 'pagado' ? 'paid' : 'open',
      amount_paid: cycle.amount_paid,
      paid_at: cycle.paid_at,
    }))

    void supabase.from('card_cycles').upsert(
      cyclesToUpsert,
      { onConflict: 'card_id,period_month', ignoreDuplicates: true }
    )
  }

  const upcomingCycle = enriched.find((cycle) => cycle.period_month.substring(0, 7) > currentMonth) ?? null

  const resumenes = enriched.filter((cycle) => {
    if (cycle.period_month.substring(0, 7) > currentMonth) return false
    return cycle.amount > 0 || cycle.cycleStatus === 'pagado'
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
