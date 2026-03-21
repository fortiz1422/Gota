import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildPrevMonthSummary, buildPerAccountBalances } from '@/lib/rollover'
import type {
  Account,
  Card,
  DashboardData,
  Expense,
  IncomeEntry,
  RolloverMode,
  Subscription,
  Transfer,
} from '@/types/database'

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

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

  const [{ data: config }, { data: accountsData }] = await Promise.all([
    supabase
      .from('user_config')
      .select('cards, default_currency, rollover_mode')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true }),
  ])

  const userCurrency = (config?.default_currency ?? 'ARS') as 'ARS' | 'USD'
  const viewCurrency = (currencyParam === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD'
  const currency = userCurrency
  const rolloverMode = (config?.rollover_mode ?? 'off') as RolloverMode
  const allCards: Card[] = (config?.cards as Card[]) ?? []
  const cards: Card[] = allCards.filter((c: Card) => !c.archived)
  const accounts: Account[] = (accountsData ?? []) as Account[]
  const accountIds = accounts.map((a) => a.id)

  // Fire-and-forget subscription auto-insert (current month only)
  void processSubscriptions(supabase, user.id, currentMonth, new Date().getDate())

  const [
    legacyIncomeResult,
    incomeEntriesResult,
    periodBalancesResult,
    { data: oldestExpense },
    { data: usdCheckData },
    { data: allUltimosData },
    { data: transfersData },
    { data: subscriptionsData },
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
          .select('account_id')
          .in('account_id', accountIds)
          .eq('period', selectedMonthDate)
          .limit(1)
      : Promise.resolve({ data: [] }),
    supabase.from('expenses').select('date').eq('user_id', user.id).order('date', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('expenses').select('id').eq('user_id', user.id).eq('currency', 'USD').limit(1).maybeSingle(),
    supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', selectedMonthDate)
      .lt('date', nextMonthDate)
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
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
  ])

  const incomeEntries = (incomeEntriesResult.data ?? []) as IncomeEntry[]
  const hasLegacyIncome = legacyIncomeResult.data !== null
  const hasNewStyleIncome = incomeEntries.length > 0 || (periodBalancesResult.data?.length ?? 0) > 0
  const hasIncome = hasLegacyIncome || hasNewStyleIncome
  const earliestDataMonth = oldestExpense?.date?.substring(0, 7) ?? null
  const hasUsdExpenses = usdCheckData !== null
  const allUltimos = (allUltimosData ?? []) as Expense[]
  const transfers = (transfersData ?? []) as Transfer[]
  const activeSubscriptions = (subscriptionsData ?? []) as Subscription[]

  let autoRolloverAmount: number | null = null
  let manualRolloverSummary = null

  if (rolloverMode !== 'off' && !hasIncome && isCurrentMonth) {
    const prevMonthStr = addMonths(currentMonth, -1)
    const prevMonthDate = prevMonthStr + '-01'

    const [
      { data: prevIncome },
      { data: prevExps },
      { data: prevIncomeEntries },
      { data: prevPeriodBalances },
    ] = await Promise.all([
      supabase.from('monthly_income').select('*').eq('user_id', user.id).eq('month', prevMonthDate).maybeSingle(),
      supabase
        .from('expenses')
        .select('amount, category, payment_method')
        .eq('user_id', user.id)
        .eq('currency', currency)
        .gte('date', prevMonthDate)
        .lt('date', selectedMonthDate),
      supabase.from('income_entries').select('amount, currency').eq('user_id', user.id).gte('date', prevMonthDate).lt('date', selectedMonthDate),
      accountIds.length > 0
        ? supabase
            .from('account_period_balance')
            .select('balance_ars, balance_usd')
            .in('account_id', accountIds)
            .eq('period', prevMonthDate)
        : Promise.resolve({ data: [] as { balance_ars: number; balance_usd: number }[] }),
    ])

    const prevBalanceSum = (prevPeriodBalances ?? []).reduce((s, b) => s + b.balance_ars + b.balance_usd, 0)
    const hasPrevData = prevIncome !== null || (prevIncomeEntries?.length ?? 0) > 0 || prevBalanceSum > 0

    if (hasPrevData) {
      const summary = buildPrevMonthSummary(
        prevIncome,
        prevExps ?? [],
        currency,
        prevMonthStr,
        prevIncomeEntries ?? [],
        prevPeriodBalances ?? [],
      )

      if (rolloverMode === 'auto') {
        const perAccountBalances = buildPerAccountBalances(summary.saldoFinal, accounts, currency)
        await Promise.all([
          ...perAccountBalances.map((bal) =>
            supabase.from('account_period_balance').upsert(
              {
                account_id: bal.account_id,
                period: selectedMonthDate,
                balance_ars: bal.balance_ars,
                balance_usd: bal.balance_usd,
                source: 'rollover_auto',
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'account_id,period' },
            ),
          ),
          ...(prevIncome
            ? [supabase.from('monthly_income').update({ closed: true, closed_at: new Date().toISOString() }).eq('id', prevIncome.id)]
            : []),
        ])
        autoRolloverAmount = summary.saldoFinal
      } else {
        manualRolloverSummary = summary
      }
    }
  }

  const { data: dashboardRaw } = await supabase.rpc('get_dashboard_data', {
    p_user_id: user.id,
    p_month: selectedMonthDate,
    p_currency: viewCurrency,
  })

  const dashboardData = dashboardRaw as DashboardData | null
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
    earliestDataMonth,
    hasUsdExpenses,
    selectedMonth,
    isCurrentMonth,
  })
}
