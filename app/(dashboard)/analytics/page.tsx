import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AnalyticsDataLoader } from '@/components/analytics/AnalyticsDataLoader'
import { getCurrentMonth } from '@/lib/dates'

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; drill?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { month, drill } = await searchParams
  const selectedMonth = month ?? getCurrentMonth()
  const initialDrill =
    drill === 'fuga' || drill === 'habitos' || drill === 'compromisos'
      ? drill
      : undefined

  return (
    <div className="min-h-screen bg-bg-primary overflow-x-hidden">
      <div className="mx-auto max-w-md pt-safe pb-tab-bar">
        <AnalyticsDataLoader
          selectedMonth={selectedMonth}
          initialDrill={initialDrill}
        />
      </div>
    </div>
  )
}
