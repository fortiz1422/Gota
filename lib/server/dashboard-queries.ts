import { createClient } from '@/lib/supabase/server'
import { buildPrevMonthSummary } from '@/lib/rollover'
import { getCurrentMonth, addMonths } from '@/lib/dates'
import { todayAR } from '@/lib/format'
import { buildCardCycleAmountsMap, isMissingCardCycleAmountsTableError } from '@/lib/card-cycle-amounts'
import {
  buildLiveBalanceHeroSummary,
  sumActiveInstrumentCapital,
  sumCrossCurrencyTransferAdjustment,
} from '@/lib/live-balance'
import { computeCompromisos } from '@/lib/analytics/computeCompromisos'
import { FF_INSTRUMENTS, FF_YIELD } from '@/lib/flags'
import type { HeroBalanceMode } from '@/types/database'
import type {
  Account,
  Card,
  CardCycle,
  DashboardData,
  Expense,
  Instrument,
  IncomeEntry,
  RecurringIncome,
  Subscription,
  Transfer,
  YieldAccumulator,
  CardCycleAmount,
} from '@/types/database'
import type { PrevMonthSummary } from '@/lib/rollover'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type DashboardApiData = {
  dashboardData: DashboardData | null
  heroBalanceMode: HeroBalanceMode
  heroBreakdown: Record<'ARS' | 'USD', number>
  availableBreakdown: Record<'ARS' | 'USD', number>
  accounts: Account[]
  cards: Card[]
  currency: 'ARS' | 'USD'
  viewCurrency: 'ARS' | 'USD'
  hasIncomeAfterRollover: boolean
  autoRolloverAmount: number | null
  manualRolloverSummary: PrevMonthSummary | null
  activeSubscriptions: Subscription[]
  allUltimos: Expense[]
  incomeEntries: IncomeEntry[]
  transfers: Transfer[]
  transferCurrencyAdjustment: number
  earliestDataMonth: string | null
  hasUsdExpenses: boolean
  selectedMonth: string
  isCurrentMonth: boolean
  isProjected: boolean
  yieldAccumulators: YieldAccumulator[]
  activeInstruments: Instrument[]
  capitalInstrumentosMes: number
  recurringPending: RecurringIncome[]
  activeRecurring: RecurringIncome[]
}

type ReadDashboardDataParams = {
  supabase: SupabaseClient
  userId: string
  selectedMonth: string
  viewCurrency: 'ARS' | 'USD'
}

