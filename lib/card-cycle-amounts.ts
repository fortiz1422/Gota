import type { CardCycle, CardCycleAmount, Currency } from '@/types/database'

export type EffectiveCardCycleState = {
  status: CardCycleAmount['status']
  amount_draft: number | null
  amount_paid: number | null
  paid_at: string | null
}

export type CardCycleAmountsMap = Map<string, Partial<Record<Currency, CardCycleAmount>>>

export function isMissingCardCycleAmountsTableError(message: string | undefined): boolean {
  return !!message && message.toLowerCase().includes('card_cycle_amounts')
}

export function buildCardCycleAmountsMap(rows: CardCycleAmount[]): CardCycleAmountsMap {
  const map: CardCycleAmountsMap = new Map()
  for (const row of rows) {
    const current = map.get(row.card_cycle_id) ?? {}
    current[row.currency] = row
    map.set(row.card_cycle_id, current)
  }
  return map
}

export function getEffectiveCardCycleState(
  cycle: Pick<CardCycle, 'id' | 'status' | 'amount_draft' | 'amount_paid' | 'paid_at'>,
  currency: Currency,
  amountsMap?: CardCycleAmountsMap,
): EffectiveCardCycleState {
  const statesByCurrency = cycle.id ? amountsMap?.get(cycle.id) : undefined
  const state = statesByCurrency?.[currency]

  if (statesByCurrency && !state) {
    return {
      status: 'open',
      amount_draft: null,
      amount_paid: null,
      paid_at: null,
    }
  }

  return {
    status: state?.status ?? cycle.status,
    amount_draft: state?.amount_draft ?? cycle.amount_draft,
    amount_paid: state?.amount_paid ?? cycle.amount_paid,
    paid_at: state?.paid_at ?? cycle.paid_at,
  }
}

export function withEffectiveCardCycleState<T extends CardCycle>(
  cycle: T,
  currency: Currency,
  amountsMap?: CardCycleAmountsMap,
): T {
  return {
    ...cycle,
    ...getEffectiveCardCycleState(cycle, currency, amountsMap),
  }
}
