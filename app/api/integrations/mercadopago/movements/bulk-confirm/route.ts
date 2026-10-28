import { handleBulkConfirmation } from '@/lib/mercadopago/bulk-confirmation'
export const maxDuration = 120
export async function POST(request: Request) {
  return handleBulkConfirmation(request, false)
}