export async function readDashboardData({
  supabase,
  userId,
  selectedMonth,
  viewCurrency,
}: ReadDashboardDataParams): Promise<DashboardApiData> {
  const currentMonth = getCurrentMonth()
  const selectedMonthDate = selectedMonth + '-01'
  const nextMonthDate = addMonths(selectedMonth, 1) + '-01'
  const historyStartMonth = addMonths(selectedMonth, -5)
  const historyStartDate = historyStartMonth + '-01'
  const isCurrentMonth = selectedMonth === currentMonth
  const todayDate = todayAR()
  const tomorrowDate = new Date(`${todayDate}T00:00:00-03:00`)
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrowStr = tomorrowDate.toISOString().split('T')[0]

  const [{ data: config }, { data: accountsData }, { data: cardsData }] = await Promise.all([
    supabase
      .from('user_config')
      .select('default_currency, rollover_mode, hero_balance_mode')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('archived', false)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true }),
    supabase
      .from('cards')
      .select('*')
      .eq('user_id', userId)
      .eq('archived', false)
      .order('created_at', { ascending: true }),
  ])

  const userCurrency = (config?.default_currency ?? 'ARS') as 'ARS' | 'USD'
  const heroBalanceMode = (config?.hero_balance_mode ?? 'combined_ars') as HeroBalanceMode
  const currency = userCurrency
  const cards = (cardsData ?? []) as Card[]
  const accounts = (accountsData ?? []) as Account[]
  const accountIds = accounts.map((account) => account.id)

  const [
    incomeEntriesResult,
    { data: oldestExpense },
    { data: usdCheckData },
    { data: allUltimosData },
    { data: transfersData },
    { data: subscriptionsData },
    { data: yieldData },
    { data: instrumentsData },
    { data: recurringData },
    { data: liveIncomeData },
    { data: liveDebitExpenseData },
    { data: liveCardPaymentData },
    { data: liveTransfersData },
    { data: liveYieldData },
    { data: liveInstrumentsData },
    { data: compromisoExpensesData },
    { data: unpaidCyclesData },
    { data: paidCyclesData },
    { data: cycleAmountsData, error: cycleAmountsError },
  ] = await Promise.all([
    supabase
      .from('income_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('date', selectedMonthDate)
      .lt('date', nextMonthDate)
      .order('date', { ascending: false })
      .limit(20),
    supabase.from('expenses').select('date').eq('user_id', userId).order('date', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('expenses').select('id').eq('user_id', userId).eq('currency', 'USD').limit(1).maybeSingle(),
    supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .gte('date', selectedMonthDate)
      .lt('date', nextMonthDate)
      .lt('date', isCurrentMonth ? tomorrowStr : nextMonthDate)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('transfers')
      .select('*')
      .eq('user_id', userId)
      .gte('date', selectedMonthDate)
      .lt('date', nextMonthDate)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('yield_accumulator')
      .select('id, account_id, accumulated, is_manual_override, last_accrued_date, confirmed_at')
      .eq('user_id', userId)
      .eq('month', selectedMonth),
    supabase
      .from('instruments')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('opened_at', { ascending: false }),
    supabase
      .from('recurring_incomes')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true),
    supabase
      .from('income_entries')
      .select('amount, currency')
      .eq('user_id', userId)
      .lte('date', todayDate),
    supabase
      .from('expenses')
      .select('amount, currency')
      .eq('user_id', userId)
      .lte('date', todayDate)
      .in('payment_method', ['CASH', 'DEBIT', 'TRANSFER'])
      .neq('category', 'Pago de Tarjetas'),
    supabase
      .from('expenses')
      .select('amount, currency')
      .eq('user_id', userId)
      .lte('date', todayDate)
      .eq('category', 'Pago de Tarjetas'),
    supabase
      .from('transfers')
      .select('amount_from, amount_to, currency_from, currency_to')
      .eq('user_id', userId)
      .lte('date', todayDate),
    supabase
      .from('yield_accumulator')
      .select('accumulated')
      .eq('user_id', userId)
      .lte('month', currentMonth),
    supabase
      .from('instruments')
      .select('amount, currency')
      .eq('user_id', userId)
      .eq('status', 'active'),
    supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .gte('date', historyStartDate)
      .lt('date', nextMonthDate)
      .or('payment_method.eq.CREDIT,category.eq.Pago de Tarjetas'),
    supabase
      .from('card_cycles')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'paid'),
    supabase
      .from('card_cycles')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'paid')
      .gte('period_month', historyStartDate),
    supabase
      .from('card_cycle_amounts')
      .select('*')
      .eq('user_id', userId),
  ])
  if (cycleAmountsError && !isMissingCardCycleAmountsTableError(cycleAmountsError.message)) {
    throw new Error(cycleAmountsError.message)
  }

  const incomeEntries = (incomeEntriesResult.data ?? []) as IncomeEntry[]
  const hasConfiguredOpeningBalance = accounts.some(
    (account) => account.opening_balance_ars > 0 || account.opening_balance_usd > 0,
  )
  const hasIncome = incomeEntries.length > 0 || hasConfiguredOpeningBalance
  const earliestDataMonth = oldestExpense?.date?.substring(0, 7) ?? null
  const hasUsdExpenses = usdCheckData !== null
  const allUltimos = (allUltimosData ?? []) as Expense[]
  const transfers = (transfersData ?? []) as Transfer[]
  const transferCurrencyAdjustment = sumCrossCurrencyTransferAdjustment(
    (liveTransfersData ?? []) as {
      amount_from: number
      amount_to: number
      currency_from: 'ARS' | 'USD'
      currency_to: 'ARS' | 'USD'
    }[],
    viewCurrency,
  )
  const activeSubscriptions = (subscriptionsData ?? []) as Subscription[]

  let autoRolloverAmount: number | null = null
  const manualRolloverSummary: PrevMonthSummary | null = null

  if (isCurrentMonth) {
    const prevMonthStr = addMonths(currentMonth, -1)
    const prevMonthDate = prevMonthStr + '-01'

    const [
      { data: prevExps },
      { data: prevIncomeEntries },
      { data: prevPeriodBalances },
    ] = await Promise.all([
      supabase
        .from('expenses')
        .select('amount, category, payment_method, account_id, currency')
        .eq('user_id', userId)
        .gte('date', prevMonthDate)
        .lt('date', selectedMonthDate),
      supabase
        .from('income_entries')
        .select('amount, currency, account_id')
        .eq('user_id', userId)
        .gte('date', prevMonthDate)
        .lt('date', selectedMonthDate),
      accountIds.length > 0
        ? supabase
            .from('account_period_balance')
            .select('account_id, balance_ars, balance_usd')
            .in('account_id', accountIds)
            .eq('period', prevMonthDate)
        : Promise.resolve({ data: [] as { account_id: string; balance_ars: number; balance_usd: number }[] }),
    ])

    const prevBalanceSum = (prevPeriodBalances ?? []).reduce((sum, balance) => sum + balance.balance_ars + balance.balance_usd, 0)
    const hasPrevData = (prevIncomeEntries?.length ?? 0) > 0 || prevBalanceSum > 0

    if (hasPrevData) {
      const prevExpsForSummary = (prevExps ?? []).filter((expense) => expense.currency === currency)
      const summary = buildPrevMonthSummary(
        prevExpsForSummary,
        currency,
        prevMonthStr,
        prevIncomeEntries ?? [],
        prevPeriodBalances ?? [],
      )

      if (incomeEntries.length === 0) {
        autoRolloverAmount = summary.saldoFinal
      }
    }
  }

  const { data: dashboardRaw } = await supabase.rpc('get_dashboard_data', {
    p_user_id: userId,
    p_month: selectedMonthDate,
    p_currency: viewCurrency,
  })

  const liveHeroSummary = buildLiveBalanceHeroSummary({
    accounts,
    incomes: (liveIncomeData ?? []).map((row: { amount: number; currency: 'ARS' | 'USD' }) => ({
      amount: row.amount,
      currency: row.currency,
    })),
    debitExpenses: (liveDebitExpenseData ?? []).map((row: { amount: number; currency: 'ARS' | 'USD' }) => ({
      amount: row.amount,
      currency: row.currency,
    })),
    cardPayments: (liveCardPaymentData ?? []).map((row: { amount: number; currency: 'ARS' | 'USD' }) => ({
      amount: row.amount,
      currency: row.currency,
    })),
    yields: FF_YIELD ? ((liveYieldData ?? []) as { accumulated: number }[]) : [],
  })

  const activeInstruments = (instrumentsData ?? []) as Instrument[]
  const capitalInstrumentosMes = FF_INSTRUMENTS
    ? sumActiveInstrumentCapital(
        (liveInstrumentsData ?? []) as Pick<Instrument, 'amount' | 'currency'>[],
        viewCurrency,
      )
    : 0

  const activeRecurring = (recurringData ?? []) as RecurringIncome[]
  const todayDay = parseInt(todayDate.split('-')[2], 10)
  const linkedThisMonth = new Set(
    incomeEntries
      .filter((incomeEntry) => incomeEntry.recurring_income_id !== null)
      .map((incomeEntry) => incomeEntry.recurring_income_id as string),
  )
  const recurringPending = isCurrentMonth
    ? activeRecurring.filter((recurringIncome) => recurringIncome.day_of_month <= todayDay && !linkedThisMonth.has(recurringIncome.id))
    : []

  const rawData = dashboardRaw as DashboardData | null
  const compromisoExpenses = (compromisoExpensesData ?? []) as Expense[]
  const allCardCycles = [
    ...((unpaidCyclesData ?? []) as CardCycle[]),
    ...((paidCyclesData ?? []) as CardCycle[]),
  ]
  const cycleAmountsMap = buildCardCycleAmountsMap((cycleAmountsData ?? []) as CardCycleAmount[])
  const computeCardCommitmentDebt = (commitmentCurrency: 'ARS' | 'USD') => {
    const compromisos = computeCompromisos(
      compromisoExpenses.filter((expense) => expense.currency === commitmentCurrency),
      cards,
      allCardCycles,
      null,
      selectedMonth,
      isCurrentMonth,
      activeSubscriptions,
      commitmentCurrency,
      cycleAmountsMap,
    )
    return compromisos.totalAPagar + compromisos.totalEnCurso
  }
  const liveGastosTarjetaByCurrency = {
    ARS: computeCardCommitmentDebt('ARS'),
    USD: computeCardCommitmentDebt('USD'),
  }
  const liveGastosTarjeta = liveGastosTarjetaByCurrency[viewCurrency]

  const transferAdjustmentByCurrency = {
    ARS: sumCrossCurrencyTransferAdjustment(
      (liveTransfersData ?? []) as {
        amount_from: number
        amount_to: number
        currency_from: 'ARS' | 'USD'
        currency_to: 'ARS' | 'USD'
      }[],
      'ARS',
    ),
    USD: sumCrossCurrencyTransferAdjustment(
      (liveTransfersData ?? []) as {
        amount_from: number
        amount_to: number
        currency_from: 'ARS' | 'USD'
        currency_to: 'ARS' | 'USD'
      }[],
      'USD',
    ),
  }
  const capitalInstrumentosByCurrency = FF_INSTRUMENTS
    ? {
        ARS: sumActiveInstrumentCapital(
          (liveInstrumentsData ?? []) as Pick<Instrument, 'amount' | 'currency'>[],
          'ARS',
        ),
        USD: sumActiveInstrumentCapital(
          (liveInstrumentsData ?? []) as Pick<Instrument, 'amount' | 'currency'>[],
          'USD',
        ),
      }
    : { ARS: 0, USD: 0 }

  const heroBreakdown = {
    ARS:
      liveHeroSummary.ARS.saldoInicial +
      liveHeroSummary.ARS.ingresos +
      liveHeroSummary.ARS.rendimientos -
      liveHeroSummary.ARS.gastosPercibidos -
      liveHeroSummary.ARS.pagoTarjetas +
      transferAdjustmentByCurrency.ARS -
      capitalInstrumentosByCurrency.ARS,
    USD:
      liveHeroSummary.USD.saldoInicial +
      liveHeroSummary.USD.ingresos +
      liveHeroSummary.USD.rendimientos -
      liveHeroSummary.USD.gastosPercibidos -
      liveHeroSummary.USD.pagoTarjetas +
      transferAdjustmentByCurrency.USD -
      capitalInstrumentosByCurrency.USD,
  }

  const availableBreakdown = {
    ARS: heroBreakdown.ARS - liveGastosTarjetaByCurrency.ARS,
    USD: heroBreakdown.USD - liveGastosTarjetaByCurrency.USD,
  }

  let dashboardData: DashboardData | null = rawData
  if (dashboardData?.saldo_vivo) {
    dashboardData = {
      ...dashboardData,
      saldo_vivo: {
        saldo_inicial: liveHeroSummary[viewCurrency].saldoInicial,
        ingresos: liveHeroSummary[viewCurrency].ingresos,
        gastos_percibidos: liveHeroSummary[viewCurrency].gastosPercibidos,
        pago_tarjetas: liveHeroSummary[viewCurrency].pagoTarjetas,
        rendimientos: liveHeroSummary[viewCurrency].rendimientos,
      },
      gastos_tarjeta: liveGastosTarjeta,
    }
  }

  const isProjected = false
  const hasIncomeAfterRollover = autoRolloverAmount !== null ? true : hasIncome

  return {
    dashboardData,
    heroBalanceMode,
    heroBreakdown,
    availableBreakdown,
    accounts,
    cards,
    currency,
    viewCurrency,
    hasIncomeAfterRollover,
    autoRolloverAmount,
    manualRolloverSummary,
    activeSubscriptions,
    allUltimos,
    incomeEntries,
    transfers,
    transferCurrencyAdjustment,
    earliestDataMonth,
    hasUsdExpenses,
    selectedMonth,
    isCurrentMonth,
    isProjected,
    yieldAccumulators: (yieldData ?? []) as YieldAccumulator[],
    activeInstruments,
    capitalInstrumentosMes,
    recurringPending,
    activeRecurring,
  }
}
