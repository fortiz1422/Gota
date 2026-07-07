import type { MonthlySeriesPoint } from '@/lib/analytics/analytics-overview'
import { addDays, diffDays } from './evidence'
import type {
  DataQuality,
  FinancialSnapshot,
  SnapshotMovement,
  SnapshotPendingStatement,
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

export function computeSameDaySpend(snapshot: FinancialSnapshot): SameDaySpendFeature {
  const selectedPoint =
    snapshot.monthlySeries.find((point) => point.month === snapshot.month) ?? null
  const currentAmount = selectedPoint?.sameDayPercibidoDevengadoTotal ?? 0
  const previousPoints = comparablePreviousPoints(snapshot)

  const insufficient: SameDaySpendFeature = {
    currentAmount,
    baselineAmount: null,
    baselineKind: null,
    baselineWindow: 0,
    deltaPct: null,
    dataQuality: 'insufficient',
  }

  if (snapshot.comparisonDay === null || previousPoints.length === 0 || currentAmount <= 0) {
    return insufficient
  }

  if (previousPoints.length <= 2) {
    const previous = previousPoints[previousPoints.length - 1]
    const baselineAmount = previous.sameDayPercibidoDevengadoTotal
    if (baselineAmount === null || baselineAmount <= 0) return insufficient
    return {
      currentAmount,
      baselineAmount,
      baselineKind: 'previous_month',
      baselineWindow: 1,
      deltaPct: Math.round(((currentAmount - baselineAmount) / baselineAmount) * 100),
      dataQuality: 'partial',
    }
  }

  const windowSize = Math.min(previousPoints.length, 6)
  const values = previousPoints
    .slice(-windowSize)
    .map((point) => point.sameDayPercibidoDevengadoTotal)
    .filter((value): value is number => value !== null && value > 0)
  if (values.length === 0) return insufficient

  const baselineAmount = values.reduce((sum, value) => sum + value, 0) / values.length
  return {
    currentAmount,
    baselineAmount,
    baselineKind: 'rolling_average',
    baselineWindow: values.length,
    deltaPct: Math.round(((currentAmount - baselineAmount) / baselineAmount) * 100),
    dataQuality: 'ok',
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
  disponible: number
  upcomingTotal: number
  gap: number
  items: UpcomingCommitmentItem[]
}

function nextSubscriptionDate(snapshot: FinancialSnapshot, dayOfMonth: number): string {
  const clamp = (month: string, day: number) => {
    const [year, monthNumber] = month.split('-').map(Number)
    const lastDay = new Date(year, monthNumber, 0).getDate()
    return `${month}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
  }
  if (dayOfMonth > snapshot.dayOfMonth) return clamp(snapshot.month, dayOfMonth)
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
  const disponible = snapshot.disponibleReal[snapshot.currency]

  return { disponible, upcomingTotal, gap: disponible - upcomingTotal, items }
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
  const baselines = new Map<string, { amount: number; count: number }>()
  for (const aggregate of snapshot.monthAggregates) {
    if (aggregate.month >= snapshot.month) continue
    for (const category of aggregate.categories) {
      if (category.currency !== snapshot.currency) continue
      const current = baselines.get(category.category) ?? { amount: 0, count: 0 }
      current.amount += category.amount
      current.count += category.count
      baselines.set(category.category, current)
    }
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
