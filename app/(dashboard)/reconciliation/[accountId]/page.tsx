import { notFound } from 'next/navigation'
import { reconciliationEnabled } from '@/lib/reconciliation/repository'
import { ReconciliationFlow } from '@/components/reconciliation/ReconciliationFlow'
export default async function ReconciliationPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>
  searchParams: Promise<{ currency?: string }>
}) {
  if (!reconciliationEnabled()) notFound()
  const { accountId } = await params
  const { currency } = await searchParams
  return (
    <ReconciliationFlow
      accountId={accountId}
      currency={currency === 'USD' ? 'USD' : 'ARS'}
    />
  )
}
