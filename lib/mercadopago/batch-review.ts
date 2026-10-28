import { CATEGORIES } from '@/lib/validation/schemas'
import { matchMercadoPagoCard } from './card-matcher'
import {
  buildConfirmExpensePayload,
  getInitialExpenseDescription,
  getMercadoPagoReviewCapability,
  isReviewableMercadoPagoCardPurchase,
  isReviewableMercadoPagoWalletPayment,
  getMercadoPagoDisplayAmount,
  type MercadoPagoMovement,
} from './review'
import type { Card } from '@/types/database'

export type BatchDraft = {
  movement: MercadoPagoMovement
  description: string
  category: string
  cardId: string
  isWant: boolean
  isRecurring: boolean
  isExtraordinary: boolean
}
export type BatchAccountLink = {
  linkedAccountId: string | null
  linkedAccountVersion: number
}
export type BatchEntry = {
  candidateId: string
  body: ReturnType<typeof buildBatchBody>
}

/** Funding identity only. Never a merchant/category inference or a grouping by amount. */
export function cardEvidenceKey(movement: MercadoPagoMovement) {
  const source = movement.fundingSource
  if (
    !isReviewableMercadoPagoCardPurchase(movement) ||
    !/^\d{4}$/.test(source?.lastFour ?? '') ||
    !source?.brand?.trim()
  )
    return null
  const brand = source.brand
    .trim()
    .toLowerCase()
    .replace(/^mastercard$/, 'master')
  return `${brand}:${source.lastFour}`
}
/** Preview uses the same branch and balance date as confirm-expense, including PAYOUTS. */
export function batchEvidence(movement: MercadoPagoMovement) {
  const payment =
    isReviewableMercadoPagoCardPurchase(movement) ||
    isReviewableMercadoPagoWalletPayment(movement)
  return {
    amount: payment
      ? getMercadoPagoDisplayAmount(movement)
      : movement.balanceImpact.amount,
    date: payment ? movement.occurredAt : movement.balanceOccurredAt,
  }
}
export function createBatchDraft(
  movement: MercadoPagoMovement,
  cards: Card[]
): BatchDraft {
  const match = matchMercadoPagoCard(movement.fundingSource, cards)
  return {
    movement,
    description: getInitialExpenseDescription(movement),
    category: '',
    cardId: match.status === 'exact' ? match.cardId : '',
    isWant: false,
    isRecurring: false,
    isExtraordinary: false,
  }
}
export function batchBlocker(
  draft: BatchDraft,
  cards: Card[],
  link: BatchAccountLink | null
): string | null {
  if (
    getMercadoPagoReviewCapability(draft.movement).mode !== 'confirmable' ||
    draft.movement.attention === 'possible_duplicate'
  )
    return 'Requiere revisión individual'
  if (!/^[a-f0-9]{64}$/.test(draft.movement.reviewSnapshot?.fingerprint ?? ''))
    return 'Actualizá la bandeja'
  if (!draft.description.trim() || draft.description.trim().length > 100)
    return 'Completá la descripción'
  if (!CATEGORIES.includes(draft.category as (typeof CATEGORIES)[number]))
    return 'Elegí una categoría'
  if (isReviewableMercadoPagoCardPurchase(draft.movement)) {
    if (draft.category === 'Pago de Tarjetas')
      return 'Una compra no es un pago de tarjeta'
    if (!cards.some((card) => card.id === draft.cardId && !card.archived))
      return 'Elegí una tarjeta activa'
  } else if (
    !link?.linkedAccountId ||
    !Number.isInteger(link.linkedAccountVersion) ||
    link.linkedAccountVersion < 0
  )
    return 'Vinculá la cuenta de saldo MP en Configuración'
  return null
}
export function buildBatchBody(
  draft: BatchDraft,
  link: BatchAccountLink | null
) {
  return {
    expectedCandidateFingerprint: draft.movement.reviewSnapshot?.fingerprint,
    ...buildConfirmExpensePayload({
      description: draft.description,
      category: draft.category,
      isWant: draft.isWant,
      isRecurring: draft.isRecurring,
      isExtraordinary: draft.isExtraordinary,
      expectedLinkedAccountId: link?.linkedAccountId ?? '',
      expectedLinkedAccountVersion: link?.linkedAccountVersion ?? -1,
      ...(isReviewableMercadoPagoCardPurchase(draft.movement)
        ? { cardId: draft.cardId, installments: draft.movement.installments! }
        : {}),
    }),
  }
}

/** One approved payload, one submission. Never auto-retry an uncertain write. */
export async function submitBatch(
  entries: readonly BatchEntry[],
  send: (
    entries: readonly BatchEntry[],
    signal: AbortSignal
  ) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>,
  onConfirmed: (id: string) => void,
  timeoutMs = 130_000
) {
  if (
    !entries.length ||
    entries.length > 200 ||
    new Set(entries.map((entry) => entry.candidateId)).size !== entries.length
  )
    throw new Error('invalid_batch')
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const result = await Promise.race([
      (async () => {
        const response = await send(entries, controller.signal)
        const body = (await response.json()) as {
          status?: string
          results?: { candidateId: string; expenseId: string }[]
          remaining?: number
          blocked?: { status?: number }
        }
        if (
          !response.ok ||
          !Array.isArray(body.results) ||
          !['completed', 'stopped'].includes(body.status ?? '')
        )
          throw new Error('uncertain_batch')
        const results = body.results
        if (
          results.length > entries.length ||
          body.remaining !== entries.length - results.length ||
          results.some(
            (item, index) =>
              item?.candidateId !== entries[index].candidateId ||
              typeof item.expenseId !== 'string' ||
              !item.expenseId
          ) ||
          (body.status === 'completed'
            ? results.length !== entries.length
            : results.length === entries.length)
        )
          throw new Error('invalid_batch_response')
        return {
          results,
          stopped: body.status === 'stopped',
          status:
            body.status === 'stopped'
              ? (body.blocked?.status ?? 409)
              : response.status,
        }
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new Error('timeout'))
        }, timeoutMs)
      }),
    ])
    result.results.forEach((item) => onConfirmed(item.candidateId))
    return {
      confirmed: result.results.length,
      stopped: result.stopped,
      status: result.status,
    }
  } catch {
    return { confirmed: 0, stopped: true, status: 0 }
  } finally {
    if (timer) clearTimeout(timer)
  }
}
