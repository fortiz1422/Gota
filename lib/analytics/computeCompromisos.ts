import { buildCycleDate, buildLegacyCardCycle } from '@/lib/card-cycles'
import { addMonths } from '@/lib/dates'
import { todayAR } from '@/lib/format'
import { calcularMontoResumen } from '@/lib/analytics/computeResumen'
import type { Expense, Card, CardCycle, Subscription } from '@/types/database'

// ─── Types ──────────────────────────────────────────────────────────────────

export type PendingSub = {
  description: string
  amount: number
  dayOfMonth: number
}

export type PendingDebtCycle = {
  periodMonth: string          // 'YYYY-MM'
  amount: number
  dueDate: string              // 'YYYY-MM-DD'
  cycleStatus: 'cerrado' | 'vencido'
}

export type CompromisoTarjeta = {
  id: string
  name: string
  closingDay: number | null
  dueDay: number | null

  // Hero engine compatibility (current month only; 0/null in historical)
  currentSpend: number
  daysUntilClosing: number | null

  // Debt: sum of all unpaid closed cycles for this card
  debtTotal: number
  debtCycles: PendingDebtCycle[]

  // Dominant status to drive display
  cycleStatus: 'en_curso' | 'cerrado' | 'vencido' | 'pagado' | null

  // Most relevant due date for the dominant cycle
  dueDate: string | null
  daysUntilDue: number | null

  // Payment info (when cycleStatus === 'pagado')
  amountPaid: number | null
  paidAt: string | null

  // Pending subscriptions (current month en_curso only)
  pendingSubs: PendingSub[]
}

export type CompromisosData = {
  /** 'current' = live debt view; 'historical' = resúmenes del mes seleccionado */
  mode: 'current' | 'historical'
  /** Sum of unpaid debt across all cards */
  totalDebt: number
  /** totalDebt as % of monthly income (null if no income set) */
  pctComprometido: number | null
  ingresoMes: number | null
  tarjetas: CompromisoTarjeta[]
  /** Cards without due_day — can't appear in historical view */
  tarjetasSinVencimiento: { id: string; name: string }[]
  hasCards: boolean
  hasCreditExpenses: boolean
  // Legacy aliases kept for hero engine compatibility
  totalComprometido: number
  unassignedCreditSpend: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addOneDay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Positive = toDate is in the future relative to fromDate */
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
    (c) => c.card_id === card.id && c.period_month.substring(0, 7) === prevMonth,
  )
  const prevClosingDate = prevCycle
    ? prevCycle.closing_date
    : buildCycleDate(prevMonth, card.closing_day)
  return addOneDay(prevClosingDate)
}

