import type { Expense, Card } from '@/types/database'

export type CompromisoTarjeta = {
  id: string
  name: string
  closingDay: number | null
  currentSpend: number
  nextCycleSpend: number
  daysUntilClosing: number | null
}

export type CompromisosData = {
  totalComprometido: number
  pctComprometido: number | null
  ingresoMes: number | null
  tarjetas: CompromisoTarjeta[]
  hasCards: boolean
  hasCreditExpenses: boolean
  unassignedCreditSpend: number
}

export function computeCompromisos(
  expenses: Expense[],
  cards: Card[],
  dayOfMonth: number,
  ingresoMes: number | null,
): CompromisosData {
  const creditExpenses = expenses.filter((e) => e.payment_method === 'CREDIT')
  const hasCreditExpenses = creditExpenses.length > 0
  const hasCards = cards.length > 0

  // Group credit expenses by card_id
  const byCard: Record<string, Expense[]> = {}
  let unassignedCreditSpend = 0

  for (const e of creditExpenses) {
    if (!e.card_id) {
      unassignedCreditSpend += e.amount
    } else {
      if (!byCard[e.card_id]) byCard[e.card_id] = []
      byCard[e.card_id].push(e)
    }
  }

  const tarjetas: CompromisoTarjeta[] = cards.map((card) => {
    const cardExpenses = byCard[card.id] ?? []
    const closingDay = card.closing_day ?? null
    let currentSpend = 0
    let nextCycleSpend = 0

    for (const e of cardExpenses) {
      const expDay = parseInt(e.date.substring(8, 10), 10)
      if (closingDay === null || expDay <= closingDay) {
        currentSpend += e.amount
      } else {
        nextCycleSpend += e.amount
      }
    }

    let daysUntilClosing: number | null = null
    if (closingDay !== null) {
      const diff = closingDay - dayOfMonth
      daysUntilClosing = diff
    }

    return {
      id: card.id,
      name: card.name,
      closingDay,
      currentSpend,
      nextCycleSpend,
      daysUntilClosing,
    }
  })

  // totalComprometido = currentSpend sum of all cards + unassigned
  const totalComprometido =
    tarjetas.reduce((s, t) => s + t.currentSpend, 0) + unassignedCreditSpend

  const pctComprometido =
    ingresoMes && ingresoMes > 0
      ? Math.round((totalComprometido / ingresoMes) * 100)
      : null

  return {
    totalComprometido,
    pctComprometido,
    ingresoMes,
    tarjetas,
    hasCards,
    hasCreditExpenses,
    unassignedCreditSpend,
  }
}
