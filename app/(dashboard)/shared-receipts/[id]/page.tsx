import { SharedReceiptReview } from '@/components/shared-receipts/SharedReceiptReview'

export default async function SharedReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <SharedReceiptReview receiptId={id} />
}
