import type { AnalyticsApiData } from '@/components/analytics/AnalyticsDataLoader'
import type { CompromisosData } from '@/lib/analytics/computeCompromisos'
import type { BudgetSnapshot } from '@/lib/budgets/types'
import type { DashboardApiData } from '@/lib/server/dashboard-queries'
import type { Account, Card, Expense, IncomeEntry, Instrument, RecurringIncome, Subscription } from '@/types/database'

const NOW = '2026-07-21T12:00:00.000Z'
const USER = 'preview-user'

function account(id: string, name: string, balance: number, primary = false): Account {
  return {
    id,
    user_id: USER,
    name,
    type: id === 'cash' ? 'cash' : id === 'mp' ? 'digital' : 'bank',
    is_primary: primary,
    archived: false,
    opening_balance_ars: balance,
    opening_balance_usd: 0,
    daily_yield_enabled: false,
    daily_yield_rate: null,
    daily_yield_provider: null,
    daily_yield_cap_amount: null,
    daily_yield_checkin_interval_days: 15,
    daily_yield_last_checkin_at: null,
    created_at: NOW,
    updated_at: NOW,
  }
}

function expense(id: string, date: string, amount: number, description: string, category: string, paymentMethod: Expense['payment_method'] = 'DEBIT'): Expense {
  return {
    id,
    user_id: USER,
    subscription_id: null,
    amount,
    currency: 'ARS',
    category,
    description,
    is_want: false,
    is_recurring: false,
    is_extraordinary: false,
    is_legacy_card_payment: false,
    payment_method: paymentMethod,
    card_id: paymentMethod === 'CREDIT' ? 'visa' : null,
    card_cycle_id: null,
    account_id: 'galicia',
    date,
    created_at: NOW,
    updated_at: NOW,
    installment_group_id: null,
    installment_number: null,
    installment_total: null,
  }
}

const accounts = [
  account('galicia', 'Galicia', 812_400, true),
  account('mp', 'Mercado Pago', 336_500),
  account('cash', 'Efectivo', 100_000),
]

const visa: Card = {
  id: 'visa',
  user_id: USER,
  name: 'Visa Galicia',
  closing_day: 25,
  due_day: 22,
  account_id: 'galicia',
  archived: false,
  created_at: NOW,
  updated_at: NOW,
}

const recurringIncome: RecurringIncome = {
  id: 'salary',
  user_id: USER,
  amount: 1_100_000,
  currency: 'ARS',
  category: 'salary',
  description: 'Sueldo',
  account_id: 'galicia',
  day_of_month: 31,
  is_active: true,
  created_at: NOW,
  updated_at: NOW,
}

const instrument: Instrument = {
  id: 'pf-1',
  user_id: USER,
  type: 'plazo_fijo',
  label: 'Plazo fijo Galicia',
  amount: 300_000,
  currency: 'ARS',
  rate: 31,
  account_id: 'galicia',
  opened_at: '2026-06-29',
  due_date: '2026-07-29',
  status: 'active',
  closed_at: null,
  closed_amount: null,
  auto_egress_id: null,
  created_at: NOW,
}

const recentExpenses = [
  expense('e-1', '2026-07-21', 18_600, 'YPF', 'Transporte'),
  expense('e-2', '2026-07-20', 148_000, 'Supermercado', 'Supermercado', 'CREDIT'),
  expense('e-3', '2026-07-19', 12_400, 'Farmacia', 'Salud'),
]

const income: IncomeEntry = {
  id: 'i-1',
  user_id: USER,
  account_id: 'galicia',
  amount: 1_100_000,
  currency: 'ARS',
  description: 'Sueldo junio',
  category: 'salary',
  date: '2026-07-01',
  created_at: NOW,
  recurring_income_id: 'salary',
}

export const WEB_PANEL_PREVIEW_DASHBOARD: DashboardApiData = {
  dashboardData: null,
  heroBalanceMode: 'default_currency',
  heroBreakdown: { ARS: 1_248_900, USD: 0 },
  availableBreakdown: { ARS: 612_400, USD: 0 },
  goalCommitmentsBreakdown: { ARS: 100_000, USD: 0 },
  freeBreakdown: { ARS: 512_400, USD: 0 },
  accounts,
  cards: [visa],
  currency: 'ARS',
  viewCurrency: 'ARS',
  hasIncomeAfterRollover: true,
  autoRolloverAmount: null,
  manualRolloverSummary: null,
  activeSubscriptions: [],
  allUltimos: recentExpenses,
  incomeEntries: [income],
  transfers: [],
  transferCurrencyAdjustment: 0,
  earliestDataMonth: '2026-01',
  hasUsdExpenses: false,
  selectedMonth: '2026-07',
  isCurrentMonth: true,
  isProjected: false,
  yieldAccumulators: [],
  activeInstruments: [instrument],
  capitalInstrumentosMes: 300_000,
  recurringPending: [],
  activeRecurring: [recurringIncome],
  compromisos: null,
  accountBalances: [
    { id: 'galicia', name: 'Galicia', type: 'bank', is_primary: true, saldo: 812_400 },
    { id: 'mp', name: 'Mercado Pago', type: 'digital', is_primary: false, saldo: 336_500 },
    { id: 'cash', name: 'Efectivo', type: 'cash', is_primary: false, saldo: 100_000 },
  ],
  cardPaymentPrompts: [],
  goals: [],
}

