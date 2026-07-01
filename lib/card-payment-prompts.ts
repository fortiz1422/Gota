import { buildEnrichedCardCycles, type EnrichedCycle } from '@/lib/card-summaries'
import { addMonths, getCurrentMonth } from '@/lib/dates'
import type { CardCycleAmountsMap } from '@/lib/card-cycle-amounts'
import type { Card, CardCycle, Currency, Expense } from '@/types/database'

export type CardPaymentPromptBlock = {
  currency: Currency
  cycle: EnrichedCycle
}

export type CardPaymentPromptCandidate = {
  key: string
  card: Card
  periodMonth: string
  closingDate: string
  dueDate: string
  blocks: CardPaymentPromptBlock[]
}

type BuildCardPaymentPromptCandidatesParams = {
  cards: Card[]
  storedCycles: CardCycle[]
  expenses: Expense[]
  cycleAmountsMap?: CardCycleAmountsMap
  selectedMonth?: string
  isCurrentMonth: boolean
  today: string
}

function getPromptPeriodMonths(selectedMonth = getCurrentMonth()): string[] {
  return [addMonths(selectedMonth, 1), selectedMonth, addMonths(selectedMonth, -1), addMonths(selectedMonth, -2)]
}

function buildCandidateKey(cardId: string, periodMonth: string): string {
  return `${cardId}:${periodMonth.substring(0, 7)}`
}

function isPromptableCycle(cycle: EnrichedCycle): boolean {
  return (
    cycle.remaining_amount > 0 &&
    (cycle.cycleStatus === 'cerrado' || cycle.cycleStatus === 'vencido')
  )
}

function buildCardCandidates(params: {
  card: Card
  storedCycles: CardCycle[]
  expenses: Expense[]
  cycleAmountsMap?: CardCycleAmountsMap
  periodMonths: string[]
  today: string
}): CardPaymentPromptCandidate[] {
  const { card, storedCycles, expenses, cycleAmountsMap, periodMonths, today } = params
  if (card.closing_day === null || card.due_day === null) return []

  const byCurrency: Record<Currency, EnrichedCycle[]> = {
    ARS: buildEnrichedCardCycles({
      card,
      storedCycles,
      expenses,
      periodMonths,
      currency: 'ARS',
      cycleAmountsMap,
      today,
    }),
    USD: buildEnrichedCardCycles({
      card,
      storedCycles,
      expenses,
      periodMonths,
      currency: 'USD',
      cycleAmountsMap,
      today,
    }),
  }

  const grouped = new Map<string, CardPaymentPromptCandidate>()

  for (const currency of ['ARS', 'USD'] as const) {
    for (const cycle of byCurrency[currency]) {
      if (!isPromptableCycle(cycle)) continue

      const periodMonth = cycle.period_month.substring(0, 7)
      const key = buildCandidateKey(card.id, periodMonth)
      const existing = grouped.get(key)
      const block = { currency, cycle }

      if (existing) {
        existing.blocks.push(block)
      } else {
        grouped.set(key, {
          key,
          card,
          periodMonth,
          closingDate: cycle.closing_date,
          dueDate: cycle.due_date,
          blocks: [block],
        })
      }
    }
  }

  return [...grouped.values()]
}

export function buildCardPaymentPromptCandidates({
  cards,
  storedCycles,
  expenses,
  cycleAmountsMap,
  selectedMonth = getCurrentMonth(),
  isCurrentMonth,
  today,
}: BuildCardPaymentPromptCandidatesParams): CardPaymentPromptCandidate[] {
  if (!isCurrentMonth) return []

  const periodMonths = getPromptPeriodMonths(selectedMonth)

  return cards
    .flatMap((card) =>
      buildCardCandidates({
        card,
        storedCycles: storedCycles.filter((cycle) => cycle.card_id === card.id),
        expenses: expenses.filter((expense) => expense.card_id === card.id),
        cycleAmountsMap,
        periodMonths,
        today,
      }),
    )
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) ||
        a.closingDate.localeCompare(b.closingDate) ||
        a.card.created_at.localeCompare(b.card.created_at),
    )
}

