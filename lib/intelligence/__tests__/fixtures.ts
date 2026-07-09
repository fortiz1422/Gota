import { buildEmptyBudgetSnapshot } from '@/lib/budgets/computeBudgetMetrics'
import type { BudgetSnapshot } from '@/lib/budgets/types'
import {
  assembleFinancialSnapshot,
  type SnapshotExpenseRow,
  type SnapshotIncomeRow,
  type SnapshotInputs,
} from '../snapshot'
import type {
  FinancialSnapshot,
  SnapshotCardCommitment,
  SnapshotGoal,
  SnapshotRecurringIncome,
  SnapshotSubscription,
} from '../types'

/**
 * Escenario base: usuario ARS con 5 meses completos de histórico estable.
 * - Hoy: 2026-07-15 (día 15 de 31 → 48% del mes)
 * - Ingreso: $1.000.000 el día 1 de cada mes
 * - Histórico por mes (feb–jun): Supermercado 5×$40.000 (días 3/9/14/21/27)
 *   + Delivery 2×$10.000 (días 6/13) → total $220.000, same-day(≤15) $140.000
 * - Julio al día 15: mismo patrón → same-day $140.000 (delta 0%)
 */
export const TODAY = '2026-07-15'
export const MONTH = '2026-07'
export const HISTORY_MONTHS = ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06']

let idCounter = 0

export function makeExpense(
  overrides: Partial<SnapshotExpenseRow> & { date: string; amount: number },
): SnapshotExpenseRow {
  idCounter += 1
  return {
    id: `exp-${idCounter}`,
    currency: 'ARS',
    category: 'Supermercado',
    description: 'Compra super',
    is_want: false,
    payment_method: 'DEBIT',
    is_legacy_card_payment: null,
    installment_number: null,
    installment_total: null,
    ...overrides,
  }
}

export function makeIncome(
  overrides: Partial<SnapshotIncomeRow> & { date: string; amount: number },
): SnapshotIncomeRow {
  idCounter += 1
  return {
    id: `inc-${idCounter}`,
    currency: 'ARS',
    description: 'Sueldo',
    category: 'salary',
    ...overrides,
  }
}

export function monthPatternExpenses(month: string): SnapshotExpenseRow[] {
  const superDays = [3, 9, 14, 21, 27]
  const deliveryDays = [6, 13]
  return [
    ...superDays.map((day) =>
      makeExpense({
        date: `${month}-${String(day).padStart(2, '0')}`,
        amount: 40_000,
        category: 'Supermercado',
      }),
    ),
    ...deliveryDays.map((day) =>
      makeExpense({
        date: `${month}-${String(day).padStart(2, '0')}`,
        amount: 10_000,
        category: 'Delivery',
        description: 'Pedido delivery',
        is_want: true,
      }),
    ),
  ]
}

export function julyBaselineExpenses(): SnapshotExpenseRow[] {
  return [
    makeExpense({ date: '2026-07-03', amount: 40_000 }),
    makeExpense({ date: '2026-07-09', amount: 40_000 }),
    makeExpense({ date: '2026-07-14', amount: 40_000 }),
    makeExpense({
      date: '2026-07-06',
      amount: 10_000,
      category: 'Delivery',
      description: 'Pedido delivery',
      is_want: true,
    }),
    makeExpense({
      date: '2026-07-13',
      amount: 10_000,
      category: 'Delivery',
      description: 'Pedido delivery',
      is_want: true,
    }),
  ]
}

export function baselineIncome(): SnapshotIncomeRow[] {
  return [...HISTORY_MONTHS, MONTH].map((month) =>
    makeIncome({ date: `${month}-01`, amount: 1_000_000 }),
  )
}

export function makeBudgetSnapshot(
  items: Array<{ category: string; amount: number; spentAmount: number }>,
): BudgetSnapshot {
  const metrics = items.map((item, index) => ({
    id: `item-${index + 1}`,
    category: item.category,
    amount: item.amount,
    spentAmount: item.spentAmount,
    remainingAmount: item.amount - item.spentAmount,
    usedPct: item.amount > 0 ? Math.round((item.spentAmount / item.amount) * 100) : 0,
    expectedPct: 0,
    paceDelta: 0,
    status: 'on_track' as const,
  }))
  const totalBudgeted = metrics.reduce((sum, item) => sum + item.amount, 0)
  const totalSpent = metrics.reduce((sum, item) => sum + item.spentAmount, 0)

  return {
    plan: { id: 'plan-1', periodMonth: `${MONTH}-01`, baseCurrency: 'ARS', status: 'active' },
    summary: {
      totalBudgeted,
      totalSpent,
      totalRemaining: totalBudgeted - totalSpent,
      overBudgetCount: 0,
      nearLimitCount: 0,
      aheadOfPaceCount: 0,
    },
    items: metrics,
    previousPlanAvailable: false,
  }
}

