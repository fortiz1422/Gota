import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider'
import { WebDashboardRoute } from '@/components/web/dashboard/WebDashboardRoute'
import { loadDashboardPageData } from '@/lib/server/load-dashboard-page-data'

export default async function WebPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; currency?: string }>
}) {
  const { selectedMonth, viewCurrency, userEmail, initialData, initialQuote } =
    await loadDashboardPageData({ searchParams })

  return (
    <ReactQueryProvider>
      <WebDashboardRoute
        selectedMonth={selectedMonth}
        viewCurrency={viewCurrency}
        userEmail={userEmail}
        initialData={initialData}
        initialQuote={initialQuote}
      />
    </ReactQueryProvider>
  )
}
