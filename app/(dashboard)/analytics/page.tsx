import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { AnalyticsClient } from '@/components/analytics/AnalyticsClient'
import { computeMetrics } from '@/lib/analytics/computeMetrics'
import { evaluateInsights } from '@/lib/analytics/insights'

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default async function AnalyticsPage({
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
  const selectedMonth = month ?? getCurrentMonth()
  const startOfMonth = selectedMonth + '-01'
  const endOfMonth = addMonths(selectedMonth, 1) + '-01'

  // Fetch config first to get default_currency for expense filtering
  const { data: config } = await supabase
    .from('user_config')
    .select('default_currency')
    .eq('user_id', user.id)
    .single()

  const currency = (config?.default_currency ?? 'ARS') as 'ARS' | 'USD'

  const [{ data: rawExpenses }, { data: incomeEntries }, { data: legacyIncome }, { data: oldestExpense }] =
    await Promise.all([
      supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .eq('currency', currency)
        .neq('category', 'Pago de Tarjetas')
        .gte('date', startOfMonth)
        .lt('date', endOfMonth),
      supabase
        .from('income_entries')
        .select('amount, currency')
        .eq('user_id', user.id)
        .eq('currency', currency)
        .gte('date', startOfMonth)
        .lt('date', endOfMonth),
      supabase
        .from('monthly_income')
        .select('amount_ars, amount_usd')
        .eq('user_id', user.id)
        .eq('month', startOfMonth)
        .maybeSingle(),
      supabase
        .from('expenses')
        .select('date')
        .eq('user_id', user.id)
        .order('date', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ])

  // Priority: income_entries sum > monthly_income fallback > null
  const entriesSum = (incomeEntries ?? []).reduce((s, e) => s + e.amount, 0)
  const ingresoMes: number | null =
    entriesSum > 0
      ? entriesSum
      : legacyIncome
        ? currency === 'ARS'
          ? legacyIncome.amount_ars
          : legacyIncome.amount_usd
        : null

  const earliestDataMonth = oldestExpense?.date?.substring(0, 7)
  const metrics = computeMetrics(rawExpenses ?? [], ingresoMes, currency, selectedMonth)
  const insight = evaluateInsights(metrics)

  return (
    <div className="min-h-screen bg-bg-primary overflow-x-hidden">
      <div className="mx-auto max-w-md pt-safe pb-tab-bar">
        <div className="px-4 pb-2">
          <DashboardHeader
            month={selectedMonth}
            basePath="/analytics"
            earliestDataMonth={earliestDataMonth}
          />
        </div>
        <AnalyticsClient metrics={metrics} insight={insight} />
      </div>
    </div>
  )
}
