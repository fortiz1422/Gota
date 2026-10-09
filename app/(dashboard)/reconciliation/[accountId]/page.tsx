import { parseVisitedAccounts } from '@/lib/reconciliation/queue'
import { notFound } from 'next/navigation'
import { reconciliationEnabled } from '@/lib/reconciliation/repository'
import { ReconciliationFlow } from '@/components/reconciliation/ReconciliationFlow'
export default async function ReconciliationPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>
  searchParams: Promise<{ currency?: string; visited?: string }>
}) {
  if (!reconciliationEnabled()) notFound()
  const { accountId } = await params
  const { currency, visited } = await searchParams
  return (
    <ReconciliationFlow
      key={`${accountId}:${currency}`}
      accountId={accountId}
      visitedAccounts={parseVisitedAccounts(visited)}
      currency={currency === 'USD' ? 'USD' : 'ARS'}
    />
  )
}
