import { calcularMontoResumen } from '@/lib/analytics/computeResumen'
import { buildCycleDate, mergeResolvedCycles } from '@/lib/card-cycles'
import { getRemainingCardCycleAmount, hasPartialCardCyclePayment } from '@/lib/card-cycle-payments'
import { addMonths } from '@/lib/dates'
import { todayAR } from '@/lib/format'
import type { Card, CardCycle, Expense } from '@/types/database'

export type EnrichedCycle = {
  id: string
  source: 'stored' | 'legacy'
  period_month: string
  period_from: string
  closing_date: string
  due_date: string
  cycleStatus: 'en_curso' | 'cerrado' | 'vencido' | 'pagado'
  amount: number
  paid_at: string | null
  amount_paid: number | null
  remaining_amount: number
  has_partial_payment: boolean
  changed_after_payment: boolean
}

function addOneDay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function buildEnrichedCardCycles({
  card,
  storedCycles,
  expenses,
  periodMonths,
  today = todayAR(),
}: {
  card: Card
  storedCycles: CardCycle[]
  expenses: Expense[]
  periodMonths: string[]
  today?: string
}): EnrichedCycle[] {
  const resolvedCycles = mergeResolvedCycles(card, storedCycles, periodMonths)

  return resolvedCycles.map((cycle, i) => {
    let periodFrom: string
    const prevCycle = resolvedCycles[i + 1]

    if (prevCycle) {
      periodFrom = addOneDay(prevCycle.closing_date)
    } else {
      const prevMonth = addMonths(cycle.period_month.substring(0, 7), -1)
      const prevClosing = buildCycleDate(prevMonth, card.closing_day)
      periodFrom = addOneDay(prevClosing)
    }

    const amount =
      cycle.amount_draft != null
        ? cycle.amount_draft
        : calcularMontoResumen(
            expenses,
            card.id,
            new Date(`${periodFrom}T12:00:00Z`),
            new Date(`${cycle.closing_date}T12:00:00Z`),
          )

    const paidAt = cycle.paid_at
    const isPaid = paidAt !== null || cycle.status === 'paid'
    const remainingAmount = getRemainingCardCycleAmount(amount, cycle.amount_paid)
    const hasPartialPayment = hasPartialCardCyclePayment(amount, cycle.amount_paid)
    const changedAfterPayment =
      paidAt != null &&
      expenses.some(
        (expense) =>
          expense.card_id === card.id &&
          expense.payment_method === 'CREDIT' &&
          expense.category !== 'Pago de Tarjetas' &&
          expense.date >= periodFrom &&
          expense.date <= cycle.closing_date &&
          (expense.created_at > paidAt || expense.updated_at > paidAt)
      )
    const cycleStatus: EnrichedCycle['cycleStatus'] = isPaid
      ? 'pagado'
      : cycle.closing_date >= today
        ? 'en_curso'
        : cycle.due_date >= today
          ? 'cerrado'
          : 'vencido'

    return {
      id: cycle.id,
      source: cycle.source,
      period_month: cycle.period_month,
      period_from: periodFrom,
      closing_date: cycle.closing_date,
      due_date: cycle.due_date,
      cycleStatus,
      amount,
      paid_at: paidAt,
      amount_paid: cycle.amount_paid,
      remaining_amount: remainingAmount,
      has_partial_payment: hasPartialPayment,
      changed_after_payment: changedAfterPayment,
    }
  })
}

export function sumPendingResumenes(cycles: EnrichedCycle[], currentMonth: string): number {
  return cycles
    .filter((cycle) => cycle.period_month.substring(0, 7) <= currentMonth)
    .filter((cycle) => cycle.cycleStatus === 'cerrado' || cycle.cycleStatus === 'vencido')
    .reduce((sum, cycle) => sum + cycle.remaining_amount, 0)
}
