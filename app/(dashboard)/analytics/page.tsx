import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { CategoryDistribution } from '@/components/analytics/CategoryDistribution'
import { NeedWantBreakdown } from '@/components/analytics/NeedWantBreakdown'
import { MonthlyTrends } from '@/components/analytics/MonthlyTrends'

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shortLabel(ym: string): string {
  const raw = new Date(ym + '-15').toLocaleDateString('es-AR', { month: 'short' })
  const clean = raw.replace('.', '').slice(0, 3)
  return clean.charAt(0).toUpperCase() + clean.slice(1)
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
  const currentMonth = getCurrentMonth()
  const selectedMonth = month ?? currentMonth

  const { data: config } = await supabase
    .from('user_config')
    .select('default_currency')
    .eq('user_id', user.id)
    .single()

  const currency = (config?.default_currency ?? 'ARS') as 'ARS' | 'USD'

  // Últimos 6 meses para tendencias (termina en selectedMonth)
  const trendMonths = Array.from({ length: 6 }, (_, i) => addMonths(selectedMonth, i - 5))
  const trendStart = trendMonths[0] + '-01'
  const trendEnd = addMonths(selectedMonth, 1) + '-01'

  // Gastos del mes seleccionado + rango de tendencias + ingresos + mes más antiguo
  const [
    { data: monthExpenses },
    { data: trendExpenses },
    { data: trendIncome },
    { data: oldestExpense },
  ] = await Promise.all([
    supabase
      .from('expenses')
      .select('category, amount, is_want')
      .eq('user_id', user.id)
      .gte('date', selectedMonth + '-01')
      .lt('date', addMonths(selectedMonth, 1) + '-01')
      .neq('category', 'Pago de Tarjetas'),
    supabase
      .from('expenses')
      .select('date, amount')
      .eq('user_id', user.id)
      .gte('date', trendStart)
      .lt('date', trendEnd)
      .neq('category', 'Pago de Tarjetas'),
    supabase
      .from('monthly_income')
      .select('month, amount_ars, amount_usd')
      .eq('user_id', user.id)
      .gte('month', trendStart)
      .lt('month', trendEnd),
    supabase
      .from('expenses')
      .select('date')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const earliestDataMonth = oldestExpense?.date?.substring(0, 7)

  // Distribución por categoría
  const categoryTotals: Record<string, number> = {}
  for (const e of monthExpenses ?? []) {
    categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + e.amount
  }
  const totalSpend = Object.values(categoryTotals).reduce((a, b) => a + b, 0)
  const categoryDist = Object.entries(categoryTotals)
    .map(([category, total]) => ({
      category,
      pct: totalSpend > 0 ? Math.round((total / totalSpend) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct)

  // Comportamiento por categoría
  const nwMap: Record<string, { wantAmount: number; needAmount: number; wantCount: number; needCount: number }> = {}
  for (const e of (monthExpenses ?? []).filter((e) => e.is_want !== null)) {
    if (!nwMap[e.category]) nwMap[e.category] = { wantAmount: 0, needAmount: 0, wantCount: 0, needCount: 0 }
    if (e.is_want) { nwMap[e.category].wantAmount += e.amount; nwMap[e.category].wantCount++ }
    else { nwMap[e.category].needAmount += e.amount; nwMap[e.category].needCount++ }
  }
  const needWantData = Object.entries(nwMap)
    .map(([category, { wantAmount, needAmount, wantCount, needCount }]) => ({
      category,
      wantAmount,
      needAmount,
      wantCount,
      needCount,
      wantPct: Math.round((wantAmount / (wantAmount + needAmount)) * 100),
    }))
    .sort((a, b) => b.wantPct - a.wantPct)

  // Tendencias: agrupar gastos e ingresos por mes
  const expenseByMonth: Record<string, number> = {}
  for (const e of trendExpenses ?? []) {
    const m = e.date.substring(0, 7)
    expenseByMonth[m] = (expenseByMonth[m] ?? 0) + e.amount
  }
  const incomeByMonth: Record<string, number> = {}
  for (const inc of trendIncome ?? []) {
    const m = inc.month.substring(0, 7)
    incomeByMonth[m] = (incomeByMonth[m] ?? 0) + (currency === 'USD' ? inc.amount_usd : inc.amount_ars)
  }
  const trendData = trendMonths.map((m) => ({
    month: m,
    label: shortLabel(m),
    expenses: expenseByMonth[m] ?? 0,
    income: incomeByMonth[m] ?? 0,
    isSelected: m === selectedMonth,
  }))

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="mx-auto max-w-md px-4 pt-safe pb-6" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        <DashboardHeader month={selectedMonth} basePath="/analytics" earliestDataMonth={earliestDataMonth} />

        <MonthlyTrends data={trendData} currency={currency} />

        <NeedWantBreakdown data={needWantData} />

        <CategoryDistribution data={categoryDist} />

        {/* Exportar datos */}
        <div className="px-2">
          <a
            href="/api/export"
            download
            className="flex w-full items-center justify-center gap-2 rounded-button py-3 text-sm text-text-secondary hover:bg-primary/5 no-underline transition-colors"
          >
            Exportar gastos (CSV)
          </a>
        </div>
      </div>
    </div>
  )
}
