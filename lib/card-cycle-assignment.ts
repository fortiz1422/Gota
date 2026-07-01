import { addMonths } from '@/lib/dates'
import { buildCycleDate, resolveDueMonth } from '@/lib/card-cycles'
import type { createClient } from '@/lib/supabase/server'
import type { Card, CardCycle } from '@/types/database'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type CardCycleAssignment = {
  card_cycle_id: string
  cycle_date: string
  period_month: string
}

type CycleForAssignment = Pick<CardCycle, 'card_id' | 'period_month' | 'closing_date' | 'due_date'>

function addOneDay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function getCyclePeriodMonthForDate(
  card: Pick<Card, 'id' | 'closing_day'>,
  date: string,
  existingCycles: CycleForAssignment[] = [],
): string {
  const dateOnly = date.substring(0, 10)
  const cycles = existingCycles
    .filter((cycle) => cycle.card_id === card.id)
    .sort((a, b) => a.period_month.localeCompare(b.period_month))

  for (let i = 0; i < cycles.length; i += 1) {
    const cycle = cycles[i]
    const previousCycle = cycles[i - 1]
    const fallbackPreviousClosing = buildCycleDate(
      addMonths(cycle.period_month.substring(0, 7), -1),
      card.closing_day ?? 1,
    )
    const periodFrom = addOneDay(previousCycle?.closing_date ?? fallbackPreviousClosing)

    if (dateOnly >= periodFrom && dateOnly <= cycle.closing_date) {
      return cycle.period_month.substring(0, 7)
    }
  }

  const periodMonth = dateOnly.substring(0, 7)
  const closingDate = buildCycleDate(periodMonth, card.closing_day ?? 1)
  return dateOnly <= closingDate ? periodMonth : addMonths(periodMonth, 1)
}

function buildCyclePayload(
  userId: string,
  card: Card,
  periodMonth: string,
  knownCycles: CycleForAssignment[] = [],
) {
  const previousPeriodMonth = addMonths(periodMonth, -1)
  const previousCycle = knownCycles.find(
    (cycle) => cycle.card_id === card.id && cycle.period_month.substring(0, 7) === previousPeriodMonth,
  )
  const closingMonth =
    previousCycle && previousCycle.closing_date >= `${periodMonth}-01`
      ? addMonths(previousCycle.closing_date.substring(0, 7), 1)
      : periodMonth
  const closingDate = buildCycleDate(closingMonth, card.closing_day ?? 1)
  const dueMonth = resolveDueMonth(closingMonth, card.closing_day, card.due_day)
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

  const { data: existingCyclesData, error: existingCyclesError } = await supabase
    .from('card_cycles')
    .select('*')
    .eq('user_id', userId)
    .eq('card_id', card.id)

  if (existingCyclesError) throw existingCyclesError

  const existingCycles = (existingCyclesData ?? []) as CardCycle[]
  const basePeriodMonth = getCyclePeriodMonthForDate(card as Card, baseDate, existingCycles)
  const periodMonths = Array.from({ length: installments }, (_, i) => addMonths(basePeriodMonth, i))
  const knownCycles: CycleForAssignment[] = [...existingCycles]
  const payloads = periodMonths.map((periodMonth) => {
    const payload = buildCyclePayload(userId, card as Card, periodMonth, knownCycles)
    knownCycles.push(payload)
    return payload
  })

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
