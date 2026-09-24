import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CATEGORIES } from '@/lib/validation/schemas'
import { getMercadoPagoConnection, getMercadoPagoMovementObservations } from '@/lib/mercadopago/server-repository'
import { buildCanonicalSemantics, buildConfirmationIntentHash, candidateFingerprint, eligibleMercadoPagoExpense, expectedObservations, isEligibleCreditCardPurchase, reconstructMercadoPagoCandidates } from '@/lib/mercadopago/confirm-expense'

const headers = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' }
const bodySchema = z.object({ description: z.string().trim().min(1).max(100), category: z.enum(CATEGORIES), isWant: z.boolean(), expectedLinkedAccountId: z.string().uuid().optional(), expectedLinkedAccountVersion: z.number().int().nonnegative().optional(), cardId: z.string().uuid().optional(), installments: z.number().int().min(1).max(1).optional() }).strict()
const json = (body: unknown, status: number) => NextResponse.json(body, { status, headers })

type Params = { params: Promise<{ candidateId: string }> }
export async function POST(request: Request, { params }: Params) {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)
  let parsed: z.infer<typeof bodySchema>
  try { parsed = bodySchema.parse(await request.json()) } catch { return json({ error: 'invalid_confirmation' }, 422) }
  try {
    const { candidateId } = await params
    const connection = await getMercadoPagoConnection(user.id)
    if (!connection) return json({ error: 'not_found' }, 404)
    const observations = await getMercadoPagoMovementObservations(user.id, connection.id, 100)
    const candidate = reconstructMercadoPagoCandidates(connection, observations).find((item) => item.candidateId === candidateId)
    if (!candidate) return json({ error: 'not_found' }, 404)
    const isCard = parsed.cardId !== undefined
    if (isCard && parsed.category === 'Pago de Tarjetas') return json({ error: 'invalid_confirmation' }, 422)
    if (isCard ? !isEligibleCreditCardPurchase(candidate) : !eligibleMercadoPagoExpense(candidate)) return json({ error: 'ineligible' }, 422)
    if (isCard && (!parsed.cardId || parsed.installments !== 1)) return json({ error: 'invalid_confirmation' }, 422)
    if (!isCard && (!parsed.expectedLinkedAccountId || parsed.expectedLinkedAccountVersion === undefined)) return json({ error: 'invalid_confirmation' }, 422)
    const amount = isCard ? candidate.amount.value! : Math.abs(candidate.balanceImpact.amount.value!)
    const currency = isCard ? candidate.amount.currency! : candidate.balanceImpact.amount.currency!
    const date = new Date((isCard ? candidate.occurredAt : candidate.balanceOccurredAt)!).toISOString().slice(0, 10)
    const semantics = buildCanonicalSemantics()
    const admin = createAdminClient() as unknown as { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: string | string[] | null; error: unknown }> }
    const { data, error } = await admin.rpc(isCard ? 'confirm_mercadopago_card_expense' : 'confirm_mercadopago_expense', {
      p_user_id: user.id, p_connection_id: connection.id, p_candidate_id: candidateId,
      p_candidate_fingerprint: candidateFingerprint(candidate),
      p_intent_hash: buildConfirmationIntentHash({ ...parsed, cardId: parsed.cardId, installments: isCard ? 1 : undefined }),
      p_expected_observations: expectedObservations(candidate),
      p_amount: amount, p_currency: currency, p_date: date,
      p_category: parsed.category, p_description: parsed.description, p_is_want: parsed.isWant,
      ...(isCard ? { p_card_id: parsed.cardId, p_installments: 1 } : { p_expected_linked_account_id: parsed.expectedLinkedAccountId, p_expected_linked_account_version: parsed.expectedLinkedAccountVersion, p_evidence_kind: 'balance_debit_known', p_canonical_semantics: semantics }),
    })
    if (error || !data) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
      if (code === 'P0002') return json({ error: 'not_found' }, 404)
      if (code === '23505' || code === '55000') return json({ error: 'conflict' }, 409)
      if (code === '22023') return json({ error: 'invalid_confirmation' }, 422)
      return json({ error: 'confirmation_failed' }, 500)
    }
    const expenseId = Array.isArray(data) ? data[0] : data
    return json({ status: 'confirmed', expenseId }, 200)
  } catch {
    return json({ error: 'confirmation_failed' }, 500)
  }
}
