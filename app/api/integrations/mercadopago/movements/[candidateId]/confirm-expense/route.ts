import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  expenseConfirmationSchema,
  confirmMercadoPagoExpense,
} from '@/lib/mercadopago/expense-confirmation-service'
const headers = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' }
type Params = { params: Promise<{ candidateId: string }> }
export async function POST(request: Request, { params }: Params) {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user)
    return NextResponse.json(
      { error: 'unauthorized' },
      { status: 401, headers }
    )
  const parsed = expenseConfirmationSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!parsed.success)
    return NextResponse.json(
      { error: 'invalid_confirmation' },
      { status: 422, headers }
    )
  const { candidateId } = await params
  const result = await confirmMercadoPagoExpense(
    user.id,
    candidateId,
    parsed.data
  )
  return NextResponse.json(result.body, { status: result.status, headers })
}
