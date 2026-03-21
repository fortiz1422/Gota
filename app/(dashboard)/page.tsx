import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SmartInput } from '@/components/dashboard/SmartInput'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { CurrencyToggle } from '@/components/dashboard/CurrencyToggle'
import { SaldoVivo } from '@/components/dashboard/SaldoVivo'
import { FiltroEstoico } from '@/components/dashboard/FiltroEstoico'
import { Ultimos5 } from '@/components/dashboard/Ultimos5'
import { IncomeSetupModal } from '@/components/dashboard/IncomeSetupModal'
import { RolloverBanner } from '@/components/dashboard/RolloverBanner'
import { CierreMesModal } from '@/components/dashboard/CierreMesModal'
import { HomePlusButton } from '@/components/dashboard/HomePlusButton'
import { SubscriptionReviewBanner } from '@/components/subscriptions/SubscriptionReviewBanner'
import { buildPrevMonthSummary, buildPerAccountBalances } from '@/lib/rollover'
import type { Account, Card, DashboardData, Expense, IncomeEntry, RolloverMode, Subscription, Transfer } from '@/types/database'
import type { PrevMonthSummary } from '@/lib/rollover'

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

async function processSubscriptions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  currentMonth: string,
  currentDay: number,
) {
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; currency?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { month, currency: currencyParam } = await searchParams
  const currentMonth = getCurrentMonth()
  const selectedMonth = month ?? currentMonth
  const selectedMonthDate = selectedMonth + '-01'
  const nextMonthDate = addMonths(selectedMonth, 1) + '-01'

  // Fetch config + accounts in parallel
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

  // userCurrency: default del usuario (para modales/formularios)
  // viewCurrency: moneda activa en la vista (URL param, default ARS)
  const userCurrency = (config?.default_currency ?? 'ARS') as 'ARS' | 'USD'
  const viewCurrency = (currencyParam === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD'
  const currency = userCurrency // alias para compatibilidad con código existente
  const rolloverMode = (config?.rollover_mode ?? 'off') as RolloverMode
  const allCards: Card[] = (config?.cards as Card[]) ?? []
  const cards: Card[] = allCards.filter((c: Card) => !c.archived)
  const accounts: Account[] = (accountsData ?? []) as Account[]
  const isCurrentMonth = selectedMonth === currentMonth
  const accountIds = accounts.map((a) => a.id)

  // Process subscriptions (auto-insert for current month, real date)
  const now = new Date()
  const currentDay = now.getDate()
  await processSubscriptions(supabase, user.id, currentMonth, currentDay)

  // Fetch active subscriptions for banner
  const { data: subscriptionsData } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
  const activeSubscriptions = (subscriptionsData ?? []) as Subscription[]

  // Check income from all sources (legacy + new)
  const [
    legacyIncomeResult,
    incomeEntriesResult,
    periodBalancesResult,
    { data: oldestExpense },
    { data: usdCheckData },
    { data: allUltimosData },
    { data: transfersData },
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
    supabase
      .from('expenses')
      .select('date')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    // ¿El usuario tiene algún gasto en USD?
    supabase.from('expenses').select('id').eq('user_id', user.id).eq('currency', 'USD').limit(1).maybeSingle(),
    // Últimos 5 movimientos de ambas monedas (para Ultimos5)
    supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', selectedMonthDate)
      .lt('date', nextMonthDate)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5),
    // Transferencias del mes (para Ultimos5)
    supabase
      .from('transfers')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', selectedMonthDate)
      .lt('date', nextMonthDate)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const incomeEntries = (incomeEntriesResult.data ?? []) as IncomeEntry[]
  const hasLegacyIncome = legacyIncomeResult.data !== null
  const hasNewStyleIncome =
    incomeEntries.length > 0 || (periodBalancesResult.data?.length ?? 0) > 0
  const hasIncome = hasLegacyIncome || hasNewStyleIncome
  const earliestDataMonth = oldestExpense?.date?.substring(0, 7)
  const hasUsdExpenses = usdCheckData !== null
  const allUltimos = (allUltimosData ?? []) as Expense[]
  const transfers = (transfersData ?? []) as Transfer[]

  // Rollover detection — only for current month without income
  let autoRolloverAmount: number | null = null
  let manualRolloverSummary: PrevMonthSummary | null = null

  if (rolloverMode !== 'off' && !hasIncome && isCurrentMonth) {
    const prevMonthStr = addMonths(currentMonth, -1)
    const prevMonthDate = prevMonthStr + '-01'

    const [
      { data: prevIncome },
      { data: prevExps },
      { data: prevIncomeEntries },
      { data: prevPeriodBalances },
    ] = await Promise.all([
      supabase
        .from('monthly_income')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', prevMonthDate)
        .maybeSingle(),
      supabase
        .from('expenses')
        .select('amount, category, payment_method')
        .eq('user_id', user.id)
        .eq('currency', currency)
        .gte('date', prevMonthDate)
        .lt('date', selectedMonthDate),
      supabase
        .from('income_entries')
        .select('amount, currency')
        .eq('user_id', user.id)
        .gte('date', prevMonthDate)
        .lt('date', selectedMonthDate),
      accountIds.length > 0
        ? supabase
            .from('account_period_balance')
            .select('balance_ars, balance_usd')
            .in('account_id', accountIds)
            .eq('period', prevMonthDate)
        : Promise.resolve({ data: [] as { balance_ars: number; balance_usd: number }[] }),
    ])

    // Gate: any data from previous month is enough to trigger rollover
    const prevBalanceSum = (prevPeriodBalances ?? []).reduce(
      (s, b) => s + b.balance_ars + b.balance_usd,
      0,
    )
    const hasPrevData =
      prevIncome !== null ||
      (prevIncomeEntries?.length ?? 0) > 0 ||
      prevBalanceSum > 0

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
          // Only close monthly_income if it exists
          ...(prevIncome
            ? [
                supabase
                  .from('monthly_income')
                  .update({ closed: true, closed_at: new Date().toISOString() })
                  .eq('id', prevIncome.id),
              ]
            : []),
        ])
        autoRolloverAmount = summary.saldoFinal
      } else {
        manualRolloverSummary = summary
      }
    }
  }

  // Fetch dashboard data (after potential auto rollover)
  // Usa viewCurrency para filtrar métricas (toggle ARS/USD del header)
  const { data: dashboardRaw } = await supabase.rpc('get_dashboard_data', {
    p_user_id: user.id,
    p_month: selectedMonthDate,
    p_currency: viewCurrency,
  })

  const dashboardData = dashboardRaw as DashboardData | null
  const hasIncomeAfterRollover = autoRolloverAmount !== null ? true : hasIncome

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Scrollable content */}
      <div
        className="mx-auto max-w-md px-4 pt-safe"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 180px)',
        }}
      >
        {/* Header: [ARS·USD] | Mes ∨ | [+] */}
        <div className="grid grid-cols-3 items-center pt-5">
          <div>
            <CurrencyToggle viewCurrency={viewCurrency} selectedMonth={selectedMonth} />
          </div>
          <div className="flex justify-center">
            <DashboardHeader
              month={selectedMonth}
              earliestDataMonth={earliestDataMonth}
              viewCurrency={viewCurrency}
              className=""
            />
          </div>
          <div className="flex justify-end">
            <HomePlusButton
              accounts={accounts}
              currency={currency}
              cards={cards}
              month={selectedMonth}
            />
          </div>
        </div>

        {!hasIncomeAfterRollover && isCurrentMonth && !manualRolloverSummary && (
          <IncomeSetupModal month={selectedMonth} currency={currency} />
        )}

        {autoRolloverAmount !== null && (
          <RolloverBanner amount={autoRolloverAmount} currency={currency} />
        )}

        <SaldoVivo
          data={dashboardData?.saldo_vivo ?? null}
          currency={viewCurrency}
          gastosTarjeta={dashboardData?.gastos_tarjeta ?? 0}
        />

        {(allUltimos.length > 0 || (dashboardData?.ultimos_5?.length ?? 0) > 0) && (
          <FiltroEstoico data={dashboardData!.filtro_estoico} />
        )}

        {activeSubscriptions.length > 0 && (
          <SubscriptionReviewBanner
            subscriptions={activeSubscriptions}
            currency={currency}
            cards={cards}
          />
        )}

        <Ultimos5
          expenses={allUltimos.length > 0 ? allUltimos : (dashboardData?.ultimos_5 ?? null)}
          incomeEntries={incomeEntries}
          transfers={transfers}
          accounts={accounts}
          month={selectedMonth}
        />
      </div>

      {/* Fade abisal home */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 180,
          zIndex: 46,
          pointerEvents: 'none',
          background: 'linear-gradient(to bottom, transparent, var(--color-bg-primary))',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      />

      {/* Command Input */}
      <div
        style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom) + 76px)',
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div style={{ width: '100%', maxWidth: 448, padding: '0 16px', pointerEvents: 'auto' }}>
          <SmartInput cards={cards} accounts={accounts} />
        </div>
      </div>

      {/* Manual rollover modal */}
      {manualRolloverSummary && (
        <CierreMesModal
          summary={manualRolloverSummary}
          toMonth={selectedMonth}
          currency={currency}
          accounts={accounts}
        />
      )}
    </div>
  )
}
