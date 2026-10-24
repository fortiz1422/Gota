import { z } from 'zod'
import type { CounterpartyAliasMatch } from '@/lib/counterparty-aliases/resolve'
import type { MerchantMemory } from '@/lib/counterparty-aliases/bulk-memory'
import type { BulkReceiptDraft } from './bulk-review'
import type { SharedReceiptSummary } from '@/lib/shared-receipts-ui'

const AliasMatchSchema = z.object({
  match_type: z.enum(['exact', 'suggestion']),
  alias_id: z.string().min(1),
  profile_id: z.string().min(1),
  alias_value: z.string(),
  normalized_value: z.string(),
  display_name: z.string(),
  default_category: z.string().nullable(),
})

export const PendingMerchantMemorySchema = z
  .object({
    memory: z
      .object({
        enabled: z.literal(true),
        mode: z.enum(['new', 'existing']),
        name: z.string(),
        profileId: z.string(),
      })
      .strict(),
    detectedAlias: z.string(),
    category: z.string().min(1),
    description: z.string(),
    aliasMatch: AliasMatchSchema.nullable().optional(),
  })
  .strict()

export type PendingMerchantMemory = z.infer<typeof PendingMerchantMemorySchema>

export interface PendingMerchantMemoryRetry extends PendingMerchantMemory {
  receiptId: string
}

export function parsePendingMerchantMemory(
  value: unknown
): PendingMerchantMemory | null {
  let candidate = value
  if (candidate && typeof candidate === 'object' && 'receiptId' in candidate) {
    const { receiptId: _ignored, ...rest } = candidate as Record<string, unknown>
    candidate = rest
  }
  const parsed = PendingMerchantMemorySchema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

export function pendingMerchantMemoryFromDraft(
  draft: BulkReceiptDraft,
  memory: MerchantMemory
): PendingMerchantMemory | null {
  if (!memory.enabled) return null
  const payload = {
    memory: {
      enabled: true as const,
      mode: memory.mode,
      name: memory.name,
      profileId: memory.profileId,
    },
    detectedAlias:
      draft.receipt.detected_alias ??
      draft.evidence?.merchant_or_counterparty ??
      '',
    category: draft.payload.category,
    description: draft.payload.description,
    aliasMatch: draft.receipt.alias_match ?? null,
  }
  const parsed = PendingMerchantMemorySchema.safeParse(payload)
  return parsed.success ? parsed.data : null
}

export function retryDraftFromPending(
  pending: PendingMerchantMemory,
  receiptId: string
): BulkReceiptDraft {
  const receipt: SharedReceiptSummary = {
    id: receiptId,
    status: 'confirmed',
    created_at: new Date(0).toISOString(),
    detected_alias: pending.detectedAlias,
    alias_match: (pending.aliasMatch ?? null) as CounterpartyAliasMatch | null,
  }
  return {
    receipt,
    evidence: null,
    payload: {
      transaction_type: 'purchase',
      amount: 0,
      currency: 'ARS',
      category: pending.category,
      description: pending.description,
      is_want: null,
      is_recurring: false,
      is_extraordinary: false,
      payment_method: 'DEBIT',
      account_id: null,
      card_id: null,
      date: '1970-01-01',
      installments: 1,
    },
    decisions: {
      categoryReviewed: true,
      operationReviewed: true,
      warningsReviewed: true,
    },
    categoryOrigin: 'user',
    duplicates: 'clear',
    selected: false,
    confirmed: true,
  }
}

export function isMissingPendingMerchantMemoryColumn(error: {
  code?: string
  message?: string
}): boolean {
  const message = (error.message ?? '').toLowerCase()
  return (
    error.code === '42703' ||
    (message.includes('pending_merchant_memory') &&
      message.includes('does not exist'))
  )
}
