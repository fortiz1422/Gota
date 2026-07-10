import type { MonthlySeriesPoint } from '@/lib/analytics/analytics-overview'
import { addDays, diffDays } from './evidence'
import type {
  DataQuality,
  FinancialSnapshot,
  SnapshotGoal,
  SnapshotMovement,
  SnapshotPendingStatement,
  SnapshotRecurringIncome,
} from './types'

// ─── Progreso del mes ────────────────────────────────────────────────────────

export type MonthProgress = {
  elapsedRatio: number
  elapsedPct: number
  daysLeft: number
}

export function getMonthProgress(snapshot: FinancialSnapshot): MonthProgress {
  const elapsedRatio = snapshot.daysInMonth > 0 ? snapshot.dayOfMonth / snapshot.daysInMonth : 1
  return {
    elapsedRatio,
    elapsedPct: Math.round(elapsedRatio * 100),
    daysLeft: Math.max(0, snapshot.daysInMonth - snapshot.dayOfMonth),
  }
}

// ─── Same-day spend (observado + devengado, misma regla que Análisis) ───────

export type SameDaySpendFeature = {
  currentAmount: number
  baselineAmount: number | null
  baselineKind: 'previous_month' | 'rolling_average' | null
  baselineWindow: number
  deltaPct: number | null
  /** Gasto extraordinario del mes en curso excluido de la comparación. */
  extraordinaryExcluded: number
  dataQuality: DataQuality
}

function hasHistoricalData(point: MonthlySeriesPoint): boolean {
  return point.percibidoTotal > 0 || point.percibidoDevengadoTotal > 0
}

function comparablePreviousPoints(snapshot: FinancialSnapshot): MonthlySeriesPoint[] {
  return snapshot.monthlySeries.filter(
    (point) => point.month < snapshot.month && point.isComplete && hasHistoricalData(point),
  )
}

/**
 * Gasto extraordinario acumulado hasta el día comparable, por mes (moneda
 * base). Se resta del gasto observado y de los baselines: un gasto que el
 * usuario marcó como extraordinario no debe distorsionar el ritmo habitual.
 */
function sameDayExtraordinaryByMonth(snapshot: FinancialSnapshot): Map<string, number> {
  const comparisonDay = snapshot.comparisonDay ?? snapshot.dayOfMonth
  const totals = new Map<string, number>()
  for (const movement of snapshot.movements) {
    if (movement.kind !== 'gasto' || movement.isCardPayment) continue
    if (!movement.isExtraordinary) continue
    if (movement.currency !== snapshot.currency) continue
    if (Number(movement.date.slice(8, 10)) > comparisonDay) continue
    const month = movement.date.substring(0, 7)
    totals.set(month, (totals.get(month) ?? 0) + movement.amount)
  }
  return totals
}

export function computeSameDaySpend(snapshot: FinancialSnapshot): SameDaySpendFeature {
  const selectedPoint =
    snapshot.monthlySeries.find((point) => point.month === snapshot.month) ?? null
  const extraordinaryByMonth = sameDayExtraordinaryByMonth(snapshot)
  const extraordinaryExcluded = extraordinaryByMonth.get(snapshot.month) ?? 0
  const adjust = (month: string, value: number | null): number | null => {
    if (value === null) return null
    return Math.max(0, value - (extraordinaryByMonth.get(month) ?? 0))
  }
  const currentAmount =
    adjust(snapshot.month, selectedPoint?.sameDayPercibidoDevengadoTotal ?? 0) ?? 0
  const previousPoints = comparablePreviousPoints(snapshot)

  const insufficient: SameDaySpendFeature = {
    currentAmount,
    baselineAmount: null,
    baselineKind: null,
    baselineWindow: 0,
    deltaPct: null,
    extraordinaryExcluded,
    dataQuality: 'insufficient',
  }

  if (snapshot.comparisonDay === null || previousPoints.length === 0 || currentAmount <= 0) {
    return insufficient
  }

  if (previousPoints.length <= 2) {
    const previous = previousPoints[previousPoints.length - 1]
    const baselineAmount = adjust(previous.month, previous.sameDayPercibidoDevengadoTotal)
    if (baselineAmount === null || baselineAmount <= 0) return insufficient
    return {
      currentAmount,
      baselineAmount,
      baselineKind: 'previous_month',
      baselineWindow: 1,
      deltaPct: Math.round(((currentAmount - baselineAmount) / baselineAmount) * 100),
      extraordinaryExcluded,
      dataQuality: 'partial',
    }
  }

  const windowSize = Math.min(previousPoints.length, 6)
  const values = previousPoints
    .slice(-windowSize)
    .map((point) => adjust(point.month, point.sameDayPercibidoDevengadoTotal))
    .filter((value): value is number => value !== null && value > 0)
  if (values.length === 0) return insufficient

  const baselineAmount = values.reduce((sum, value) => sum + value, 0) / values.length
  return {
    currentAmount,
    baselineAmount,
    baselineKind: 'rolling_average',
    baselineWindow: values.length,
    deltaPct: Math.round(((currentAmount - baselineAmount) / baselineAmount) * 100),
    extraordinaryExcluded,
    // Si el fetch de gastos llegó a su límite, los meses más viejos pueden
    // estar incompletos: nunca reclamar calidad plena sobre esa base.
    dataQuality: snapshot.coverage.expenses.truncated ? 'partial' : 'ok',
  }
}

