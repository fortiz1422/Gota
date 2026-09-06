import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { generateUniversalReceiptProposal } from '@/lib/shared-receipts/analyzer'
import { analyzeSharedReceipt, type SharedReceiptRecord } from '@/lib/shared-receipts/operations'
import type { Json } from '@/types/database'

const BUCKET = 'shared-receipts-private'
type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const result = await analyzeSharedReceipt(user.id, id, {
    claimOwned: async (ownerId, receiptId) => {
      const { data, error } = await admin
        .from('shared_receipts')
        .update({ status: 'parsing', parse_error_code: null, updated_at: new Date().toISOString() })
        .eq('id', receiptId)
        .eq('user_id', ownerId)
        .in('status', ['received', 'needs_review', 'parse_failed'])
        .select('id,user_id,status,storage_path,mime_type,parsed_payload,created_at')
        .maybeSingle()
      if (error) throw error
      return data as unknown as SharedReceiptRecord | null
    },
    downloadObject: async (path) => {
      const { data, error } = await admin.storage.from(BUCKET).download(path)
      if (error) throw error
      return new Uint8Array(await data.arrayBuffer())
    },
    generateProposal: generateUniversalReceiptProposal,
    saveProposal: async (ownerId, receiptId, proposal) => {
      const payload = JSON.parse(JSON.stringify(proposal)) as Json
      const { error } = await admin
        .from('shared_receipts')
        .update({ status: 'needs_review', parsed_payload: payload, parser_version: 'universal-v1', parse_error_code: null, updated_at: new Date().toISOString() })
        .eq('id', receiptId)
        .eq('user_id', ownerId)
        .eq('status', 'parsing')
      if (error) throw error
    },
    saveFailure: async (ownerId, receiptId, code) => {
      const { error } = await admin
        .from('shared_receipts')
        .update({ status: 'parse_failed', parse_error_code: code, updated_at: new Date().toISOString() })
        .eq('id', receiptId)
        .eq('user_id', ownerId)
        .eq('status', 'parsing')
      if (error) throw error
    },
  })
  return NextResponse.json(result.body, { status: result.status, headers: { 'Cache-Control': 'private, no-store' } })
}
