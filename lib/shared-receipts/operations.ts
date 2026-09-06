import { createHash } from 'node:crypto'
import { z } from 'zod'
import { CATEGORIES } from '@/lib/validation/schemas'
import { parseReceiptProposal, sanitizeReceiptProposal, type ReceiptProposal } from './proposal'

export const PENDING_RECEIPT_STATUSES = [
  'received',
  'parsing',
  'needs_review',
  'parse_failed',
] as const

export interface SharedReceiptRecord {
  id: string
  user_id: string
  status: string
  storage_path: string | null
  mime_type: string
  parsed_payload: unknown
  created_at: string
  [key: string]: unknown
}

type ServiceResponse = { status: number; body: unknown; headers?: Record<string, string> }

export async function listSharedReceipts(
  userId: string | null,
  deps: { listPending: (userId: string, statuses: readonly string[]) => Promise<SharedReceiptRecord[]> },
): Promise<ServiceResponse> {
  if (!userId) return { status: 401, body: { error: 'Unauthorized' } }
  const receipts = await deps.listPending(userId, PENDING_RECEIPT_STATUSES)
  return { status: 200, body: { receipts } }
}

export async function getSharedReceipt(
  userId: string | null,
  receiptId: string,
  deps: {
    findOwned: (userId: string, receiptId: string) => Promise<SharedReceiptRecord | null>
    signObject: (path: string, expiresInSeconds: number) => Promise<string>
  },
): Promise<ServiceResponse> {
  if (!userId) return { status: 401, body: { error: 'Unauthorized' } }
  const receipt = await deps.findOwned(userId, receiptId)
  if (!receipt) return { status: 404, body: { error: 'Not found' } }
  const imageUrl = receipt.storage_path ? await deps.signObject(receipt.storage_path, 300) : null
  return {
    status: 200,
    body: { receipt: { ...receipt, storage_path: undefined, image_url: imageUrl } },
    headers: { 'Cache-Control': 'private, no-store' },
  }
}

export async function dismissSharedReceipt(
  userId: string | null,
  receiptId: string,
  deps: {
    dismissOwned: (userId: string, receiptId: string) => Promise<SharedReceiptRecord | null>
    removeObject: (path: string) => Promise<void>
  },
): Promise<ServiceResponse> {
  if (!userId) return { status: 401, body: { error: 'Unauthorized' } }
  const receipt = await deps.dismissOwned(userId, receiptId)
  if (!receipt) return { status: 404, body: { error: 'Not found' } }
  if (receipt.storage_path) {
    try {
      await deps.removeObject(receipt.storage_path)
    } catch {
      // The durable dismissal wins; object cleanup can be retried by lifecycle cleanup.
    }
  }
  return { status: 204, body: null }
}

export async function analyzeSharedReceipt(
  userId: string | null,
  receiptId: string,
  deps: {
    claimOwned: (userId: string, receiptId: string) => Promise<SharedReceiptRecord | null>
    downloadObject: (path: string) => Promise<Uint8Array>
    generateProposal: (input: { mimeType: string; bytes: Uint8Array }) => Promise<unknown>
    saveProposal: (userId: string, receiptId: string, proposal: ReceiptProposal) => Promise<void>
    saveFailure: (userId: string, receiptId: string, code: string) => Promise<void>
  },
): Promise<ServiceResponse> {
  if (!userId) return { status: 401, body: { error: 'Unauthorized' } }
  const receipt = await deps.claimOwned(userId, receiptId)
  if (!receipt || !receipt.storage_path) return { status: 404, body: { error: 'Not found' } }
  try {
    const bytes = await deps.downloadObject(receipt.storage_path)
    const proposal = sanitizeReceiptProposal(
      parseReceiptProposal(await deps.generateProposal({ mimeType: receipt.mime_type, bytes })),
    )
    await deps.saveProposal(userId, receiptId, proposal)
    return { status: 200, body: { proposal } }
  } catch {
    await deps.saveFailure(userId, receiptId, 'analysis_failed')
    return { status: 422, body: { error: 'Receipt could not be analyzed' } }
  }
}

export const ConfirmSharedPurchaseSchema = z
  .object({
    transaction_type: z.literal('purchase'),
    amount: z.number().positive().finite(),
    currency: z.enum(['ARS', 'USD']),
    category: z.enum(CATEGORIES),
    description: z.string().trim().min(1).max(100),
    is_want: z.boolean().nullable(),
    payment_method: z.enum(['CASH', 'DEBIT', 'TRANSFER', 'CREDIT']),
    account_id: z.uuid().nullable(),
    card_id: z.uuid().nullable(),
    date: z.iso.date(),
    installments: z.literal(1).default(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.payment_method === 'CREDIT' && !value.card_id) {
      context.addIssue({ code: 'custom', message: 'card_id is required for credit purchases', path: ['card_id'] })
    }
  })

export type ConfirmSharedPurchase = z.infer<typeof ConfirmSharedPurchaseSchema>

function stablePayloadHash(payload: ConfirmSharedPurchase): string {
  const ordered = Object.keys(payload)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = payload[key as keyof ConfirmSharedPurchase]
      return result
    }, {})
  return createHash('sha256').update(JSON.stringify(ordered)).digest('hex')
}

export async function confirmSharedPurchase(
  userId: string | null,
  receiptId: string,
  input: unknown,
  deps: {
    confirmAtomic: (
      userId: string,
      receiptId: string,
      payload: ConfirmSharedPurchase,
      payloadHash: string,
    ) => Promise<{ outcome: 'confirmed' | 'replay'; expense_id: string }>
  },
): Promise<ServiceResponse> {
  if (!userId) return { status: 401, body: { error: 'Unauthorized' } }
  const parsed = ConfirmSharedPurchaseSchema.safeParse(input)
  if (!parsed.success) return { status: 400, body: { error: 'Invalid purchase confirmation' } }
  const result = await deps.confirmAtomic(userId, receiptId, parsed.data, stablePayloadHash(parsed.data))
  return { status: result.outcome === 'confirmed' ? 201 : 200, body: result }
}
