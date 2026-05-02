import { addMonths } from '@/lib/dates'
import { buildCycleDate } from '@/lib/card-cycles'
import type { createClient } from '@/lib/supabase/server'
import type { Card, CardCycle } from '@/types/database'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type CardCycleAssignment = {
  card_cycle_id: string
  cycle_date: string
  period_month: string
}

function getCyclePeriodMonthForDate(card: Pick<Card, 'closing_day'>, date: string): string {
  const periodMonth = date.substring(0, 7)
  const closingDate = buildCycleDate(periodMonth, card.closing_day ?? 1)
  return date.substring(0, 10) <= closingDate ? periodMonth : addMonths(periodMonth, 1)
}

function buildCyclePayload(userId: string, card: Card, periodMonth: string) {
  const closingDate = buildCycleDate(periodMonth, card.closing_day ?? 1)
  const dueMonth = addMonths(periodMonth, 1)
  const dueDate = buildCycleDate(dueMonth, card.due_day ?? Math.min((card.closing_day ?? 1) + 10, 31))

  return {
    user_id: userId,
    card_id: card.id,
    period_month: `${periodMonth}-01`,
    closing_date: closingDate,
    due_date: dueDate,
    status: 'open' as const,
  }
}

export async function resolveCardCycleAssignments({
  supabase,
  userId,
  cardId,
  baseDate,
  installments,
}: {
  supabase: SupabaseClient
  userId: string
  cardId: string | null
  baseDate: string
  installments: number
}): Promise<CardCycleAssignment[]> {
  if (!cardId || installments < 1) return []

  const { data: card, error: cardError } = await supabase
    .from('cards')
    .select('*')
    .eq('id', cardId)
    .eq('user_id', userId)
    .eq('archived', false)
    .single()

  if (cardError || !card) {
    throw new Error('Card not found')
  }

  const basePeriodMonth = getCyclePeriodMonthForDate(card as Card, baseDate)
  const periodMonths = Array.from({ length: installments }, (_, i) => addMonths(basePeriodMonth, i))
  const payloads = periodMonths.map((periodMonth) => buildCyclePayload(userId, card as Card, periodMonth))

  // Insert only — never overwrite existing cycles (closing_date/due_date would be corrupted)
  const { error: upsertError } = await supabase
    .from('card_cycles')
    .upsert(payloads, { onConflict: 'card_id,period_month', ignoreDuplicates: true })

  if (upsertError) throw upsertError

  const { data: cycles, error: cycleError } = await supabase
    .from('card_cycles')
    .select('*')
    .eq('card_id', card.id)
    .in('period_month', periodMonths.map((m) => `${m}-01`))

  if (cycleError) throw cycleError

  const cycleByMonth = new Map(
    ((cycles ?? []) as CardCycle[]).map((cycle) => [cycle.period_month.substring(0, 7), cycle]),
  )

  return periodMonths.map((periodMonth) => {
    const cycle = cycleByMonth.get(periodMonth)
    if (!cycle) throw new Error(`Card cycle missing for ${periodMonth}`)
    return {
      card_cycle_id: cycle.id,
      cycle_date: cycle.closing_date,
      period_month: periodMonth,
    }
  })
}
