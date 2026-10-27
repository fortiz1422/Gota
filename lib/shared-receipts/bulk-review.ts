import { ReceiptProposalSchema, type ReceiptProposal } from './proposal'
import { CATEGORIES } from '@/lib/validation/schemas'
import {
  matchReceiptCard,
  type SharedReceiptSummary,
} from '@/lib/shared-receipts-ui'
import type { CounterpartyAliasMatch } from '@/lib/counterparty-aliases/resolve'
import { normalizeCounterpartyAlias } from '@/lib/counterparty-aliases/normalize'
import type { ParsePreviewConfirmPayload } from '@/components/dashboard/ParsePreview'
import type { Account, Card } from '@/types/database'
import { PAID_AI_UNAVAILABLE } from '@/lib/paid-ai-policy'

export type DraftBlockersOptions = {
  /** When false, received receipts show manual-load guidance instead of a generic blocker. */
  paidAiAvailable?: boolean
}

export const BULK_RECEIPT_LIMIT = 20
export const RECEIPT_ANALYSIS_INTERVAL_MS = 13_000
export type CategoryOrigin = 'alias' | 'rule' | 'parser' | 'user'
export type DuplicateState = 'unchecked' | 'clear' | 'possible' | 'error'
export interface BulkReviewDecisions {
  categoryReviewed: boolean
  operationReviewed: boolean
  warningsReviewed: boolean
}
export interface BulkReceiptDraft {
  receipt: SharedReceiptSummary
  evidence: ReceiptProposal | null
  payload: ParsePreviewConfirmPayload
  decisions: BulkReviewDecisions
  categoryOrigin: CategoryOrigin
  duplicates: DuplicateState
  selected: boolean
  error?: string
  confirmed?: boolean
}

/** Deliberately narrow: parser agreement + exact merchant label, never a confidence score.
 * Gas stations and person names have no automatic rule. Extend only with explicit cases.
 */
export function trustedMerchantCategory(
  evidence: ReceiptProposal
): string | null {
  if (evidence.transaction_type !== 'purchase' || evidence.warnings.length)
    return null
  const merchant = (evidence.merchant_or_counterparty ?? '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .trim()
  if (
    (merchant === 'mcdonalds' || merchant === 'mc donalds') &&
    evidence.category_suggestion === 'Restaurantes'
  ) {
    return 'Restaurantes'
  }
  return null
}

export function categoryAssignment(
  evidence: ReceiptProposal,
  match?: CounterpartyAliasMatch | null
): {
  category: string
  origin: CategoryOrigin
  accepted: boolean
} {
  if (
    match?.match_type === 'exact' &&
    match.default_category &&
    match.default_category !== 'Pago de Tarjetas'
  ) {
    return { category: match.default_category, origin: 'alias', accepted: true }
  }
  const rule = trustedMerchantCategory(evidence)
  return rule
    ? { category: rule, origin: 'rule', accepted: true }
    : {
        category: evidence.category_suggestion ?? '',
        origin: 'parser',
        accepted: false,
      }
}

function normalizedName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bbanco\s+/g, '')
    .trim()
}

export function createBulkDraft(
  receipt: SharedReceiptSummary,
  accounts: Account[],
  cards: Card[]
): BulkReceiptDraft {
  const parsed = ReceiptProposalSchema.safeParse(receipt.parsed_payload)
  const evidence = parsed.success ? parsed.data : null
  const category = evidence
    ? categoryAssignment(evidence, receipt.alias_match)
    : { category: '', origin: 'parser' as const, accepted: false }
  const method =
    evidence?.payment_rail === 'credit_card'
      ? 'CREDIT'
      : evidence?.payment_rail === 'debit_card'
        ? 'DEBIT'
        : evidence?.payment_rail === 'bank_transfer'
          ? 'TRANSFER'
          : 'CASH'
  const accountMatches = accounts.filter(
    (a) =>
      !a.archived &&
      (method === 'CASH'
        ? evidence?.payment_rail === 'cash' && a.type === 'cash'
        : evidence?.account_hint &&
          normalizedName(a.name) === normalizedName(evidence.account_hint))
  )
  const lastFourMatches = evidence?.card_last_four
    ? cards.filter(
        (c) => !c.archived && c.last_four === evidence.card_last_four
      )
    : []
  const card =
    lastFourMatches.length === 1
      ? lastFourMatches[0]
      : evidence?.card_last_four
        ? null
        : matchReceiptCard(
            cards,
            evidence?.card_brand ?? null,
            evidence?.card_issuer ?? null
          )
  return {
    receipt,
    evidence,
    payload: {
      transaction_type: 'purchase',
      description: (evidence?.merchant_or_counterparty ?? '').slice(0, 100),
      amount: evidence?.amount ?? 0,
      currency: evidence?.currency === 'USD' ? 'USD' : 'ARS',
      date: evidence?.occurred_at?.slice(0, 10) ?? '',
      category: category.category,
      payment_method: method,
      account_id:
        method !== 'CREDIT' && accountMatches.length === 1
          ? accountMatches[0].id
          : null,
      card_id: method === 'CREDIT' ? (card?.id ?? null) : null,
      installments: evidence?.installments ?? 1,
      is_want: false,
      is_recurring: false,
      is_extraordinary: false,
    },
    categoryOrigin: category.origin,
    decisions: {
      categoryReviewed: false,
      operationReviewed: false,
      warningsReviewed: false,
    },
    duplicates: 'unchecked',
    selected: true,
  }
}

