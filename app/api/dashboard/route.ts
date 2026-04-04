import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildPrevMonthSummary, buildSmartPerAccountBalances, sumAccountBalances } from '@/lib/rollover'
import { getCurrentMonth, addMonths } from '@/lib/dates'
import { processYieldAccrual } from '@/lib/yieldEngine'
import { FF_YIELD, FF_INSTRUMENTS } from '@/lib/flags'
import { todayAR } from '@/lib/format'
import type {
  Account,
  Card,
  DashboardData,
  Expense,
  Instrument,
  IncomeEntry,
  RecurringIncome,
  RolloverMode,
  Subscription,
  Transfer,
} from '@/types/database'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processSubscriptions(supabase: any, userId: string, currentMonth: string, currentDay: number) {
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (!subs?.length) return

  const { data: insertions } = await supabase
    .from('subscription_insertions')
    .select('subscription_id')
    .eq('month', currentMonth + '-01')

  const inserted = new Set((insertions ?? []).map((i: { subscription_id: string }) => i.subscription_id))

  for (const sub of subs) {
    if (inserted.has(sub.id) || currentDay < sub.day_of_month) continue
    const expDate = `${currentMonth}-${String(sub.day_of_month).padStart(2, '0')}`
    const { data: expense } = await supabase
      .from('expenses')
      .insert({
        user_id: userId,
        subscription_id: sub.id,
        description: sub.description,
        category: sub.category,
        amount: sub.amount,
        currency: sub.currency,
        payment_method: sub.payment_method,
        card_id: sub.card_id,
        account_id: sub.account_id ?? null,
        date: expDate,
      })
      .select('id')
      .single()
    if (expense) {
      await supabase.from('subscription_insertions').upsert(
        { subscription_id: sub.id, month: currentMonth + '-01', expense_id: expense.id },
        { onConflict: 'subscription_id,month', ignoreDuplicates: true },
      )
    }
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const monthParam = searchParams.get('month')
  const currencyParam = searchParams.get('currency')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const currentMonth = getCurrentMonth()
  const selectedMonth = monthParam ?? currentMonth
  const selectedMonthDate = selectedMonth + '-01'
  const nextMonthDate = addMonths(selectedMonth, 1) + '-01'
  const isCurrentMonth = selectedMonth === currentMonth
  const todayDate = todayAR()

  const [{ data: config }, { data: accountsData }, { data: cardsData }] = await Promise.all([
    supabase
      .from('user_config')
      .select('default_currency, rollover_mode')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true }),
    supabase
      .from('cards')
      .select('*')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('created_at', { ascending: true }),
  ])

  const userCurrency = (config?.default_currency ?? 'ARS') as 'ARS' | 'USD'
  const viewCurrency = (currencyParam === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD'
  const currency = userCurrency
  const rolloverMode = (config?.rollover_mode ?? 'off') as RolloverMode
  const cards: Card[] = (cardsData ?? []) as Card[]
  const accounts: Account[] = (accountsData ?? []) as Account[]
  const accountIds = accounts.map((a) => a.id)

  // Fire-and-forget subscription auto-insert (current month only)
  void processSubscriptions(supabase, user.id, currentMonth, parseInt(todayDate.split('-')[2], 10))
  // Yield accrual: awaited antes del Promise.all para que la query de yieldData lea el valor actualizado
  if (isCurrentMonth && FF_YIELD) await processYieldAccrual(supabase, user.id, currentMonth)

  const [
    legacyIncomeResult,
    incomeEntriesResult,
    periodBalancesResult,
    { data: oldestExpense },
    { data: usdCheckData },
    { data: allUltimosData },
    { data: transfersData },
    { data: allTransfersData },
    { data: subscriptionsData },
    { data: yieldData },
    { data: instrumentsData },
    { data: recurringData },
  ] = await Promise.all([
    supabase
      .from('monthly_income')
      .select('id')
      .eq('user_id', user.id)
      .eq('month', selectedMonthDate)
      .maybeSingle(),
    supabase
      .from('income_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', selectedMonthDate)
      .lt('date', nextMonthDate)
      .order('date', { ascending: false })
      .limit(20),
    accountIds.length > 0
      ? supabase
          .from('account_period_balance')
          .select('account_id, source')
          .in('account_id', accountIds)
          .eq('period', selectedMonthDate)
      : Promise.resolve({ data: [] }),
    supabase.from('expenses').select('date').eq('user_id', user.id).order('date', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('expenses').select('id').eq('user_id', user.id).eq('currency', 'USD').limit(1).maybeSingle(),
    supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', selectedMonthDate)
      .lt('date', nextMonthDate)
      .lte('date', isCurrentMonth ? todayDate : nextMonthDate)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('transfers')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', selectedMonthDate)
      .lt('date', nextMonthDate)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('transfers')
      .select('amount_from, amount_to, currency_from, currency_to')
      .eq('user_id', user.id)
      .gte('date', selectedMonthDate)
      .lt('date', nextMonthDate),
    supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    supabase
      .from('yield_accumulator')
      .select('id, account_id, accumulated, is_manual_override, last_accrued_date, confirmed_at')
      .eq('user_id', user.id)
      .eq('month', selectedMonth),
    supabase
      .from('instruments')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('opened_at', { ascending: false }),
    supabase
      .from('recurring_incomes')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true),
  ])

  const incomeEntries = (incomeEntriesResult.data ?? []) as IncomeEntry[]
  const hasLegacyIncome = legacyIncomeResult.data !== null
  const hasConfiguredOpeningBalance = (periodBalancesResult.data ?? []).some(
    (balance) => balance.source !== 'rollover_auto',
  )
  const hasNewStyleIncome = incomeEntries.length > 0 || hasConfiguredOpeningBalance
  const hasIncome = hasLegacyIncome || hasNewStyleIncome
  const earliestDataMonth = oldestExpense?.date?.substring(0, 7) ?? null
  const hasUsdExpenses = usdCheckData !== null
  const allUltimos = (allUltimosData ?? []) as Expense[]
  const transfers = (transfersData ?? []) as Transfer[]
  const transferCurrencyAdjustment = (allTransfersData ?? []).reduce((sum, t) => {
    if (t.currency_from !== t.currency_to) {
      if (t.currency_from === viewCurrency) return sum - t.amount_from
      if (t.currency_to === viewCurrency) return sum + t.amount_to
    }
    return sum
  }, 0)
  const activeSubscriptions = (subscriptionsData ?? []) as Subscription[]

  let autoRolloverAmount: number | null = null
  let manualRolloverSummary = null
  let effectiveSaldoInicial: number | null = null

  if (rolloverMode !== 'off' && isCurrentMonth) {
    const prevMonthStr = addMonths(currentMonth, -1)
    const prevMonthDate = prevMonthStr + '-01'

    const [
      { data: prevIncome },
      { data: prevExps },
      { data: prevIncomeEntries },
      { data: prevPeriodBalances },
      { data: prevTransfers },
    ] = await Promise.all([
      supabase.from('monthly_income').select('*').eq('user_id', user.id).eq('month', prevMonthDate).maybeSingle(),
      supabase
        .from('expenses')
        .select('amount, category, payment_method, account_id, currency')
        .eq('user_id', user.id)
        .gte('date', prevMonthDate)
        .lt('date', selectedMonthDate),
      supabase.from('income_entries').select('amount, currency, account_id').eq('user_id', user.id).gte('date', prevMonthDate).lt('date', selectedMonthDate),
      accountIds.length > 0
        ? supabase
            .from('account_period_balance')
            .select('account_id, balance_ars, balance_usd')
            .in('account_id', accountIds)
            .eq('period', prevMonthDate)
        : Promise.resolve({ data: [] as { account_id: string; balance_ars: number; balance_usd: number }[] }),
      accountIds.length > 0
        ? supabase
            .from('transfers')
            .select('from_account_id, to_account_id, amount_from, amount_to, currency_from, currency_to')
            .or(`from_account_id.in.(${accountIds.join(',')}),to_account_id.in.(${accountIds.join(',')})`)
            .gte('date', prevMonthDate)
            .lt('date', selectedMonthDate)
        : Promise.resolve({ data: [] as { from_account_id: string; to_account_id: string; amount_from: number; amount_to: number; currency_from: string; currency_to: string }[] }),
    ])

    const prevBalanceSum = (prevPeriodBalances ?? []).reduce((s, b) => s + b.balance_ars + b.balance_usd, 0)
    const hasPrevData = prevIncome !== null || (prevIncomeEntries?.length ?? 0) > 0 || prevBalanceSum > 0

    if (hasPrevData) {
      const livePerAccountBalances = buildSmartPerAccountBalances(
        accounts,
        prevPeriodBalances ?? [],
        prevIncomeEntries ?? [],
        prevExps ?? [],
        prevTransfers ?? [],
      )

      // Filter expenses by currency for the global summary display
      const prevExpsForSummary = (prevExps ?? []).filter((e) => e.currency === currency)
      const summary = buildPrevMonthSummary(
        prevIncome,
        prevExpsForSummary,
        currency,
        prevMonthStr,
        prevIncomeEntries ?? [],
        prevPeriodBalances ?? [],
      )

      if (rolloverMode === 'auto' && incomeEntries.length === 0) {
        effectiveSaldoInicial = sumAccountBalances(livePerAccountBalances, viewCurrency)
        autoRolloverAmount = summary.saldoFinal
      } else if (rolloverMode === 'manual' && !hasIncome) {
        manualRolloverSummary = summary
      }
    }
  }

  // Projected saldo inicial: if navigating to the immediate next month,
  // current month is open, and rollover is enabled → use current Saldo Vivo as projected opening balance
  let projectedSaldoInicial: number | null = null
  const isNextMonth = selectedMonth === addMonths(currentMonth, 1)

  if (isNextMonth && rolloverMode !== 'off' && !hasIncome) {
    const { data: currentMonthIncome } = await supabase
      .from('monthly_income')
      .select('closed')
      .eq('user_id', user.id)
      .eq('month', currentMonth + '-01')
      .maybeSingle()

    if (!currentMonthIncome?.closed) {
      const { data: currentDashRaw } = await supabase.rpc('get_dashboard_data', {
        p_user_id: user.id,
        p_month: currentMonth + '-01',
        p_currency: viewCurrency,
      })
      const currentData = currentDashRaw as DashboardData | null
      if (currentData?.saldo_vivo) {
        const sv = currentData.saldo_vivo
        projectedSaldoInicial = sv.saldo_inicial + sv.ingresos - sv.gastos_percibidos - sv.pago_tarjetas
      }
    }
  }

  const { data: dashboardRaw } = await supabase.rpc('get_dashboard_data', {
    p_user_id: user.id,
    p_month: selectedMonthDate,
    p_currency: viewCurrency,
  })

  const rendimientosMes = FF_YIELD
    ? (yieldData ?? []).reduce((sum: number, ya: { accumulated: number }) => sum + (ya.accumulated ?? 0), 0)
    : 0

  const activeInstruments = (instrumentsData ?? []) as Instrument[]
  // Solo instrumentos abiertos en el mes seleccionado: el rollover captura el saldo
  // actualizado al pasar de mes, por lo que meses anteriores ya están reflejados en saldo_inicial
  const capitalInstrumentosMes = FF_INSTRUMENTS
    ? activeInstruments
        .filter((i) => i.opened_at.startsWith(selectedMonth) && i.currency === viewCurrency)
        .reduce((sum, i) => sum + i.amount, 0)
    : 0

  const activeRecurring = (recurringData ?? []) as RecurringIncome[]
  const todayDay = parseInt(todayDate.split('-')[2], 10)
  const linkedThisMonth = new Set(
    incomeEntries
      .filter((ie) => ie.recurring_income_id !== null)
      .map((ie) => ie.recurring_income_id as string),
  )
  const recurringPending = isCurrentMonth
    ? activeRecurring.filter((ri) => ri.day_of_month <= todayDay && !linkedThisMonth.has(ri.id))
    : []

  const rawData = dashboardRaw as DashboardData | null
  let dashboardData: DashboardData | null = rawData
  if (effectiveSaldoInicial !== null && rawData?.saldo_vivo) {
    dashboardData = {
      ...rawData,
      saldo_vivo: { ...rawData.saldo_vivo, saldo_inicial: effectiveSaldoInicial },
    }
  }
  if (projectedSaldoInicial !== null && rawData?.saldo_vivo) {
    dashboardData = { ...rawData, saldo_vivo: { ...rawData.saldo_vivo, saldo_inicial: projectedSaldoInicial } }
  }
  if (dashboardData?.saldo_vivo) {
    dashboardData = {
      ...dashboardData,
      saldo_vivo: { ...dashboardData.saldo_vivo, rendimientos: rendimientosMes },
    }
  }
  const isProjected = projectedSaldoInicial !== null
  const hasIncomeAfterRollover = autoRolloverAmount !== null ? true : hasIncome

  return NextResponse.json({
    dashboardData,
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
    yieldAccumulators: yieldData ?? [],
    activeInstruments,
    capitalInstrumentosMes,
    recurringPending,
    activeRecurring,
  })
}
