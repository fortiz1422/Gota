import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AnalyticsDataLoader } from '@/components/analytics/AnalyticsDataLoader'
import { getCurrentMonth } from '@/lib/dates'
import {
  parseAnalyticsRouteState,
  type AnalyticsSearchParams,
} from '@/lib/analytics/analytics-route-state'
import { FF_ANALYTICS_WORKSPACE_V1 } from '@/lib/flags'

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<AnalyticsSearchParams>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const routeState = parseAnalyticsRouteState(await searchParams)
  const selectedMonth = routeState.month ?? getCurrentMonth()
  const initialView = FF_ANALYTICS_WORKSPACE_V1
    ? routeState.view
    : routeState.drill
      ? 'insights'
      : 'summary'

  return (
    <div className="min-h-screen bg-bg-primary overflow-x-clip">
      <div className="mx-auto max-w-md">
        <AnalyticsDataLoader
          selectedMonth={selectedMonth}
          initialView={initialView}
          initialDrill={routeState.drill}
        />
      </div>
    </div>
  )
}
