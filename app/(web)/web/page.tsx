import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider'
import { WebDashboardRoute } from '@/components/web/dashboard/WebDashboardRoute'
import { loadDashboardPageData } from '@/lib/server/load-dashboard-page-data'
import { parseWebNavView } from '@/lib/web-panel/navigation'

export default async function WebPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; currency?: string; view?: string }>
}) {
  const { view } = await searchParams
  const initialView = parseWebNavView(view)
  const { selectedMonth, viewCurrency, userEmail, initialData, initialQuote } =
    await loadDashboardPageData({ searchParams })

  return (
    <ReactQueryProvider>
      <WebDashboardRoute
        key={`${selectedMonth}:${viewCurrency}:${initialView}`}
        selectedMonth={selectedMonth}
        viewCurrency={viewCurrency}
        userEmail={userEmail}
        initialData={initialData}
        initialQuote={initialQuote}
        initialView={initialView}
      />
    </ReactQueryProvider>
  )
}
