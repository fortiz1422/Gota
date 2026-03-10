import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SmartInput } from '@/components/dashboard/SmartInput'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { SaldoVivo } from '@/components/dashboard/SaldoVivo'
import { FiltroEstoico } from '@/components/dashboard/FiltroEstoico'
import { Ultimos5 } from '@/components/dashboard/Ultimos5'
import { IncomeSetupModal } from '@/components/dashboard/IncomeSetupModal'
import { RolloverBanner } from '@/components/dashboard/RolloverBanner'
import { CierreMesModal } from '@/components/dashboard/CierreMesModal'
import { IncomeButton } from '@/components/dashboard/IncomeButton'
import { buildPrevMonthSummary, buildPerAccountBalances } from '@/lib/rollover'
import type { Account, Card, DashboardData, IncomeEntry, RolloverMode } from '@/types/database'
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { month } = await searchParams
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

  const currency = (config?.default_currency ?? 'ARS') as 'ARS' | 'USD'
  const rolloverMode = (config?.rollover_mode ?? 'off') as RolloverMode
  const allCards: Card[] = (config?.cards as Card[]) ?? []
  const cards: Card[] = allCards.filter((c: Card) => !c.archived)
  const accounts: Account[] = (accountsData ?? []) as Account[]
  const isCurrentMonth = selectedMonth === currentMonth
  const accountIds = accounts.map((a) => a.id)

  // Check income from all sources (legacy + new)
  const [legacyIncomeResult, incomeEntriesResult, periodBalancesResult, { data: oldestExpense }] =
    await Promise.all([
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
    ])

  const incomeEntries = (incomeEntriesResult.data ?? []) as IncomeEntry[]
  const hasLegacyIncome = legacyIncomeResult.data !== null
  const hasNewStyleIncome =
    incomeEntries.length > 0 || (periodBalancesResult.data?.length ?? 0) > 0
  const hasIncome = hasLegacyIncome || hasNewStyleIncome
  const earliestDataMonth = oldestExpense?.date?.substring(0, 7)

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
  const { data: dashboardRaw } = await supabase.rpc('get_dashboard_data', {
    p_user_id: user.id,
    p_month: selectedMonthDate,
    p_currency: currency,
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
        <DashboardHeader month={selectedMonth} earliestDataMonth={earliestDataMonth} />

        {!hasIncomeAfterRollover && isCurrentMonth && !manualRolloverSummary && (
          <IncomeSetupModal month={selectedMonth} currency={currency} />
        )}

        {autoRolloverAmount !== null && (
          <RolloverBanner amount={autoRolloverAmount} currency={currency} />
        )}

        <SaldoVivo
          data={dashboardData?.saldo_vivo ?? null}
          currency={currency}
          gastosTarjeta={dashboardData?.gastos_tarjeta ?? 0}
        />

        {(dashboardData?.ultimos_5?.length ?? 0) > 0 && (
          <FiltroEstoico data={dashboardData!.filtro_estoico} />
        )}

        <Ultimos5
          expenses={dashboardData?.ultimos_5 ?? null}
          incomeEntries={incomeEntries}
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
          background: 'linear-gradient(to bottom, transparent, #050A14)',
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
          <IncomeButton accounts={accounts} currency={currency} />
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
