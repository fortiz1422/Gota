import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { loadDashboardPageData } from '@/lib/server/load-dashboard-page-data'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; currency?: string }>
}) {
  const { selectedMonth, viewCurrency, userEmail, initialData, initialQuote } =
    await loadDashboardPageData({ searchParams })

  return (
    <DashboardShell
      selectedMonth={selectedMonth}
      viewCurrency={viewCurrency}
      userEmail={userEmail}
      initialData={initialData}
      initialQuote={initialQuote}
    />
  )
}
