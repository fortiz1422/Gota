import type { MonthlySeriesPoint } from '@/lib/analytics/analytics-overview'
import type { BudgetSnapshot } from '@/lib/budgets/types'

export type Currency = 'ARS' | 'USD'

/**
 * Calidad de los datos detrás de un insight/feature.
 * - ok: evidencia completa, se puede afirmar con confianza
 * - partial: hay datos pero la base de comparación es corta (1-2 meses)
 * - insufficient: no alcanza para afirmar nada — la regla no debe emitir
 */
export type DataQuality = 'ok' | 'partial' | 'insufficient'

export type EvidenceItem = {
  label: string
  value: string
  source: string
}

export type InsightSeverity = 'info' | 'watch' | 'risk' | 'positive'

export type InsightKind =
  | 'budget_acceleration'
  | 'same_day_spend_delta'
  | 'upcoming_card_due'
  | 'liquidity_watch'
  | 'recent_unusual_movement'
  | 'installment_load'
  | 'wants_creep'
  | 'goal_pace'
  | 'income_missing'
  | 'subscription_load'

export type InsightAction = {
  label: string
  href?: string
  question?: string
}

export type InsightCandidate = {
  id: string
  kind: InsightKind
  severity: InsightSeverity
  priority: number
  title: string
  short: string
  message: string
  evidence: EvidenceItem[]
  dataQuality: DataQuality
  actions: InsightAction[]
  validUntil: string
  dedupeKey: string
}

// ─── FinancialSnapshot ───────────────────────────────────────────────────────

export type SnapshotMovementKind = 'gasto' | 'ingreso' | 'transferencia'

export type SnapshotMovement = {
  id: string
  kind: SnapshotMovementKind
  date: string
  description: string
  category: string
  amount: number
  currency: Currency
  paymentMethod: 'CASH' | 'DEBIT' | 'TRANSFER' | 'CREDIT' | null
  isWant: boolean | null
  isExtraordinary: boolean | null
  isCardPayment: boolean
  installmentLabel: string | null
}

export type SnapshotAccountBalance = {
  id: string
  name: string
  saldo: number
}

export type SnapshotPendingStatement = {
  periodMonth: string
  amount: number
  dueDate: string
  status: 'cerrado' | 'vencido'
}

export type SnapshotCardCommitment = {
  cardId: string
  cardName: string
  currentCycleSpend: number
  daysUntilClosing: number | null
  pendingStatements: SnapshotPendingStatement[]
}

export type SnapshotSubscription = {
  description: string
  category: string
  amount: number
  currency: Currency
  paymentMethod: 'DEBIT' | 'CREDIT'
  dayOfMonth: number
}

export type CategoryAggregate = {
  category: string
  currency: Currency
  amount: number
  count: number
  /** Sin gastos extraordinarios: base para promedios y comparativas históricas. */
  habitualAmount: number
  habitualCount: number
}

export type MonthAggregate = {
  month: string
  income: Record<Currency, number>
  perceivedSpend: Record<Currency, number>
  accruedSpend: Record<Currency, number>
  cardPayments: Record<Currency, number>
  /** Gasto marcado como deseo (percibido + devengado, sin pagos de tarjeta). */
  wantsSpend: Record<Currency, number>
  /** Gasto marcado como extraordinario: se excluye de los baselines históricos. */
  extraordinarySpend: Record<Currency, number>
  categories: CategoryAggregate[]
}

export type GoalPace = 'on_track' | 'behind' | 'no_date' | 'completed' | 'paused'

export type SnapshotGoal = {
  id: string
  name: string
  status: 'active' | 'paused' | 'completed' | 'archived'
  currency: Currency
  targetAmount: number
  currentAmount: number
  remainingAmount: number
  progressPct: number
  targetDate: string | null
  monthsRemaining: number | null
  requiredMonthlyContribution: number | null
  plannedMonthlyContribution: number | null
  paceStatus: GoalPace
}

export type SnapshotRecurringIncome = {
  id: string
  description: string
  amount: number
  currency: Currency
  dayOfMonth: number
  /** true si ya pasó su día de cobro este mes y no hay ingreso registrado. */
  pendingThisMonth: boolean
}

/** Cuotas ya comprometidas para un mes futuro (gastos con fecha futura). */
export type FutureInstallmentMonth = {
  month: string
  amount: Record<Currency, number>
  count: number
}

/**
 * Snapshot financiero normalizado por usuario/mes.
 * Serializable (sin Maps ni Dates) para poder fixturearlo en tests
 * y compartirlo entre héroes y chat sin recomputar.
 */
export type FinancialSnapshot = {
  referenceDate: string
  month: string
  currency: Currency
  dayOfMonth: number
  daysInMonth: number
  comparisonDay: number | null
  earliestDataMonth: string | null
  availableCompletedMonths: number

  saldoVivo: Record<Currency, number>
  disponibleReal: Record<Currency, number>
  accountBalances: SnapshotAccountBalance[]

  monthIncome: Record<Currency, number>
  hasIncome: boolean

  monthlySeries: MonthlySeriesPoint[]
  budget: BudgetSnapshot
  cards: SnapshotCardCommitment[]
  subscriptions: SnapshotSubscription[]
  goals: { count: number; committed: Record<Currency, number> }
  goalsDetail: SnapshotGoal[]
  recurringIncomes: SnapshotRecurringIncome[]
  futureInstallments: FutureInstallmentMonth[]
  yieldAccumulated: number

  movements: SnapshotMovement[]
  monthAggregates: MonthAggregate[]
  hasOtherCurrencyMovements: boolean
}
