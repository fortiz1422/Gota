import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { CATEGORIES } from '@/lib/validation/schemas'
import {
  getMercadoPagoConnection,
  getMercadoPagoMovementObservations,
  type MercadoPagoConnection,
} from '@/lib/mercadopago/server-repository'
import {
  buildCanonicalSemantics,
  buildConfirmationIntentHash,
  candidateFingerprint,
  eligibleMercadoPagoExpense,
  expectedObservations,
  getMercadoPagoCardPurchaseAmount,
  getMercadoPagoOperationKey,
  isEligibleCreditCardPurchase,
  isEligibleMercadoPagoWalletPayment,
  reconstructMercadoPagoCandidates,
} from '@/lib/mercadopago/confirm-expense'
import { MP_DECISION_RULE_VERSION } from '@/lib/mercadopago/posting-decision'
import { readMercadoPagoDuplicateSnapshot } from '@/lib/mercadopago/duplicate-resolution'
import { sha256 } from '@/lib/mercadopago/confirm-expense'
import { checkMercadoPagoLedgerDuplicate } from '@/lib/mercadopago/ledger-matcher-repository'
import { getArgentinaBusinessDate } from '@/lib/mercadopago/review'
import { buildMercadoPagoCardPurchasePlan } from '@/lib/mercadopago/card-purchase-plan'
import { toFinancialEvent } from '@/lib/mercadopago/financial-event'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { MercadoPagoCardReferenceCache } from './card-purchase-plan'
export const expenseConfirmationSchema = z
  .object({
    description: z.string().trim().min(1).max(100),
    category: z.enum(CATEGORIES),
    isWant: z.boolean(),
    isRecurring: z.boolean().default(false),
    isExtraordinary: z.boolean().default(false),
    expectedCandidateFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    expectedLinkedAccountId: z.string().uuid().optional(),
    expectedLinkedAccountVersion: z.number().int().nonnegative().optional(),
    cardId: z.string().uuid().optional(),
    installments: z.number().int().min(1).max(72).optional(),
    duplicateResolution: z
      .object({
        action: z.enum(['link_existing', 'keep_both']),
        expenseId: z.string().uuid().optional(),
        fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict()
      .optional(),
  })
  .strict()

export type ExpenseConfirmationInput = z.infer<typeof expenseConfirmationSchema>
export type ExpenseConfirmationOutcome = {
  status: number
  body: { error?: string; status?: string; expenseId?: string }
}
const json = (
  body: ExpenseConfirmationOutcome['body'],
  status: number
): ExpenseConfirmationOutcome => ({ status, body })
export type ExpenseConfirmationContext = {
  userId: string
  connection: MercadoPagoConnection
  candidates: Map<
    string,
    ReturnType<typeof reconstructMercadoPagoCandidates>[number]
  >
  admin: ReturnType<typeof createAdminClient>
  cardReferences: MercadoPagoCardReferenceCache
}
export async function loadExpenseConfirmationContext(
  userId: string
): Promise<ExpenseConfirmationContext | null> {
  const connection = await getMercadoPagoConnection(userId)
  if (!connection) return null
  const observations = await getMercadoPagoMovementObservations(
    userId,
    connection.id,
    100
  )
  const candidates = reconstructMercadoPagoCandidates(connection, observations)
  return {
    userId,
    connection,
    candidates: new Map(
      candidates.map((candidate) => [candidate.candidateId, candidate])
    ),
    admin: createAdminClient(),
    cardReferences: new Map(),
  }
}
/** Same financial guards and RPCs as individual review, with request-scoped shared reads. */
export async function confirmMercadoPagoExpense(
  userId: string,
  candidateId: string,
  parsed: ExpenseConfirmationInput,
  context?: ExpenseConfirmationContext,
  prepareOnly = false
): Promise<ExpenseConfirmationOutcome> {
  const user = { id: userId }
  try {
    const connection =
      context?.connection ?? (await getMercadoPagoConnection(user.id))
    if (!connection) return json({ error: 'not_found' }, 404)
    if (context && context.userId !== userId)
      return json({ error: 'not_found' }, 404)
    const candidate = context
      ? context.candidates.get(candidateId)
      : reconstructMercadoPagoCandidates(
          connection,
          await getMercadoPagoMovementObservations(user.id, connection.id, 100)
        ).find((item) => item.candidateId === candidateId)
    if (!candidate) return json({ error: 'not_found' }, 404)
    if (parsed.expectedCandidateFingerprint !== candidateFingerprint(candidate))
      return json({ error: 'conflict' }, 409)
    const isCard = parsed.cardId !== undefined
    const isWalletPayment =
      !isCard && isEligibleMercadoPagoWalletPayment(candidate)
    const operationKey = isWalletPayment
      ? getMercadoPagoOperationKey(connection.id, candidate)
      : null
    if (isCard && parsed.category === 'Pago de Tarjetas')
      return json({ error: 'invalid_confirmation' }, 422)
    if (
      isCard
        ? !isEligibleCreditCardPurchase(candidate)
        : isWalletPayment
          ? !operationKey
          : !eligibleMercadoPagoExpense(candidate)
    )
      return json({ error: 'ineligible' }, 422)
    if (
      isCard &&
      (!parsed.cardId || parsed.installments !== candidate.installments)
    )
      return json({ error: 'invalid_confirmation' }, 422)
    if (
      !isCard &&
      (!parsed.expectedLinkedAccountId ||
        parsed.expectedLinkedAccountVersion === undefined)
    )
      return json({ error: 'invalid_confirmation' }, 422)
    if (
      isCard &&
      (candidate.installments! > 1 ||
        getMercadoPagoCardPurchaseAmount(candidate) !==
          candidate.amount.value) &&
      process.env.MERCADOPAGO_CARD_INSTALLMENTS_ENABLED !== 'true'
    )
      return json({ error: 'installments_not_enabled' }, 503)
    const amount = isCard
      ? getMercadoPagoCardPurchaseAmount(candidate)!
      : isWalletPayment
        ? candidate.amount.value!
        : Math.abs(candidate.balanceImpact.amount.value!)
    const currency =
      isCard || isWalletPayment
        ? candidate.amount.currency!
        : candidate.balanceImpact.amount.currency!
    const date = getArgentinaBusinessDate(
      isCard || isWalletPayment
        ? candidate.occurredAt
        : candidate.balanceOccurredAt
    )!
    const admin = (context?.admin ?? createAdminClient()) as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>
      ) => Promise<{ data: string | string[] | null; error: unknown }>
    }
    const postingEnabled =
      !isCard &&
      !isWalletPayment &&
      process.env.MERCADOPAGO_POSTING_ENABLED === 'true'
    if (parsed.duplicateResolution && (!postingEnabled || isCard))
      return json({ error: 'resolution_not_enabled' }, 503)
    let duplicateSnapshot: Awaited<
      ReturnType<typeof readMercadoPagoDuplicateSnapshot>
    > | null = null
    if (postingEnabled) {
      duplicateSnapshot = await readMercadoPagoDuplicateSnapshot(
        admin as unknown as SupabaseClient,
        user.id,
        candidate,
        connection.linked_account_id
      )
      if (
        parsed.duplicateResolution &&
        (parsed.duplicateResolution.fingerprint !==
          duplicateSnapshot.fingerprint ||
          (parsed.duplicateResolution.action === 'link_existing' &&
            !duplicateSnapshot.rows.some(
              (row) => row.id === parsed.duplicateResolution!.expenseId
            )))
      )
        return json({ error: 'conflict' }, 409)
    }
    if (!isCard && !postingEnabled) {
      // Check the expense the user is confirming, while keeping the provider
      // classification intact. PAYOUTS may have unknown funding in raw evidence.
      const event = toFinancialEvent(candidate)
      const duplicate = await checkMercadoPagoLedgerDuplicate(
        admin as unknown as SupabaseClient,
        user.id,
        {
          ...event,
          economicType: 'expense',
          funding: 'mp_balance',
          amount: { value: amount, currency },
          occurredAt: isWalletPayment
            ? candidate.occurredAt
            : candidate.balanceOccurredAt,
        },
        connection.linked_account_id
      )
      if (!duplicate.checked) return json({ error: 'dedupe_unavailable' }, 503)
      if (duplicate.matches.length > 0)
        return json({ error: 'possible_duplicate' }, 409)
    }
    const cardPlan =
      isCard && process.env.MERCADOPAGO_CARD_INSTALLMENTS_ENABLED === 'true'
        ? await buildMercadoPagoCardPurchasePlan(
            admin as unknown as SupabaseClient,
            {
              userId: user.id,
              cardId: parsed.cardId!,
              amount,
              currency: currency as 'ARS' | 'USD',
              date,
              installments: candidate.installments!,
              description: parsed.description,
              category: parsed.category,
              isWant: parsed.isWant,
              referenceCache: context?.cardReferences,
            }
          )
        : null
    const semantics = buildCanonicalSemantics()
    const linkingExisting =
      postingEnabled && parsed.duplicateResolution?.action === 'link_existing'
    const rpcName = isCard
      ? cardPlan
        ? 'confirm_mercadopago_card_purchase_with_tags'
        : 'confirm_mercadopago_card_expense_with_tags'
      : isWalletPayment
        ? 'confirm_mercadopago_wallet_expense_with_tags'
        : postingEnabled
          ? linkingExisting
            ? 'post_mercadopago_balance_event'
            : 'post_mercadopago_balance_event_with_tags'
          : 'confirm_mercadopago_expense_with_tags'
    if (prepareOnly) return json({ status: 'ready' }, 200)
    const { data, error } = await admin.rpc(rpcName, {
      p_user_id: user.id,
      p_connection_id: connection.id,
      p_candidate_id: candidateId,
      p_candidate_fingerprint: candidateFingerprint(candidate),
      p_intent_hash: parsed.duplicateResolution
        ? sha256(
            JSON.stringify([
              buildConfirmationIntentHash(parsed),
              parsed.duplicateResolution,
            ])
          )
        : buildConfirmationIntentHash({
            ...parsed,
            cardId: parsed.cardId,
            installments: isCard ? candidate.installments! : undefined,
          }),
      p_expected_observations: expectedObservations(candidate),
      p_amount: amount,
      p_currency: currency,
      p_date: date,
      p_category: parsed.category,
      p_description: parsed.description,
      p_is_want: parsed.isWant,
      ...(!linkingExisting
        ? {
            p_is_recurring: parsed.isRecurring,
            p_is_extraordinary: parsed.isExtraordinary,
          }
        : {}),
      ...(isCard
        ? {
            p_card_id: parsed.cardId,
            p_installments: candidate.installments,
            ...(cardPlan ? { p_plan: cardPlan } : {}),
          }
        : isWalletPayment
          ? {
              p_operation_key: operationKey,
              p_expected_linked_account_id: parsed.expectedLinkedAccountId,
              p_expected_linked_account_version:
                parsed.expectedLinkedAccountVersion,
            }
          : {
              p_expected_linked_account_id: parsed.expectedLinkedAccountId,
              p_expected_linked_account_version:
                parsed.expectedLinkedAccountVersion,
              p_evidence_kind: 'balance_debit_known',
              p_canonical_semantics:
                parsed.duplicateResolution?.action === 'link_existing'
                  ? { ...semantics, classification: 'linked_existing' }
                  : semantics,
              ...(postingEnabled
                ? {
                    p_action: parsed.duplicateResolution?.action ?? 'post',
                    p_existing_expense_id:
                      parsed.duplicateResolution?.expenseId ?? null,
                    p_expected_duplicates: duplicateSnapshot!.rows,
                    p_decision_source: 'human',
                    p_rule_version: MP_DECISION_RULE_VERSION,
                  }
                : {}),
            }),
    })
    if (error || !data) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String(error.code)
          : ''
      if (code === 'P0002') return json({ error: 'not_found' }, 404)
      if (code === '23505' || code === '55000')
        return json({ error: 'conflict' }, 409)
      if (code === '22023') return json({ error: 'invalid_confirmation' }, 422)
      return json({ error: 'confirmation_failed' }, 500)
    }
    if (
      context &&
      isCard &&
      cardPlan &&
      Array.isArray(cardPlan.existing_cycles)
    ) {
      const months = new Set(
        cardPlan.existing_cycles.map((cycle) => cycle.period_month.slice(0, 7))
      )
      if (
        cardPlan.rows.some(
          (row) => !months.has(row.cycle.period_month.slice(0, 7))
        )
      )
        context.cardReferences.delete(`${userId}:${parsed.cardId}`)
    }
    const expenseId = Array.isArray(data) ? data[0] : data
    return json({ status: 'confirmed', expenseId }, 200)
  } catch {
    return json({ error: 'confirmation_failed' }, 500)
  }
}
