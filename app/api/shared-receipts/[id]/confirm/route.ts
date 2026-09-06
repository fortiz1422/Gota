import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { confirmSharedPurchase } from '@/lib/shared-receipts/operations'
import type { Json } from '@/types/database'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const admin = createAdminClient()
  try {
    const result = await confirmSharedPurchase(user.id, id, body, {
      confirmAtomic: async (userId, receiptId, payload, payloadHash) => {
        const rpcPayload = JSON.parse(JSON.stringify(payload)) as Json
        const { data, error } = await admin.rpc('confirm_shared_receipt_purchase', {
          p_user_id: userId,
          p_receipt_id: receiptId,
          p_payload: rpcPayload,
          p_payload_hash: payloadHash,
        })
        if (error) throw error
        const row = data?.[0]
        if (!row) throw new Error('Empty confirmation result')
        return row
      },
    })
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
    const status = code === 'P0002' ? 404 : code === '23505' || code === '55000' ? 409 : 500
    return NextResponse.json({ error: status === 404 ? 'Not found' : status === 409 ? 'Confirmation conflict' : 'Confirmation failed' }, { status })
  }
}
