import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'
import { isMissingPendingMerchantMemoryColumn } from '@/lib/shared-receipts/pending-merchant-memory'
import type { PendingMerchantMemoryWriteOutcome } from '@/lib/shared-receipts/pending-merchant-memory-service'
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

function writeOutcomeFromUpdate(
  error: { code?: string; message?: string } | null,
  data: { id: string } | null
): PendingMerchantMemoryWriteOutcome {
  if (error) {
    if (isMissingPendingMerchantMemoryColumn(error)) return 'unavailable'
    throw error
  }
  return data ? 'saved' : 'not_found'
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
      const { data, error } = await admin
        .from('shared_receipts')
        .update({
          pending_merchant_memory: payload as Json,
          updated_at: new Date().toISOString(),
        })
        .eq('id', receiptId)
        .eq('user_id', ownerId)
        .eq('status', 'confirmed')
        .select('id')
        .maybeSingle()
      return writeOutcomeFromUpdate(error, data)
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
      const { data, error } = await admin
        .from('shared_receipts')
        .update({
          pending_merchant_memory: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', receiptId)
        .eq('user_id', ownerId)
        .not('pending_merchant_memory', 'is', null)
        .select('id')
        .maybeSingle()
      return writeOutcomeFromUpdate(error, data)
    },
  })
  if (result.status === 204)
    return new NextResponse(null, { status: 204, headers: NO_STORE })
  return NextResponse.json(result.body, {
    status: result.status,
    headers: NO_STORE,
  })
}
