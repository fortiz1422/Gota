import { z } from 'zod'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  expenseConfirmationSchema,
  loadExpenseConfirmationContext,
  confirmMercadoPagoExpense,
} from './expense-confirmation-service'

export const bulkConfirmationSchema = z
  .object({
    entries: z
      .array(
        z
          .object({
            candidateId: z.string().min(1).max(256),
            body: expenseConfirmationSchema,
          })
          .strict()
      )
      .min(1)
      .max(200),
  })
  .strict()
  .refine(
    ({ entries }) =>
      new Set(entries.map((entry) => entry.candidateId)).size === entries.length
  )
const headers = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' }

/** One authenticated request and one evidence snapshot; canonical RPCs retain per-item atomicity. */
export async function handleBulkConfirmation(
  request: Request,
  prepareOnly: boolean
) {
  try {
    const session = await createClient()
    const {
      data: { user },
    } = await session.auth.getUser()
    if (!user)
      return NextResponse.json(
        { error: 'unauthorized' },
        { status: 401, headers }
      )
    const parsed = bulkConfirmationSchema.safeParse(
      await request.json().catch(() => null)
    )
    if (!parsed.success)
      return NextResponse.json(
        { error: 'invalid_batch' },
        { status: 422, headers }
      )
    const context = await loadExpenseConfirmationContext(user.id)
    if (!context)
      return NextResponse.json({ error: 'not_found' }, { status: 404, headers })
    const results: { candidateId: string; expenseId: string }[] = []
    for (const entry of parsed.data.entries) {
      const outcome = await confirmMercadoPagoExpense(
        user.id,
        entry.candidateId,
        entry.body,
        context,
        prepareOnly
      )
      if (outcome.status !== 200 || (!prepareOnly && !outcome.body.expenseId)) {
        const blocked = {
          candidateId: entry.candidateId,
          status: outcome.status,
          error: outcome.body.error ?? 'confirmation_failed',
        }
        return NextResponse.json(
          prepareOnly
            ? { error: 'batch_not_ready', blocked }
            : {
                status: 'stopped',
                results,
                remaining: parsed.data.entries.length - results.length,
                blocked,
              },
          { status: prepareOnly ? outcome.status : 200, headers }
        )
      }
      if (!prepareOnly)
        results.push({
          candidateId: entry.candidateId,
          expenseId: outcome.body.expenseId!,
        })
    }
    return NextResponse.json(
      prepareOnly
        ? { status: 'ready', count: parsed.data.entries.length }
        : { status: 'completed', results, remaining: 0 },
      { headers }
    )
  } catch {
    // A lost response may follow committed items. The client must refresh, never retry blindly.
    return NextResponse.json(
      { error: 'batch_unavailable' },
      { status: 500, headers }
    )
  }
}