export function makeCard(overrides?: Partial<SnapshotCardCommitment>): SnapshotCardCommitment {
  return {
    cardId: 'card-1',
    cardName: 'Visa Galicia',
    currentCycleSpend: 0,
    daysUntilClosing: null,
    pendingStatements: [],
    ...overrides,
  }
}

export function makeSubscription(
  overrides?: Partial<SnapshotSubscription>,
): SnapshotSubscription {
  return {
    description: 'Streaming',
    category: 'Suscripciones',
    amount: 15_000,
    currency: 'ARS',
    paymentMethod: 'DEBIT',
    dayOfMonth: 20,
    ...overrides,
  }
}

export function makeInputs(overrides?: Partial<SnapshotInputs>): SnapshotInputs {
  return {
    today: TODAY,
    month: MONTH,
    currency: 'ARS',
    saldoVivo: { ARS: 800_000, USD: 0 },
    disponibleReal: { ARS: 600_000, USD: 0 },
    accountBalances: [{ id: 'acc-1', name: 'Banco', saldo: 600_000 }],
    budget: buildEmptyBudgetSnapshot(),
    cards: [],
    subscriptions: [],
    goals: { count: 0, committed: { ARS: 0, USD: 0 } },
    yieldAccumulated: 0,
    expenses: [
      ...HISTORY_MONTHS.flatMap((month) => monthPatternExpenses(month)),
      ...julyBaselineExpenses(),
    ],
    incomeEntries: baselineIncome(),
    transfers: [],
    earliestDataMonth: '2026-02',
    ...overrides,
  }
}

export function makeSnapshot(overrides?: Partial<SnapshotInputs>): FinancialSnapshot {
  return assembleFinancialSnapshot(makeInputs(overrides))
}

/** Usuario en su primer mes: sin histórico previo. */
export function makeFreshUserSnapshot(): FinancialSnapshot {
  return makeSnapshot({
    expenses: julyBaselineExpenses(),
    incomeEntries: [makeIncome({ date: `${MONTH}-01`, amount: 1_000_000 })],
    earliestDataMonth: MONTH,
  })
}

// ─── Fixtures v2: metas, recurrentes y cuotas futuras ───────────────────────

export function makeGoal(overrides?: Partial<SnapshotGoal>): SnapshotGoal {
  return {
    id: 'goal-1',
    name: 'Viaje',
    status: 'active',
    currency: 'ARS',
    targetAmount: 1_200_000,
    currentAmount: 300_000,
    remainingAmount: 900_000,
    progressPct: 25,
    targetDate: '2026-12-31',
    monthsRemaining: 5,
    requiredMonthlyContribution: 180_000,
    plannedMonthlyContribution: 100_000,
    paceStatus: 'behind',
    ...overrides,
  }
}

export function makeRecurringIncome(
  overrides?: Partial<SnapshotRecurringIncome>,
): SnapshotRecurringIncome {
  return {
    id: 'rec-1',
    description: 'Sueldo',
    amount: 1_000_000,
    currency: 'ARS',
    dayOfMonth: 5,
    pendingThisMonth: false,
    ...overrides,
  }
}

/** Cuotas futuras: un gasto CREDIT por mes indicado, ya materializado. */
export function futureInstallmentExpenses(
  entries: Array<{ month: string; amount: number; number?: number; total?: number }>,
): SnapshotExpenseRow[] {
  return entries.map((entry, index) =>
    makeExpense({
      date: `${entry.month}-10`,
      amount: entry.amount,
      category: 'Electrónica',
      description: 'Compra en cuotas',
      payment_method: 'CREDIT',
      installment_number: entry.number ?? index + 2,
      installment_total: entry.total ?? entries.length + 1,
    }),
  )
}