// ─── Ritmo de presupuesto por categoría ──────────────────────────────────────

export type BudgetPaceFeature = {
  category: string
  budgeted: number
  spent: number
  usedPct: number
  expectedPct: number
  projectedTotal: number
  overBudget: boolean
}

export function computeBudgetPace(snapshot: FinancialSnapshot): BudgetPaceFeature[] {
  if (!snapshot.budget.plan) return []
  const { elapsedRatio, elapsedPct } = getMonthProgress(snapshot)

  return snapshot.budget.items
    .filter((item) => item.amount > 0 && item.spentAmount > 0)
    .map((item) => {
      const usedPct = Math.round((item.spentAmount / item.amount) * 100)
      return {
        category: item.category,
        budgeted: item.amount,
        spent: item.spentAmount,
        usedPct,
        expectedPct: elapsedPct,
        projectedTotal:
          elapsedRatio > 0 ? Math.round(item.spentAmount / elapsedRatio) : item.spentAmount,
        overBudget: item.spentAmount >= item.amount,
      }
    })
    .sort((a, b) => b.usedPct - b.expectedPct - (a.usedPct - a.expectedPct))
}

// ─── Vencimientos de tarjeta ─────────────────────────────────────────────────

export type UpcomingCardDueFeature = SnapshotPendingStatement & {
  cardId: string
  cardName: string
  daysUntilDue: number
}

