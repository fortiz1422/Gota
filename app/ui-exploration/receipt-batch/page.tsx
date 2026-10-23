import { notFound } from 'next/navigation'
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider'
import { SharedReceiptBatchReview } from '@/components/shared-receipts/SharedReceiptBatchReview'

/** Uses real components and intercepted synthetic APIs in Playwright; never a production auth bypass. */
export default function ReceiptBatchReviewFixture() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return (
    <ReactQueryProvider>
      <p className="bg-bg-tertiary text-text-secondary px-4 py-2 text-center text-xs">
        Vista de prueba · Datos ficticios
      </p>
      <SharedReceiptBatchReview />
    </ReactQueryProvider>
  )
}
