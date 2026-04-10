import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { getCurrentMonth } from '@/lib/dates'
import { readDashboardData } from '@/lib/server/dashboard-queries'

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

  const { data: config } = await supabase
    .from('user_config')
    .select('onboarding_completed')
    .eq('user_id', user.id)
    .single()

  if (!config?.onboarding_completed) redirect('/onboarding')

  const { month, currency: currencyParam } = await searchParams
  const selectedMonth = month ?? getCurrentMonth()
  const viewCurrency = (currencyParam === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD'
  const initialData = await readDashboardData({
    supabase,
    userId: user.id,
    selectedMonth,
    viewCurrency,
  })

  return (
    <DashboardShell
      selectedMonth={selectedMonth}
      viewCurrency={viewCurrency}
      userEmail={user.email ?? ''}
      initialData={initialData}
    />
  )
}
