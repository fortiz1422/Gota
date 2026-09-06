import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cleanupExpiredSharedReceipts } from '@/lib/shared-receipts/lifecycle'

const BUCKET = 'shared-receipts-private'
const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Cron unavailable' }, { status: 503, headers: NO_STORE })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const result = await cleanupExpiredSharedReceipts(now, {
    expireRows: async (cutoff, statuses) => {
      const { data, error } = await admin
        .from('shared_receipts')
        .update({ status: 'expired', updated_at: cutoff })
        .in('status', [...statuses] as Array<'received' | 'needs_review' | 'parse_failed'>)
        .lt('expires_at', cutoff)
        .select('id,storage_path')
      if (error) throw error
      return data ?? []
    },
    clearStoragePath: async (receiptId, path) => {
      const { data, error } = await admin
        .from('shared_receipts')
        .update({ storage_path: null, updated_at: now })
        .eq('id', receiptId)
        .eq('status', 'expired')
        .eq('storage_path', path)
        .select('id')
        .maybeSingle()
      if (error) throw error
      return data !== null
    },
    removeObject: async (path) => {
      const { error } = await admin.storage.from(BUCKET).remove([path])
      if (error) throw error
    },
  })
  return NextResponse.json(result, { headers: NO_STORE })
}