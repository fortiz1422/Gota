import { calcularMontoResumen } from '@/lib/analytics/computeResumen'
import { getEffectiveCardCycleState, type CardCycleAmountsMap } from '@/lib/card-cycle-amounts'
import { getAccumulatedPaidAmount, getRemainingCardCycleAmount } from '@/lib/card-cycle-payments'
import { buildCycleDate, buildLegacyCardCycle } from '@/lib/card-cycles'
import { addMonths } from '@/lib/dates'
import { todayAR } from '@/lib/format'
import { isCreditAccruedExpense } from '@/lib/movement-classification'
import type { Card, CardCycle, Currency, Expense, Subscription } from '@/types/database'

export type PendingSub = {
  description: string
  amount: number
  dayOfMonth: number
}

export type PendingDebtCycle = {
  periodMonth: string
  amount: number
  dueDate: string
  cycleStatus: 'cerrado' | 'vencido'
}

export type CompromisoTarjeta = {
  id: string
  name: string
  closingDay: number | null
  dueDay: number | null
  currentSpend: number
  daysUntilClosing: number | null
  debtTotal: number
  debtCycles: PendingDebtCycle[]
  cycleStatus: 'en_curso' | 'cerrado' | 'vencido' | 'pagado' | null
  dueDate: string | null
  daysUntilDue: number | null
  amountPaid: number | null
  paidAt: string | null
  pendingSubs: PendingSub[]
}

export type CompromisosData = {
  mode: 'current' | 'historical'
  totalDebt: number
  pctComprometido: number | null
  ingresoMes: number | null
  tarjetas: CompromisoTarjeta[]
  tarjetasSinVencimiento: { id: string; name: string }[]
  hasCards: boolean
  hasCreditExpenses: boolean
  totalComprometido: number
  unassignedCreditSpend: number
  totalAPagar: number
  totalEnCurso: number
}

function addOneDay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysDiff(fromDate: string, toDate: string): number {
  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d).getTime()
  }
  return Math.round((parse(toDate) - parse(fromDate)) / 86_400_000)
}

function getPeriodFrom(cycle: CardCycle, card: Card, allCycles: CardCycle[]): string {
  const prevMonth = addMonths(cycle.period_month.substring(0, 7), -1)
  const prevCycle = allCycles.find(
    (candidate) => candidate.card_id === card.id && candidate.period_month.substring(0, 7) === prevMonth,
  )
  const prevClosingDate = prevCycle
    ? prevCycle.closing_date
    : buildCycleDate(prevMonth, card.closing_day)
  return addOneDay(prevClosingDate)
}

function computeStatementAmount(
  cycle: CardCycle,
  card: Card,
  expenses: Expense[],
  allCycles: CardCycle[],
  currency: Currency,
  cycleAmountsMap?: CardCycleAmountsMap,
): number {
  const cycleState = getEffectiveCardCycleState(cycle, currency, cycleAmountsMap)
  if (cycleState.amount_draft !== null) return cycleState.amount_draft

  const periodFrom = getPeriodFrom(cycle, card, allCycles)
  return calcularMontoResumen(
    expenses,
    card.id,
    new Date(`${periodFrom}T12:00:00Z`),
    new Date(`${cycle.closing_date}T12:00:00Z`),
    cycle.id,
    currency,
  )
}

function computeRemainingCycleAmount(
  cycle: CardCycle,
  card: Card,
  expenses: Expense[],
  allCycles: CardCycle[],
  currency: Currency,
  cycleAmountsMap?: CardCycleAmountsMap,
): number {
  const cycleState = getEffectiveCardCycleState(cycle, currency, cycleAmountsMap)
  const statementAmount = computeStatementAmount(
    cycle,
    card,
    expenses,
    allCycles,
    currency,
    cycleAmountsMap,
  )
  return getRemainingCardCycleAmount(statementAmount, cycleState.amount_paid)
}