const paceMovements: AnalyticsApiData['paceMovements'] = []
for (const [month, factor] of [['2026-04', 0.88], ['2026-05', 0.96], ['2026-06', 1.02], ['2026-07', 1.12]] as const) {
  for (const [day, amount, category] of [[2, 92_000, 'Supermercado'], [5, 130_000, 'Transporte'], [9, 168_000, 'Supermercado'], [13, 142_000, 'Médico'], [17, 128_000, 'Supermercado'], [21, 72_000, 'Transporte']] as const) {
    paceMovements.push({
      date: `${month}-${String(day).padStart(2, '0')}`,
      amount: Math.round(amount * factor),
      category,
      currency: 'ARS',
      isExtraordinary: false,
      isCardPayment: false,
    })
  }
}
paceMovements.push({
  date: '2026-07-19',
  amount: 75_000,
  category: 'Supermercado',
  currency: 'ARS',
  isExtraordinary: true,
  isCardPayment: false,
})

const previewSubscription: Subscription = {
  id: 'sub-streaming',
  user_id: USER,
  description: 'Streaming',
  category: 'Suscripciones',
  amount: 18_900,
  currency: 'ARS',
  payment_method: 'CREDIT',
  card_id: 'visa',
  account_id: null,
  day_of_month: 24,
  is_active: true,
  created_at: NOW,
  last_reviewed_at: NOW,
}

const previewInstallment: Expense = {
  ...expense('installment-3', '2026-07-23', 45_000, 'Notebook', 'Educación', 'CREDIT'),
  installment_group_id: 'notebook-plan',
  installment_number: 3,
  installment_total: 12,
}

export const WEB_PANEL_PREVIEW_ANALYTICS = {
  paceMovements,
  subscriptions: [previewSubscription],
  futureInstallments: [previewInstallment],
  comparisonContext: {
    selectedMonth: '2026-07',
    isCurrentMonth: true,
    availableCompletedMonths: 3,
    comparisonDay: 21,
  },
} as unknown as AnalyticsApiData

export const WEB_PANEL_PREVIEW_BUDGET: BudgetSnapshot = {
  plan: { id: 'plan-preview', periodMonth: '2026-07', baseCurrency: 'ARS', status: 'active' },
  summary: {
    totalBudgeted: 1_100_000,
    totalSpent: 820_000,
    totalRemaining: 280_000,
    overBudgetCount: 0,
    nearLimitCount: 1,
    aheadOfPaceCount: 1,
  },
  items: [
    { id: 'food', category: 'Supermercado', amount: 300_000, spentAmount: 258_000, remainingAmount: 42_000, usedPct: 86, expectedPct: 68, paceDelta: 18, status: 'near_limit' },
    { id: 'transport', category: 'Transporte', amount: 180_000, spentAmount: 104_000, remainingAmount: 76_000, usedPct: 58, expectedPct: 68, paceDelta: -10, status: 'on_track' },
  ],
  previousPlanAvailable: true,
}

export const WEB_PANEL_PREVIEW_COMMITMENTS: CompromisosData = {
  mode: 'current',
  totalDebt: 95_200,
  pctComprometido: 9,
  ingresoMes: 1_100_000,
  tarjetas: [{
    id: 'visa',
    name: 'Visa Galicia',
    closingDay: 25,
    dueDay: 22,
    currentSpend: 186_500,
    daysUntilClosing: 4,
    debtTotal: 95_200,
    debtCycles: [{ periodMonth: '2026-06', amount: 95_200, dueDate: '2026-07-22', cycleStatus: 'cerrado' }],
    cycleStatus: 'cerrado',
    dueDate: '2026-07-22',
    daysUntilDue: 1,
    amountPaid: null,
    paidAt: null,
    pendingSubs: [],
  }],
  tarjetasSinVencimiento: [],
  hasCards: true,
  hasCreditExpenses: true,
  totalComprometido: 281_700,
  unassignedCreditSpend: 0,
  totalAPagar: 95_200,
  totalEnCurso: 186_500,
}