export function computeUpcomingCardDues(
  snapshot: FinancialSnapshot,
  withinDays = 7,
): UpcomingCardDueFeature[] {
  const dues: UpcomingCardDueFeature[] = []
  for (const card of snapshot.cards) {
    for (const statement of card.pendingStatements) {
      if (statement.amount <= 0) continue
      const daysUntilDue = diffDays(snapshot.referenceDate, statement.dueDate)
      if (statement.status !== 'vencido' && daysUntilDue > withinDays) continue
      dues.push({
        ...statement,
        cardId: card.cardId,
        cardName: card.cardName,
        daysUntilDue,
      })
    }
  }
  return dues.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

// ─── Liquidez vs compromisos próximos ────────────────────────────────────────

export type UpcomingCommitmentItem = {
  label: string
  amount: number
  date: string
  daysUntil: number
  source: 'card' | 'subscription'
}

export type LiquidityFeature = {
  /** Saldo Vivo en moneda base: la caja real contra la que se mide lo que vence. */
  saldo: number
  upcomingTotal: number
  gap: number
  items: UpcomingCommitmentItem[]
}

export function nextSubscriptionDate(snapshot: FinancialSnapshot, dayOfMonth: number): string {
  const clamp = (month: string, day: number) => {
    const [year, monthNumber] = month.split('-').map(Number)
    const lastDay = new Date(year, monthNumber, 0).getDate()
    return `${month}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
  }
  // Inclusivo: un débito que vence hoy sigue siendo salida del mes en curso.
  if (dayOfMonth >= snapshot.dayOfMonth) return clamp(snapshot.month, dayOfMonth)
  const [year, monthNumber] = snapshot.month.split('-').map(Number)
  const next = new Date(year, monthNumber, 1)
  const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
  return clamp(nextMonth, dayOfMonth)
}

export function computeLiquidity(snapshot: FinancialSnapshot, withinDays = 14): LiquidityFeature {
  const horizon = addDays(snapshot.referenceDate, withinDays)
  const items: UpcomingCommitmentItem[] = []

  for (const due of computeUpcomingCardDues(snapshot, withinDays)) {
    items.push({
      label: `Resumen ${due.cardName}`,
      amount: due.amount,
      date: due.dueDate,
      daysUntil: due.daysUntilDue,
      source: 'card',
    })
  }

  for (const subscription of snapshot.subscriptions) {
    // Solo débitos directos: las suscripciones con tarjeta de crédito ya
    // llegan como parte del resumen, no como salida de caja propia.
    if (subscription.paymentMethod !== 'DEBIT') continue
    if (subscription.currency !== snapshot.currency) continue
    const date = nextSubscriptionDate(snapshot, subscription.dayOfMonth)
    if (date > horizon) continue
    items.push({
      label: subscription.description,
      amount: subscription.amount,
      date,
      daysUntil: diffDays(snapshot.referenceDate, date),
      source: 'subscription',
    })
  }

  items.sort((a, b) => a.date.localeCompare(b.date))
  const upcomingTotal = items.reduce((sum, item) => sum + item.amount, 0)
  // La pregunta de liquidez es de caja: ¿la plata que hay cubre lo que vence?
  // Se mide contra Saldo Vivo. Disponible Real no sirve de base acá porque ya
  // descuenta los resúmenes de tarjeta que este cálculo suma como compromisos.
  const saldo = snapshot.saldoVivo[snapshot.currency]

  return { saldo, upcomingTotal, gap: saldo - upcomingTotal, items }
}

// ─── Movimientos fuera de patrón ─────────────────────────────────────────────

export type UnusualMovementFeature = {
  movement: SnapshotMovement
  baselineTicket: number
  historicalCount: number
  multiple: number
}

export function computeUnusualMovements(
  snapshot: FinancialSnapshot,
  options?: { withinDays?: number; minHistoricalCount?: number; minMultiple?: number },
): UnusualMovementFeature[] {
  const withinDays = options?.withinDays ?? 7
  const minHistoricalCount = options?.minHistoricalCount ?? 5
  const minMultiple = options?.minMultiple ?? 3
  const windowStart = addDays(snapshot.referenceDate, -(withinDays - 1))

  // Baseline por categoría con meses previos completos (moneda base).
  // Los gastos marcados extraordinarios no forman parte del ticket habitual.
  const baselines = new Map<string, { amount: number; count: number }>()
  for (const movement of snapshot.movements) {
    if (movement.kind !== 'gasto' || movement.isCardPayment) continue
    if (movement.currency !== snapshot.currency) continue
    if (movement.date.substring(0, 7) >= snapshot.month) continue
    if (movement.isExtraordinary) continue
    const current = baselines.get(movement.category) ?? { amount: 0, count: 0 }
    current.amount += movement.amount
    current.count += 1
    baselines.set(movement.category, current)
  }

  const income = snapshot.monthIncome[snapshot.currency]
  const currentAggregate = snapshot.monthAggregates.find(
    (aggregate) => aggregate.month === snapshot.month,
  )
  const monthSpend = currentAggregate
    ? currentAggregate.perceivedSpend[snapshot.currency] +
      currentAggregate.accruedSpend[snapshot.currency]
    : 0
  const significanceFloor = income > 0 ? income * 0.05 : monthSpend * 0.08

  const results: UnusualMovementFeature[] = []
  for (const movement of snapshot.movements) {
    if (movement.kind !== 'gasto' || movement.isCardPayment) continue
    if (movement.currency !== snapshot.currency) continue
    if (movement.date < windowStart || movement.date > snapshot.referenceDate) continue
    // Un gasto que el usuario ya marcó como extraordinario no es novedad.
    if (movement.isExtraordinary) continue

    const baseline = baselines.get(movement.category)
    if (!baseline || baseline.count < minHistoricalCount) continue

    const baselineTicket = baseline.amount / baseline.count
    if (baselineTicket <= 0) continue

    const multiple = movement.amount / baselineTicket
    if (multiple < minMultiple) continue
    if (significanceFloor > 0 && movement.amount < significanceFloor) continue

    results.push({
      movement,
      baselineTicket: Math.round(baselineTicket),
      historicalCount: baseline.count,
      multiple: Math.round(multiple * 10) / 10,
    })
  }

  return results.sort((a, b) => b.multiple - a.multiple)
}

// ─── Deseo vs necesidad ──────────────────────────────────────────────────────

export type WantsShareFeature = {
  currentWants: number
  currentSpend: number
  currentSharePct: number | null
  baselineSharePct: number | null
  baselineMonths: number
  deltaPts: number | null
  dataQuality: DataQuality
}

/** Gasto propio del mes (percibido sin pagos de tarjeta + devengado). */
function ownSpendOfMonth(
  aggregate: FinancialSnapshot['monthAggregates'][number],
  currency: FinancialSnapshot['currency'],
): number {
  return (
    aggregate.perceivedSpend[currency] -
    aggregate.cardPayments[currency] +
    aggregate.accruedSpend[currency]
  )
}

export function computeWantsShare(snapshot: FinancialSnapshot): WantsShareFeature {
  const currency = snapshot.currency
  const current = snapshot.monthAggregates.find((aggregate) => aggregate.month === snapshot.month)
  const currentSpend = current ? ownSpendOfMonth(current, currency) : 0
  const currentWants = current?.wantsSpend[currency] ?? 0
  const currentSharePct =
    currentSpend > 0 ? Math.round((currentWants / currentSpend) * 100) : null

  const closedMonths = snapshot.monthAggregates.filter(
    (aggregate) => aggregate.month < snapshot.month && ownSpendOfMonth(aggregate, currency) > 0,
  )
  const monthsWithWants = closedMonths.filter(
    (aggregate) => aggregate.wantsSpend[currency] > 0,
  ).length

  // Sin meses previos clasificados con deseo no hay línea base honesta:
  // un histórico todo en 0 suele significar "no clasifica", no "no gasta en deseos".
  if (closedMonths.length === 0 || monthsWithWants === 0) {
    return {
      currentWants,
      currentSpend,
      currentSharePct,
      baselineSharePct: null,
      baselineMonths: 0,
      deltaPts: null,
      dataQuality: 'insufficient',
    }
  }

  const baselineSharePct = Math.round(
    (closedMonths.reduce(
      (sum, aggregate) =>
        sum + aggregate.wantsSpend[currency] / ownSpendOfMonth(aggregate, currency),
      0,
    ) /
      closedMonths.length) *
      100,
  )

  return {
    currentWants,
    currentSpend,
    currentSharePct,
    baselineSharePct,
    baselineMonths: closedMonths.length,
    deltaPts: currentSharePct !== null ? currentSharePct - baselineSharePct : null,
    dataQuality: closedMonths.length >= 3 ? 'ok' : 'partial',
  }
}

// ─── Ritmo de metas ──────────────────────────────────────────────────────────

export type GoalPaceFeature = {
  behind: SnapshotGoal[]
  onTrack: SnapshotGoal[]
}

const byNearestTarget = (a: SnapshotGoal, b: SnapshotGoal) =>
  (a.targetDate ?? '9999-12-31').localeCompare(b.targetDate ?? '9999-12-31')

export function computeGoalPace(snapshot: FinancialSnapshot): GoalPaceFeature {
  const active = snapshot.goalsDetail.filter((goal) => goal.status === 'active')
  return {
    behind: active
      .filter(
        (goal) =>
          goal.paceStatus === 'behind' &&
          goal.targetDate !== null &&
          goal.requiredMonthlyContribution !== null &&
          goal.requiredMonthlyContribution > 0,
      )
      .sort(byNearestTarget),
    onTrack: active
      .filter((goal) => goal.paceStatus === 'on_track' && goal.progressPct > 0)
      .sort(byNearestTarget),
  }
}

// ─── Ingresos recurrentes que no llegaron ────────────────────────────────────

export function computeMissingIncomes(
  snapshot: FinancialSnapshot,
  graceDays = 2,
): SnapshotRecurringIncome[] {
  // Solo aplica al mes en curso: en meses pasados el pendiente no es accionable.
  if (snapshot.comparisonDay === null) return []
  return snapshot.recurringIncomes
    .filter(
      (income) =>
        income.pendingThisMonth && snapshot.dayOfMonth >= income.dayOfMonth + graceDays,
    )
    .sort((a, b) => b.amount - a.amount)
}
