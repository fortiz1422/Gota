import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { listSharedReceipts, type SharedReceiptRecord } from '@/lib/shared-receipts/operations'

export async function GET() {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
  const admin = createAdminClient()
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
  return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'private, no-store' } })
}