function computeCycleAmount(
  cycle: CardCycle,
  card: Card,
  expenses: Expense[],
  allCycles: CardCycle[],
): number {
  if (cycle.amount_paid !== null) return cycle.amount_paid
  if (cycle.amount_draft !== null) return cycle.amount_draft
  const periodFrom = getPeriodFrom(cycle, card, allCycles)
  return calcularMontoResumen(
    expenses,
    card.id,
    new Date(`${periodFrom}T12:00:00Z`),
    new Date(`${cycle.closing_date}T12:00:00Z`),
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function computeCompromisos(
  /** 3 months of CREDIT expenses (excl. Pago de Tarjetas) */
  expenses: Expense[],
  cards: Card[],
  /** All non-paid card_cycles + paid cycles with due_date in selectedMonth */
  cardCycles: CardCycle[],
  ingresoMes: number | null,
  selectedMonth: string,   // 'YYYY-MM'
  isCurrentMonth: boolean,
  subscriptions: Subscription[],
): CompromisosData {
  const today = todayAR()
  const hasCards = cards.length > 0
  const hasCreditExpenses = expenses.length > 0
  const tarjetasSinVencimiento: { id: string; name: string }[] = []
  const tarjetas: CompromisoTarjeta[] = []

  // ── Current month: show live debt + en_curso context ─────────────────────
  if (isCurrentMonth) {
    for (const card of cards) {
      const forThisCard = cardCycles.filter((c) => c.card_id === card.id)
      const unpaid = forThisCard.filter((c) => c.status !== 'paid')
      const paidThisMonth = forThisCard.find(
        (c) => c.status === 'paid' && c.due_date.startsWith(selectedMonth),
      )

      let currentSpend = 0
      let daysUntilClosing: number | null = null
      let enCursoClosingDay: number | null = null
      let foundEnCurso = false
      const debtCycles: PendingDebtCycle[] = []
      const pendingSubs: PendingSub[] = []

      for (const cycle of unpaid) {
        if (cycle.closing_date >= today) {
          // En curso — compute live spend within this cycle's date range
          foundEnCurso = true
          const periodFrom = getPeriodFrom(cycle, card, cardCycles)
          currentSpend = calcularMontoResumen(
            expenses,
            card.id,
            new Date(`${periodFrom}T12:00:00Z`),
            new Date(`${cycle.closing_date}T12:00:00Z`),
          )
          daysUntilClosing = daysDiff(today, cycle.closing_date)
          enCursoClosingDay = parseInt(cycle.closing_date.substring(8, 10), 10)
        } else {
          // Closed — cerrado if due_date is still future, vencido if past
          const cs: 'cerrado' | 'vencido' = cycle.due_date < today ? 'vencido' : 'cerrado'
          debtCycles.push({
            periodMonth: cycle.period_month.substring(0, 7),
            amount: computeCycleAmount(cycle, card, expenses, cardCycles),
            dueDate: cycle.due_date,
            cycleStatus: cs,
          })
        }
      }

      // Fallback: no stored en_curso cycle — build from card config
      if (!foundEnCurso && card.closing_day !== null) {
        const legacy = buildLegacyCardCycle(card, selectedMonth)
        if (legacy.closing_date >= today) {
          const periodFrom = getPeriodFrom(legacy, card, cardCycles)
          currentSpend = calcularMontoResumen(
            expenses,
            card.id,
            new Date(`${periodFrom}T12:00:00Z`),
            new Date(`${legacy.closing_date}T12:00:00Z`),
          )
          daysUntilClosing = daysDiff(today, legacy.closing_date)
          enCursoClosingDay = parseInt(legacy.closing_date.substring(8, 10), 10)
        }
      }

      // Pending subscriptions before the en_curso closing day
      if (enCursoClosingDay !== null) {
        const todayDay = parseInt(today.substring(8, 10), 10)
        subscriptions
          .filter(
            (s) =>
              s.card_id === card.id &&
              s.is_active &&
              s.day_of_month > todayDay &&
              s.day_of_month <= enCursoClosingDay!,
          )
          .forEach((s) =>
            pendingSubs.push({ description: s.description, amount: s.amount, dayOfMonth: s.day_of_month }),
          )
      }

      const debtTotal = debtCycles.reduce((s, c) => s + c.amount, 0)

      // Determine dominant status: vencido > cerrado > pagado > en_curso
      let cycleStatus: CompromisoTarjeta['cycleStatus']
      let dueDate: string | null = null
      let daysUntilDue: number | null = null
      let amountPaid: number | null = null
      let paidAt: string | null = null

      if (debtCycles.some((c) => c.cycleStatus === 'vencido')) {
        cycleStatus = 'vencido'
        const oldest = debtCycles
          .filter((c) => c.cycleStatus === 'vencido')
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
        dueDate = oldest?.dueDate ?? null
      } else if (debtCycles.some((c) => c.cycleStatus === 'cerrado')) {
        cycleStatus = 'cerrado'
        const soonest = debtCycles
          .filter((c) => c.cycleStatus === 'cerrado')
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
        dueDate = soonest?.dueDate ?? null
      } else if (paidThisMonth) {
        cycleStatus = 'pagado'
        amountPaid = paidThisMonth.amount_paid
        paidAt = paidThisMonth.paid_at
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

    // Sort: vencido → cerrado → en_curso → pagado; within group by debt desc
    const order = { vencido: 0, cerrado: 1, en_curso: 2, pagado: 3 } as const
    tarjetas.sort((a, b) => {
      const oa = order[a.cycleStatus ?? 'en_curso']
      const ob = order[b.cycleStatus ?? 'en_curso']
      return oa !== ob ? oa - ob : b.debtTotal - a.debtTotal
    })

    const totalDebt = tarjetas.reduce((s, t) => s + t.debtTotal, 0)
    const pctComprometido =
      ingresoMes && ingresoMes > 0 ? Math.round((totalDebt / ingresoMes) * 100) : null

    return {
      mode: 'current',
      totalDebt,
      pctComprometido,
      ingresoMes,
      tarjetas,
      tarjetasSinVencimiento,
      hasCards,
      hasCreditExpenses,
      totalComprometido: totalDebt,
      unassignedCreditSpend: 0,
    }
  }

  // ── Historical month: show cycles due in selectedMonth ───────────────────
  for (const card of cards) {
    // Cards without due_day can't be matched by due_date — surface as nudge
    if (!card.due_day) {
      tarjetasSinVencimiento.push({ id: card.id, name: card.name })
      continue
    }

    const cycle = cardCycles.find(
      (c) => c.card_id === card.id && c.due_date.startsWith(selectedMonth),
    )

    // No cycle recorded for this month — skip silently
    if (!cycle) continue

    const amount = computeCycleAmount(cycle, card, expenses, cardCycles)
    const dueDate = cycle.due_date
    const daysUntilDue = daysDiff(today, dueDate)

    if (cycle.status === 'paid') {
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
        amountPaid: cycle.amount_paid,
        paidAt: cycle.paid_at,
        pendingSubs: [],
      })
    } else {
      const cs: 'cerrado' | 'vencido' = cycle.due_date < today ? 'vencido' : 'cerrado'
      if (amount === 0) continue   // ciclo sin deuda real — no mostrar en histórico
      tarjetas.push({
        id: card.id,
        name: card.name,
        closingDay: card.closing_day,
        dueDay: card.due_day,
        currentSpend: 0,
        daysUntilClosing: null,
        debtTotal: amount,
        debtCycles: [{ periodMonth: cycle.period_month.substring(0, 7), amount, dueDate, cycleStatus: cs }],
        cycleStatus: cs,
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
    const oa = histOrder[a.cycleStatus as keyof typeof histOrder] ?? 1
    const ob = histOrder[b.cycleStatus as keyof typeof histOrder] ?? 1
    return oa !== ob ? oa - ob : b.debtTotal - a.debtTotal
  })

  const totalDebt = tarjetas.reduce((s, t) => s + t.debtTotal, 0)
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
  }
}
