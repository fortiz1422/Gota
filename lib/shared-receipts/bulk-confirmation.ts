import { z } from 'zod'
import {
  ConfirmSharedPurchaseSchema,
  type ConfirmSharedPurchase,
} from './operations'
import { ReceiptProposalSchema } from './proposal'
import { bulkReviewBlockers, BULK_RECEIPT_LIMIT } from './bulk-review'
import type { CounterpartyAliasMatch } from '@/lib/counterparty-aliases/resolve'

export const BulkConfirmationSchema = z
  .object({
    entries: z
      .array(
        z
          .object({
            id: z.uuid(),
            payload: ConfirmSharedPurchaseSchema,
            decisions: z
              .object({
                categoryReviewed: z.boolean(),
                operationReviewed: z.boolean(),
                warningsReviewed: z.boolean(),
              })
              .strict(),
          })
          .strict()
      )
      .min(1)
      .max(BULK_RECEIPT_LIMIT),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.entries.map((entry) => entry.id)).size ===
      value.entries.length
  )

export type BulkConfirmationEntry = z.infer<
  typeof BulkConfirmationSchema
>['entries'][number]
export type BulkConfirmationResult = { id: string } & (
  | { outcome: 'confirmed' | 'replay'; expenseId: string }
  | { outcome: 'blocked' | 'error'; message: string }
)
export interface BulkConfirmationDeps {
  findOwned: (
    userId: string,
    id: string
  ) => Promise<{ status: string; parsed_payload: unknown } | null>
  resolveAlias: (
    userId: string,
    merchant: string
  ) => Promise<CounterpartyAliasMatch | null>
  referencesValid: (
    userId: string,
    payload: ConfirmSharedPurchase
  ) => Promise<boolean>
  hasDuplicate: (
    userId: string,
    payload: ConfirmSharedPurchase
  ) => Promise<boolean>
  confirm: (
    userId: string,
    id: string,
    payload: ConfirmSharedPurchase
  ) => Promise<{ outcome: 'confirmed' | 'replay'; expenseId: string }>
}

/** Per-receipt atomic RPC, sequential duplicate recheck, explicit partial results.
 * No client-provided readiness, alias match or duplicate flag is trusted.
 */
export async function confirmReceiptBatch(
  userId: string | null,
  input: unknown,
  deps: BulkConfirmationDeps
) {
  if (!userId) return { status: 401, body: { error: 'Unauthorized' } }
  const parsed = BulkConfirmationSchema.safeParse(input)
  if (!parsed.success)
    return {
      status: 400,
      body: { error: 'Lote inválido. Revisá los comprobantes seleccionados.' },
    }
  const results: BulkConfirmationResult[] = []
  for (const entry of parsed.data.entries) {
    try {
      const receipt = await deps.findOwned(userId, entry.id)
      if (!receipt) {
        results.push({
          id: entry.id,
          outcome: 'blocked',
          message: 'El comprobante ya no está disponible.',
        })
        continue
      }
      // Replays go through the canonical payload-hash guard. Never insert a second expense.
      if (receipt.status === 'confirmed') {
        results.push({
          id: entry.id,
          ...(await deps.confirm(userId, entry.id, entry.payload)),
        })
        continue
      }
      if (receipt.status !== 'needs_review') {
        results.push({
          id: entry.id,
          outcome: 'blocked',
          message: 'El comprobante no está preparado para confirmar.',
        })
        continue
      }
      const evidence = ReceiptProposalSchema.safeParse(receipt.parsed_payload)
      if (!evidence.success) {
        results.push({
          id: entry.id,
          outcome: 'blocked',
          message: 'No pudimos validar el comprobante.',
        })
        continue
      }
      const match = evidence.data.merchant_or_counterparty
        ? await deps.resolveAlias(
            userId,
            evidence.data.merchant_or_counterparty
          )
        : null
      const reasons = bulkReviewBlockers(
        evidence.data,
        {
          ...entry.payload,
          is_recurring: entry.payload.is_recurring ?? false,
          is_extraordinary: entry.payload.is_extraordinary ?? false,
        },
        entry.decisions,
        match
      )
      if (reasons.length) {
        results.push({
          id: entry.id,
          outcome: 'blocked',
          message: reasons.join('. '),
        })
        continue
      }
      if (!(await deps.referencesValid(userId, entry.payload))) {
        results.push({
          id: entry.id,
          outcome: 'blocked',
          message: 'La cuenta o tarjeta ya no está disponible.',
        })
        continue
      }
      if (await deps.hasDuplicate(userId, entry.payload)) {
        results.push({
          id: entry.id,
          outcome: 'blocked',
          message: 'Posible duplicado. Resolvelo en la revisión individual.',
        })
        continue
      }
      results.push({
        id: entry.id,
        ...(await deps.confirm(userId, entry.id, entry.payload)),
      })
    } catch {
      results.push({
        id: entry.id,
        outcome: 'error',
        message:
          'No pudimos confirmar este comprobante. Reintentá sin duplicarlo.',
      })
    }
  }
  return { status: 200, body: { results } }
}
