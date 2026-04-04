import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { defaultCyclePeriodMonths, getUpcomingCycle, mergeResolvedCycles } from '@/lib/card-cycles'
import { getCurrentMonth } from '@/lib/dates'
import type { Card, CardCycle } from '@/types/database'

function isMissingTableError(message: string | undefined): boolean {
  return !!message && message.toLowerCase().includes('card_cycles')
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cardId = searchParams.get('card_id')

  if (!cardId) {
    return NextResponse.json({ error: 'card_id is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: card, error: cardError } = await supabase
    .from('cards')
    .select('*')
    .eq('id', cardId)
    .eq('user_id', user.id)
    .eq('archived', false)
    .single()

  if (cardError || !card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  }

  const currentMonth = getCurrentMonth()
  const periodMonths = defaultCyclePeriodMonths(currentMonth)
  let storedCycles: CardCycle[] = []

  const { data: cyclesData, error: cyclesError } = await supabase
    .from('card_cycles')
    .select('*')
    .eq('user_id', user.id)
    .eq('card_id', cardId)
    .gte('period_month', `${periodMonths[periodMonths.length - 1]}-01`)
    .lte('period_month', `${periodMonths[0]}-01`)
    .order('period_month', { ascending: false })

  if (cyclesError && !isMissingTableError(cyclesError.message)) {
    return NextResponse.json({ error: cyclesError.message }, { status: 500 })
  }

  if (!cyclesError) {
    storedCycles = (cyclesData ?? []) as CardCycle[]
  }

  const cycles = mergeResolvedCycles(card as Card, storedCycles, periodMonths)
  const upcomingCycle = getUpcomingCycle(cycles)

  return NextResponse.json({
    cycles,
    upcomingCycle,
    usesLegacyFallback: cycles.some((cycle) => cycle.source === 'legacy'),
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { card_id, period_month, closing_date, due_date, status = 'open' } = body

  if (!card_id || !period_month || !closing_date || !due_date) {
    return NextResponse.json({ error: 'card_id, period_month, closing_date and due_date are required' }, { status: 400 })
  }

  const { data: card, error: cardError } = await supabase
    .from('cards')
    .select('id')
    .eq('id', card_id)
    .eq('user_id', user.id)
    .eq('archived', false)
    .single()

  if (cardError || !card) {
    return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('card_cycles')
    .upsert({
      user_id: user.id,
      card_id,
      period_month: `${period_month}-01`,
      closing_date,
      due_date,
      status,
    }, { onConflict: 'card_id,period_month' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}

