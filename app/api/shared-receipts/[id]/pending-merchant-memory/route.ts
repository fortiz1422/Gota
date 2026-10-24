import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'
import { isMissingPendingMerchantMemoryColumn } from '@/lib/shared-receipts/pending-merchant-memory'
import {
  clearPendingMerchantMemory,
  savePendingMerchantMemory,
} from '@/lib/shared-receipts/pending-merchant-memory-service'

type Params = { params: Promise<{ id: string }> }
const NO_STORE = { 'Cache-Control': 'private, no-store' }

async function authenticatedUserId() {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  return user?.id ?? null
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params
  const userId = await authenticatedUserId()
  if (!userId)
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: NO_STORE }
    )
  const body = await request.json().catch(() => null)
  const admin = createAdminClient()
  const result = await savePendingMerchantMemory(userId, id, body, {
    findOwned: async (ownerId, receiptId) => {
      const { data, error } = await admin
        .from('shared_receipts')
        .select('status')
        .eq('id', receiptId)
        .eq('user_id', ownerId)
        .maybeSingle()
      if (error) {
        if (isMissingPendingMerchantMemoryColumn(error)) return null
        throw error
      }
      return data
    },
    save: async (ownerId, receiptId, payload) => {
      const { error } = await admin
        .from('shared_receipts')
        .update({
          pending_merchant_memory: payload as Json,
          updated_at: new Date().toISOString(),
        })
        .eq('id', receiptId)
        .eq('user_id', ownerId)
        .eq('status', 'confirmed')
      if (error) {
        if (isMissingPendingMerchantMemoryColumn(error)) return false
        throw error
      }
      return true
    },
  })
  if (result.status === 204)
    return new NextResponse(null, { status: 204, headers: NO_STORE })
  return NextResponse.json(result.body, {
    status: result.status,
    headers: NO_STORE,
  })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const userId = await authenticatedUserId()
  if (!userId)
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: NO_STORE }
    )
  const admin = createAdminClient()
  const result = await clearPendingMerchantMemory(userId, id, {
    clear: async (ownerId, receiptId) => {
      const { error } = await admin
        .from('shared_receipts')
        .update({
          pending_merchant_memory: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', receiptId)
        .eq('user_id', ownerId)
      if (error) {
        if (isMissingPendingMerchantMemoryColumn(error)) return false
        throw error
      }
      return true
    },
  })
  if (result.status === 204)
    return new NextResponse(null, { status: 204, headers: NO_STORE })
  return NextResponse.json(result.body, {
    status: result.status,
    headers: NO_STORE,
  })
}
