import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
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
  const selectedMonth = month ?? getCurrentMonth()
  const viewCurrency = (currencyParam === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD'

  return <DashboardShell selectedMonth={selectedMonth} viewCurrency={viewCurrency} />
}
