import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SmartInput } from '@/components/dashboard/SmartInput'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { SaldoVivo } from '@/components/dashboard/SaldoVivo'
import { FiltroEstoico } from '@/components/dashboard/FiltroEstoico'
import { Ultimos5 } from '@/components/dashboard/Ultimos5'
import { IncomeSetupModal } from '@/components/dashboard/IncomeSetupModal'
import type { Card, DashboardData } from '@/types/database'

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
  // DB requires full DATE format (YYYY-MM-01)
  const selectedMonthDate = selectedMonth + '-01'

  // Fetch user config first (needed for currency)
  const { data: config } = await supabase
    .from('user_config')
    .select('cards, default_currency')
    .eq('user_id', user.id)
    .single()

  const currency = (config?.default_currency ?? 'ARS') as 'ARS' | 'USD'
  const allCards: Card[] = (config?.cards as Card[]) ?? []
  const cards: Card[] = allCards.filter((c: Card) => !c.archived)

  // Parallel: check income + fetch dashboard data + oldest expense month
  const [incomeResult, dashboardResult, { data: oldestExpense }] = await Promise.all([
    supabase
      .from('monthly_income')
      .select('id')
      .eq('user_id', user.id)
      .eq('month', selectedMonthDate)
      .maybeSingle(),
    supabase.rpc('get_dashboard_data', {
      p_user_id: user.id,
      p_month: selectedMonthDate,
      p_currency: currency,
    }),
    supabase
      .from('expenses')
      .select('date')
      .eq('user_id', user.id)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const hasIncome = incomeResult.data !== null
  const dashboardData = dashboardResult.data as DashboardData | null
  const earliestDataMonth = oldestExpense?.date?.substring(0, 7)
  const isCurrentMonth = selectedMonth === currentMonth

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Scrollable content */}
      <div
        className="mx-auto max-w-md px-4 pt-safe"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 160px)',
        }}
      >
        <DashboardHeader month={selectedMonth} earliestDataMonth={earliestDataMonth} />

        {!hasIncome && isCurrentMonth && (
          <IncomeSetupModal month={selectedMonth} currency={currency} />
        )}

        <SaldoVivo
          data={dashboardData?.saldo_vivo ?? null}
          currency={currency}
          gastosTarjeta={dashboardData?.gastos_tarjeta ?? 0}
        />

        {(dashboardData?.ultimos_5?.length ?? 0) > 0 && (
          <FiltroEstoico data={dashboardData!.filtro_estoico} />
        )}

        <Ultimos5 expenses={dashboardData?.ultimos_5 ?? null} month={selectedMonth} />
      </div>

      {/* Fade abisal home — sube hasta cubrir el SmartInput (pisa el fade del layout) */}
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
          background: 'linear-gradient(to bottom, transparent, #060a0e)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      />

      {/* Command Input — floating pill above TabBar */}
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
        <SmartInput cards={cards} />
        </div>
      </div>
    </div>
  )
}
