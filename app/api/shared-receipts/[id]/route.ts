import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { enrichSharedReceiptPreview } from '@/lib/counterparty-aliases/preview'
import { resolveSavedCounterparty } from '@/lib/counterparty-aliases/server'
import {
  dismissSharedReceipt,
  getSharedReceipt,
  type SharedReceiptRecord,
} from '@/lib/shared-receipts/operations'

const BUCKET = 'shared-receipts-private'
type Params = { params: Promise<{ id: string }> }
const NO_STORE = { 'Cache-Control': 'private, no-store' }

async function authenticatedUserId() {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  return user?.id ?? null
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const userId = await authenticatedUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  const admin = createAdminClient()
  const result = await getSharedReceipt(userId, id, {
    findOwned: async (ownerId, receiptId) => {
      const { data, error } = await admin
        .from('shared_receipts')
        .select('id,user_id,status,source_kind,source_app_hint,original_filename,mime_type,byte_size,storage_path,parsed_payload,parser_version,parse_error_code,created_at,updated_at,expires_at,matched_expense_id,confirmed_at,dismissed_at')
        .eq('id', receiptId)
        .eq('user_id', ownerId)
        .maybeSingle()
      if (error) throw error
      return data as unknown as SharedReceiptRecord | null
    },
    signObject: async (path, expiresIn) => {
      const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, expiresIn)
      if (error) throw error
      return data.signedUrl
    },
  })
  const body = result.body as { receipt?: Record<string, unknown> }
  const receipt = body.receipt
  if (result.status === 200 && receipt) {
    const parsedPayload = receipt.parsed_payload
    const merchant = parsedPayload && typeof parsedPayload === 'object'
      ? (parsedPayload as Record<string, unknown>).merchant_or_counterparty
      : null
    let match = null
    if (typeof merchant === 'string') {
      try {
        match = await resolveSavedCounterparty(admin, userId, merchant)
      } catch {
        // Alias memory is additive; receipt review must remain available.
      }
    }
    return NextResponse.json({
      ...body,
      receipt: { ...receipt, ...enrichSharedReceiptPreview(parsedPayload, match) },
    }, { status: result.status, headers: { ...NO_STORE, ...result.headers } })
  }
  return NextResponse.json(result.body, { status: result.status, headers: { ...NO_STORE, ...result.headers } })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const userId = await authenticatedUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  const admin = createAdminClient()
  const result = await dismissSharedReceipt(userId, id, {
    dismissOwned: async (ownerId, receiptId) => {
      const { data: existing, error: findError } = await admin
        .from('shared_receipts')
        .select('id,user_id,status,storage_path,mime_type,parsed_payload,created_at')
        .eq('id', receiptId)
        .eq('user_id', ownerId)
        .in('status', ['received', 'parsing', 'needs_review', 'parse_failed'])
        .maybeSingle()
      if (findError) throw findError
      if (!existing) return null
      const { data, error } = await admin
        .from('shared_receipts')
        .update({ status: 'dismissed', storage_path: null, dismissed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', receiptId)
        .eq('user_id', ownerId)
        .eq('status', existing.status)
        .select('id')
        .maybeSingle()
      if (error) throw error
      return data ? existing as unknown as SharedReceiptRecord : null
    },
    removeObject: async (path) => {
      const { error } = await admin.storage.from(BUCKET).remove([path])
      if (error) throw error
    },
  })
  if (result.status === 204) return new NextResponse(null, { status: 204, headers: NO_STORE })
  return NextResponse.json(result.body, { status: result.status, headers: NO_STORE })
}