export function bulkReviewBlockers(
  evidence: ReceiptProposal | null,
  payload: ParsePreviewConfirmPayload,
  decisions: BulkReviewDecisions,
  match?: CounterpartyAliasMatch | null
): string[] {
  if (!evidence) return ['Falta analizar el comprobante']
  if (
    evidence.transaction_type !== 'purchase' &&
    evidence.transaction_type !== 'third_party_transfer'
  ) {
    return ['Este tipo de operación requiere revisión individual']
  }
  const reasons: string[] = []
  if (
    evidence.operation_status === 'pending' ||
    evidence.operation_status === 'rejected'
  )
    reasons.push('La operación no está completada')
  else if (
    evidence.operation_status !== 'completed' &&
    !decisions.operationReviewed
  )
    reasons.push('Confirmá que la operación está completada')
  if (evidence.currency !== 'ARS' && evidence.currency !== 'USD')
    reasons.push('Moneda del comprobante no soportada o ausente')
  if (!Number.isFinite(payload.amount) || payload.amount <= 0)
    reasons.push('Revisá el monto')
  else if (
    Math.abs(payload.amount * 100 - Math.round(payload.amount * 100)) > 0.000001
  )
    reasons.push('El importe debe tener como máximo dos decimales')
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(payload.date) ||
    Number.isNaN(Date.parse(`${payload.date}T12:00:00Z`)) ||
    new Date(`${payload.date}T12:00:00Z`).toISOString().slice(0, 10) !==
      payload.date
  )
    reasons.push('Revisá la fecha')
  if (!payload.description.trim() || payload.description.length > 100)
    reasons.push('Completá la descripción')
  if (
    payload.payment_method === 'CREDIT'
      ? !payload.card_id || !!payload.account_id
      : !payload.account_id || !!payload.card_id
  )
    reasons.push('Elegí cuenta o tarjeta')
  if (
    !Number.isInteger(payload.installments) ||
    payload.installments < 1 ||
    payload.installments > 60 ||
    (payload.payment_method !== 'CREDIT' && payload.installments !== 1)
  )
    reasons.push('Revisá las cuotas')
  const assignment = categoryAssignment(evidence, match)
  if (
    !CATEGORIES.includes(payload.category as (typeof CATEGORIES)[number]) ||
    payload.category === 'Pago de Tarjetas'
  )
    reasons.push('Elegí categoría de compra')
  else if (
    !decisions.categoryReviewed &&
    (!assignment.accepted || assignment.category !== payload.category)
  )
    reasons.push('Revisá categoría')
  if (evidence.warnings.length && !decisions.warningsReviewed)
    reasons.push('Revisá las advertencias del comprobante')
  return reasons
}

export function draftBlockers(
  draft: BulkReceiptDraft,
  options?: DraftBlockersOptions,
): string[] {
  const reasons = bulkReviewBlockers(
    draft.evidence,
    draft.payload,
    draft.decisions,
    draft.receipt.alias_match
  )
  if (draft.receipt.status !== 'needs_review')
    reasons.unshift(
      draft.receipt.status === 'parsing'
        ? 'Analizando comprobante'
        : draft.receipt.status === 'received' &&
            options?.paidAiAvailable === false
          ? PAID_AI_UNAVAILABLE
          : 'Comprobante no preparado'
    )
  if (draft.duplicates !== 'clear')
    reasons.push(
      draft.duplicates === 'possible'
        ? 'Posible duplicado'
        : draft.duplicates === 'error'
          ? 'No pudimos verificar duplicados'
          : 'Verificando duplicados'
    )
  return reasons
}

export function categoryOriginLabel(draft: BulkReceiptDraft): string {
  if (draft.categoryOrigin === 'user') return 'Categoría elegida por vos'
  if (draft.categoryOrigin === 'alias')
    return `Alias identificado: ${draft.receipt.alias_match?.display_name ?? ''}`
  if (draft.categoryOrigin === 'rule') return 'Categoría por regla verificada'
  return draft.receipt.alias_match?.match_type === 'suggestion'
    ? `Alias sugerido: ${draft.receipt.alias_match.display_name} · requiere revisión`
    : draft.payload.category
      ? 'Categoría sugerida'
      : 'Sin categoría identificada'
}

export function sameDetectedMerchant(
  left: BulkReceiptDraft,
  right: BulkReceiptDraft
): boolean {
  const a =
    left.receipt.detected_alias ?? left.evidence?.merchant_or_counterparty
  const b =
    right.receipt.detected_alias ?? right.evidence?.merchant_or_counterparty
  if (!a || !b) return false
  try {
    return normalizeCounterpartyAlias(a) === normalizeCounterpartyAlias(b)
  } catch {
    return false
  }
}

/** Canonical receipt RPC stores the first installment separately, with remainder in the last.
 * Check both the total and first installment as duplicate candidates; never auto-merge.
 */
export function receiptDuplicateAmounts(
  payload: Pick<
    ParsePreviewConfirmPayload,
    'amount' | 'installments' | 'payment_method'
  >
): number[] {
  const first =
    payload.payment_method === 'CREDIT' && payload.installments > 1
      ? Math.floor(Math.round(payload.amount * 100) / payload.installments) /
        100
      : payload.amount
  return [...new Set([payload.amount, first])].filter(
    (amount) => Number.isFinite(amount) && amount > 0
  )
}
