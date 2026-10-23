import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { resolveSavedCounterparty } from '@/lib/counterparty-aliases/server'
import { confirmReceiptBatch } from '@/lib/shared-receipts/bulk-confirmation'
import { confirmSharedPurchase } from '@/lib/shared-receipts/operations'
import { receiptDuplicateAmounts } from '@/lib/shared-receipts/bulk-review'
import { checkRateLimit } from '@/lib/rate-limit'
import type { Json } from '@/types/database'

const NO_STORE = { 'Cache-Control': 'private, no-store' }
export const maxDuration = 60

export async function POST(request: Request) {
  const session = await createClient()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user)
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: NO_STORE }
    )
  if (!checkRateLimit(`receipt-batch:${user.id}`, 5))
    return NextResponse.json(
      { error: 'Esperá un minuto antes de confirmar otra tanda.' },
      { status: 429, headers: NO_STORE }
    )
  const input: unknown = await request.json().catch(() => null)
  const admin = createAdminClient()
  const result = await confirmReceiptBatch(user.id, input, {
    findOwned: async (userId, id) => {
      const { data, error } = await admin
        .from('shared_receipts')
        .select('status,parsed_payload')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return data
    },
    resolveAlias: (userId, merchant) =>
      resolveSavedCounterparty(admin, userId, merchant),
    referencesValid: async (userId, payload) => {
      const isCard = payload.payment_method === 'CREDIT'
      const id = isCard ? payload.card_id : payload.account_id
      if (!id) return false
      if (isCard) {
        const { data, error } = await session
          .from('cards')
          .select('id')
          .eq('id', id)
          .eq('user_id', userId)
          .eq('archived', false)
          .maybeSingle()
        if (error) throw error
        return !!data
      }
      const { data, error } = await session
        .from('accounts')
        .select('id,type')
        .eq('id', id)
        .eq('user_id', userId)
        .eq('archived', false)
        .maybeSingle()
      if (error) throw error
      return (
        !!data &&
        (payload.payment_method === 'CASH'
          ? data.type === 'cash'
          : data.type !== 'cash')
      )
    },
    hasDuplicate: async (userId, payload) => {
      const start = new Date(`${payload.date}T00:00:00.000Z`)
      const end = new Date(start)
      end.setUTCDate(end.getUTCDate() + 1)
      const { data, error } = await session
        .from('expenses')
        .select('id')
        .eq('user_id', userId)
        .in('amount', receiptDuplicateAmounts(payload))
        .eq('currency', payload.currency)
        .gte('date', start.toISOString())
        .lt('date', end.toISOString())
        .limit(1)
      if (error) throw error
      return !!data?.length
    },
    confirm: async (userId, receiptId, payload) => {
      const confirmed = await confirmSharedPurchase(
        userId,
        receiptId,
        payload,
        {
          confirmAtomic: async (ownerId, id, purchase, hash) => {
            const { data, error } = await admin.rpc(
              'confirm_shared_receipt_purchase',
              {
                p_user_id: ownerId,
                p_receipt_id: id,
                p_payload: JSON.parse(JSON.stringify(purchase)) as Json,
                p_payload_hash: hash,
              }
            )
            if (error || !data?.[0])
              throw error ?? new Error('Empty confirmation')
            return data[0] as {
              outcome: 'confirmed' | 'replay'
              expense_id: string
            }
          },
        }
      )
      const body = confirmed.body as {
        outcome?: 'confirmed' | 'replay'
        expense_id?: string
      }
      if (!body.expense_id || !body.outcome)
        throw new Error('Invalid confirmation result')
      // Financial success wins over cleanup errors, just as in individual review.
      try {
        const { data: receipt } = await admin
          .from('shared_receipts')
          .select('storage_path')
          .eq('id', receiptId)
          .eq('user_id', userId)
          .eq('status', 'confirmed')
          .maybeSingle()
        if (receipt?.storage_path) {
          const path = receipt.storage_path
          const { data: cleared } = await admin
            .from('shared_receipts')
            .update({
              storage_path: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', receiptId)
            .eq('user_id', userId)
            .eq('status', 'confirmed')
            .eq('storage_path', path)
            .select('id')
            .maybeSingle()
          if (cleared)
            await admin.storage.from('shared-receipts-private').remove([path])
        }
      } catch {
        /* Best-effort cleanup must not turn a committed expense into an error. */
      }
      return { outcome: body.outcome, expenseId: body.expense_id }
    },
  })
  return NextResponse.json(result.body, {
    status: result.status,
    headers: NO_STORE,
  })
}
