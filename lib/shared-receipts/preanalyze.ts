import { createAdminClient } from '@/lib/supabase/admin'
import { canUsePaidAI } from '@/lib/paid-ai-policy'
import { checkRateLimit } from '@/lib/rate-limit'
import { generateUniversalReceiptProposal } from './analyzer'
import { analyzeSharedReceipt, type SharedReceiptRecord } from './operations'
import type { Json } from '@/types/database'

/** One attempt after ingest. CAS prevents double analysis; inbox provides bounded fallback.
 * No financial writes. Uses the same paid-AI policy and rate budget as manual analysis.
 */
export async function preanalyzeReceivedReceipt(
  userId: string,
  receiptId: string
): Promise<void> {
  const admin = createAdminClient()
  const {
    data: { user },
    error,
  } = await admin.auth.admin.getUserById(userId)
  if (
    error ||
    !user ||
    !canUsePaidAI(user) ||
    !checkRateLimit(`receipt-ai:${userId}`, 5)
  )
    return
  await analyzeSharedReceipt(userId, receiptId, {
    claimOwned: async (ownerId, id) => {
      const { data, error: claimError } = await admin
        .from('shared_receipts')
        .update({
          status: 'parsing',
          parse_error_code: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', ownerId)
        .eq('status', 'received')
        .select(
          'id,user_id,status,storage_path,mime_type,parsed_payload,created_at'
        )
        .maybeSingle()
      if (claimError) throw claimError
      return data as unknown as SharedReceiptRecord | null
    },
    downloadObject: async (path) => {
      const { data, error: downloadError } = await admin.storage
        .from('shared-receipts-private')
        .download(path)
      if (downloadError) throw downloadError
      return new Uint8Array(await data.arrayBuffer())
    },
    generateProposal: generateUniversalReceiptProposal,
    saveProposal: async (ownerId, id, proposal) => {
      const { error: saveError } = await admin
        .from('shared_receipts')
        .update({
          status: 'needs_review',
          parsed_payload: JSON.parse(JSON.stringify(proposal)) as Json,
          parser_version: 'universal-v2-status',
          parse_error_code: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', ownerId)
        .eq('status', 'parsing')
      if (saveError) throw saveError
    },
    saveFailure: async (ownerId, id, code) => {
      const { error: failureError } = await admin
        .from('shared_receipts')
        .update({
          status: 'parse_failed',
          parse_error_code: code,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', ownerId)
        .eq('status', 'parsing')
      if (failureError) throw failureError
    },
  })
}
