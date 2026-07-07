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
}

export type MonthAggregate = {
  month: string
  income: Record<Currency, number>
  perceivedSpend: Record<Currency, number>
  accruedSpend: Record<Currency, number>
  cardPayments: Record<Currency, number>
  categories: CategoryAggregate[]
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
  yieldAccumulated: number

  movements: SnapshotMovement[]
  monthAggregates: MonthAggregate[]
  hasOtherCurrencyMovements: boolean
}