function isPaidCycle(
  cycle: CardCycle,
  currency: Currency,
  cycleAmountsMap?: CardCycleAmountsMap,
): boolean {
  const cycleState = getEffectiveCardCycleState(cycle, currency, cycleAmountsMap)
  return cycleState.status === 'paid' || cycleState.paid_at !== null
}

export function computeCompromisos(
  expenses: Expense[],
  cards: Card[],
  cardCycles: CardCycle[],
  ingresoMes: number | null,
  selectedMonth: string,
  isCurrentMonth: boolean,
  subscriptions: Subscription[],
  currency: Currency,
  cycleAmountsMap?: CardCycleAmountsMap,
): CompromisosData {
  const today = todayAR()
  const hasCards = cards.length > 0
  const hasCreditExpenses = expenses.some((expense) => isCreditAccruedExpense(expense))
  const tarjetasSinVencimiento: { id: string; name: string }[] = []
  const tarjetas: CompromisoTarjeta[] = []

  if (isCurrentMonth) {
    for (const card of cards) {
      const forThisCard = cardCycles.filter((cycle) => cycle.card_id === card.id)
      const unpaid = forThisCard.filter((cycle) => !isPaidCycle(cycle, currency, cycleAmountsMap))
      const enCursoCycle =
        unpaid
          .filter((cycle) => cycle.closing_date >= today)
          .sort((a, b) => a.closing_date.localeCompare(b.closing_date))[0] ?? null
      const paidThisMonth = forThisCard.find(
        (cycle) => isPaidCycle(cycle, currency, cycleAmountsMap) && cycle.due_date.startsWith(selectedMonth),
      )

      let currentSpend = 0
      let daysUntilClosing: number | null = null
      let enCursoClosingDay: number | null = null
      let foundEnCurso = false
      const debtCycles: PendingDebtCycle[] = []
      const pendingSubs: PendingSub[] = []

      for (const cycle of unpaid) {
        if (cycle.closing_date >= today) {
          if (cycle !== enCursoCycle) continue

          foundEnCurso = true
          const periodFrom = getPeriodFrom(cycle, card, cardCycles)
          const liveSpend = calcularMontoResumen(
            expenses,
            card.id,
            new Date(`${periodFrom}T12:00:00Z`),
            new Date(`${cycle.closing_date}T12:00:00Z`),
            cycle.id,
            currency,
          )
          currentSpend = getRemainingCardCycleAmount(
            liveSpend,
            getEffectiveCardCycleState(cycle, currency, cycleAmountsMap).amount_paid,
          )
          daysUntilClosing = daysDiff(today, cycle.closing_date)
          enCursoClosingDay = parseInt(cycle.closing_date.substring(8, 10), 10)
        } else {
          const amount = computeRemainingCycleAmount(
            cycle,
            card,
            expenses,
            cardCycles,
            currency,
            cycleAmountsMap,
          )
          if (amount === 0) continue
          const cycleStatus: 'cerrado' | 'vencido' = cycle.due_date < today ? 'vencido' : 'cerrado'
          debtCycles.push({
            periodMonth: cycle.period_month.substring(0, 7),
            amount,
            dueDate: cycle.due_date,
            cycleStatus,
          })
        }
      }

      for (let mBack = 1; mBack <= 4; mBack += 1) {
        const prevMonth = addMonths(selectedMonth, -mBack)
        const hasCycle = forThisCard.some((cycle) => cycle.period_month.substring(0, 7) === prevMonth)
        if (hasCycle) continue

        const implicitCycle = buildLegacyCardCycle(card, prevMonth)
        if (implicitCycle.closing_date >= today) continue

        const amount = computeStatementAmount(
          implicitCycle,
          card,
          expenses,
          cardCycles,
          currency,
          cycleAmountsMap,
        )
        if (amount <= 0) continue

        const cycleStatus: 'cerrado' | 'vencido' = implicitCycle.due_date < today ? 'vencido' : 'cerrado'
        debtCycles.push({
          periodMonth: prevMonth,
          amount,
          dueDate: implicitCycle.due_date,
          cycleStatus,
        })
      }

      if (!foundEnCurso && card.closing_day !== null) {
        const legacy = buildLegacyCardCycle(card, selectedMonth)
        if (legacy.closing_date >= today) {
          const periodFrom = getPeriodFrom(legacy, card, cardCycles)
          const liveSpend = calcularMontoResumen(
            expenses,
            card.id,
            new Date(`${periodFrom}T12:00:00Z`),
            new Date(`${legacy.closing_date}T12:00:00Z`),
            legacy.id,
            currency,
          )
          currentSpend = getRemainingCardCycleAmount(
            liveSpend,
            getEffectiveCardCycleState(legacy, currency, cycleAmountsMap).amount_paid,
          )
          daysUntilClosing = daysDiff(today, legacy.closing_date)
          enCursoClosingDay = parseInt(legacy.closing_date.substring(8, 10), 10)
        }
      }

      if (enCursoClosingDay !== null) {
        const todayDay = parseInt(today.substring(8, 10), 10)
        subscriptions
          .filter(
            (subscription) =>
              subscription.card_id === card.id &&
              subscription.is_active &&
              subscription.day_of_month > todayDay &&
              subscription.day_of_month <= enCursoClosingDay,
          )
          .forEach((subscription) => {
            pendingSubs.push({
              description: subscription.description,
              amount: subscription.amount,
              dayOfMonth: subscription.day_of_month,
            })
          })
      }

      const debtTotal = debtCycles.reduce((sum, cycle) => sum + cycle.amount, 0)
      let cycleStatus: CompromisoTarjeta['cycleStatus']
      let dueDate: string | null = null
      let daysUntilDue: number | null = null
      let amountPaid: number | null = null
      let paidAt: string | null = null

      if (debtCycles.some((cycle) => cycle.cycleStatus === 'vencido')) {
        cycleStatus = 'vencido'
        dueDate = debtCycles
          .filter((cycle) => cycle.cycleStatus === 'vencido')
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]?.dueDate ?? null
      } else if (debtCycles.some((cycle) => cycle.cycleStatus === 'cerrado')) {
        cycleStatus = 'cerrado'
        dueDate = debtCycles
          .filter((cycle) => cycle.cycleStatus === 'cerrado')
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]?.dueDate ?? null
      } else if (paidThisMonth) {
        const paidState = getEffectiveCardCycleState(paidThisMonth, currency, cycleAmountsMap)
        cycleStatus = 'pagado'
        amountPaid = getAccumulatedPaidAmount(paidState.amount_paid)
        paidAt = paidState.paid_at
        dueDate = paidThisMonth.due_date
      } else {
        cycleStatus = 'en_curso'
      }

      if (dueDate) daysUntilDue = daysDiff(today, dueDate)

      tarjetas.push({
        id: card.id,
        name: card.name,
        closingDay: card.closing_day,
        dueDay: card.due_day,
        currentSpend,
        daysUntilClosing,
        debtTotal,
        debtCycles: debtCycles.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
        cycleStatus,
        dueDate,
        daysUntilDue,
        amountPaid,
        paidAt,
        pendingSubs,
      })
    }

    const order = { vencido: 0, cerrado: 1, en_curso: 2, pagado: 3 } as const
    tarjetas.sort((a, b) => {
      const left = order[a.cycleStatus ?? 'en_curso']
      const right = order[b.cycleStatus ?? 'en_curso']
      return left !== right ? left - right : b.debtTotal - a.debtTotal
    })

    const totalDebt = tarjetas.reduce((sum, tarjeta) => sum + tarjeta.debtTotal, 0)
    const totalEnCurso = tarjetas.reduce((sum, tarjeta) => sum + tarjeta.currentSpend, 0)
    const totalComprometido = tarjetas.reduce(
      (sum, tarjeta) => sum + tarjeta.debtTotal + tarjeta.currentSpend,
      0,
    )
    const pctComprometido =
      ingresoMes && ingresoMes > 0 ? Math.round((totalComprometido / ingresoMes) * 100) : null

    return {
      mode: 'current',
      totalDebt,
      pctComprometido,
      ingresoMes,
      tarjetas,
      tarjetasSinVencimiento,
      hasCards,
      hasCreditExpenses,
      totalComprometido,
      unassignedCreditSpend: 0,
      totalAPagar: totalDebt,
      totalEnCurso,
    }
  }

  for (const card of cards) {
    if (!card.due_day) {
      tarjetasSinVencimiento.push({ id: card.id, name: card.name })
      continue
    }

    const cycleCandidates = cardCycles.filter(
      (cycle) => cycle.card_id === card.id && cycle.due_date.startsWith(selectedMonth),
    )
    if (cycleCandidates.length === 0) continue

    const cycle =
      cycleCandidates.find((candidate) => isPaidCycle(candidate, currency, cycleAmountsMap)) ??
      cycleCandidates.sort((a, b) => b.due_date.localeCompare(a.due_date))[0]

    const cycleState = getEffectiveCardCycleState(cycle, currency, cycleAmountsMap)
    const statementAmount = computeStatementAmount(
      cycle,
      card,
      expenses,
      cardCycles,
      currency,
      cycleAmountsMap,
    )
    const amount = getRemainingCardCycleAmount(statementAmount, cycleState.amount_paid)
    const dueDate = cycle.due_date
    const daysUntilDue = daysDiff(today, dueDate)

    if (isPaidCycle(cycle, currency, cycleAmountsMap)) {
      tarjetas.push({
        id: card.id,
        name: card.name,
        closingDay: card.closing_day,
        dueDay: card.due_day,
        currentSpend: 0,
        daysUntilClosing: null,
        debtTotal: 0,
        debtCycles: [],
        cycleStatus: 'pagado',
        dueDate,
        daysUntilDue,
        amountPaid: getAccumulatedPaidAmount(cycleState.amount_paid),
        paidAt: cycleState.paid_at,
        pendingSubs: [],
      })
    } else {
      const cycleStatus: 'cerrado' | 'vencido' = cycle.due_date < today ? 'vencido' : 'cerrado'
      if (amount === 0) continue
      tarjetas.push({
        id: card.id,
        name: card.name,
        closingDay: card.closing_day,
        dueDay: card.due_day,
        currentSpend: 0,
        daysUntilClosing: null,
        debtTotal: amount,
        debtCycles: [{ periodMonth: cycle.period_month.substring(0, 7), amount, dueDate, cycleStatus }],
        cycleStatus,
        dueDate,
        daysUntilDue,
        amountPaid: null,
        paidAt: null,
        pendingSubs: [],
      })
    }
  }

  const histOrder = { vencido: 0, cerrado: 1, pagado: 2 } as const
  tarjetas.sort((a, b) => {
    const left = histOrder[a.cycleStatus as keyof typeof histOrder] ?? 1
    const right = histOrder[b.cycleStatus as keyof typeof histOrder] ?? 1
    return left !== right ? left - right : b.debtTotal - a.debtTotal
  })

  const totalDebt = tarjetas.reduce((sum, tarjeta) => sum + tarjeta.debtTotal, 0)
  const pctComprometido =
    ingresoMes && ingresoMes > 0 ? Math.round((totalDebt / ingresoMes) * 100) : null

  return {
    mode: 'historical',
    totalDebt,
    pctComprometido,
    ingresoMes,
    tarjetas,
    tarjetasSinVencimiento,
    hasCards,
    hasCreditExpenses,
    totalComprometido: totalDebt,
    unassignedCreditSpend: 0,
    totalAPagar: totalDebt,
    totalEnCurso: 0,
  }
}
