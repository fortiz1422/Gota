import { notFound } from 'next/navigation'
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider'
import { SharedReceiptReview } from '@/components/shared-receipts/SharedReceiptReview'
export default function ReceiptFixture() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return (
    <ReactQueryProvider>
      <p>Vista de prueba · Datos ficticios</p>
      <SharedReceiptReview receiptId="fixture-receipt" />
    </ReactQueryProvider>
  )
}
