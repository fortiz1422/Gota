import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { listSharedReceipts, type SharedReceiptRecord } from '@/lib/shared-receipts/operations'
import { isMissingPendingMerchantMemoryColumn } from '@/lib/shared-receipts/pending-merchant-memory'
import { listPendingMerchantMemoryRetries } from '@/lib/shared-receipts/pending-merchant-memory-service'

export async function GET() {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
  const admin = createAdminClient()
  // A terminated background invocation must not leave a receipt parsing forever.
  // Five minutes exceeds the ingest route's 60-second execution budget.
  const { error: recoveryError } = await admin.from('shared_receipts')
    .update({ status: 'parse_failed', parse_error_code: 'analysis_timeout', updated_at: new Date().toISOString() })
    .eq('user_id', user.id).eq('status', 'parsing')
    .lt('updated_at', new Date(Date.now() - 5 * 60_000).toISOString())
  if (recoveryError) return NextResponse.json({ error: 'No pudimos recuperar la bandeja.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } })
  const result = await listSharedReceipts(user.id, {
    listPending: async (userId, statuses) => {
      const { data, error } = await admin
        .from('shared_receipts')
        .select('id,status,source_kind,source_app_hint,original_filename,mime_type,created_at,expires_at')
        .eq('user_id', userId)
        .in('status', [...statuses] as Array<'received' | 'parsing' | 'needs_review' | 'parse_failed'>)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as SharedReceiptRecord[]
    },
  })
  let retries: Awaited<ReturnType<typeof listPendingMerchantMemoryRetries>> = []
  try {
    retries = await listPendingMerchantMemoryRetries(user.id, {
      listRows: async (userId) => {
        const { data, error } = await admin
          .from('shared_receipts')
          .select('id,pending_merchant_memory')
          .eq('user_id', userId)
          .eq('status', 'confirmed')
          .not('pending_merchant_memory', 'is', null)
        if (error) {
          if (isMissingPendingMerchantMemoryColumn(error)) return []
          throw error
        }
        return (data ?? []) as Array<{
          id: string
          pending_merchant_memory: unknown
        }>
      },
    })
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      isMissingPendingMerchantMemoryColumn(
        error as { code?: string; message?: string }
      )
    ) {
      retries = []
    } else {
      throw error
    }
  }
  return NextResponse.json(
    { ...(result.body as object), pendingMerchantMemoryRetries: retries },
    { status: result.status, headers: { 'Cache-Control': 'private, no-store' } }
  )
}
