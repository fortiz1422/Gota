import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { GoalRow } from '@/lib/goals/types'
import { recomputeGoalStatus } from '@/lib/server/recompute-goal-status'

const availabilityEffectSchema = z.enum(['none', 'committed_only', 'moved_out'])
const destinationKindSchema = z.enum(['same_account', 'tracked_account', 'external_pot', 'virtual_pot'])

const createContributionSchema = z
  .object({
    amount: z.number().positive(),
    currency: z.enum(['ARS', 'USD']),
    contributedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sourceType: z.enum(['manual', 'transfer_linked', 'income_linked', 'adjustment']),
    sourceAccountId: z.string().uuid().nullable().optional(),
    availabilityEffect: availabilityEffectSchema.default('none'),
    destinationKind: destinationKindSchema.nullable().optional(),
    note: z.string().max(300).nullable().optional(),
    relatedTransferId: z.string().uuid().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.sourceType === 'transfer_linked' && !value.relatedTransferId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['relatedTransferId'],
        message: 'La transferencia vinculada es obligatoria.',
      })
    }

    if (value.sourceType !== 'transfer_linked' && value.relatedTransferId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['relatedTransferId'],
        message: 'Solo los aportes vinculados pueden incluir una transferencia.',
      })
    }

    if (value.availabilityEffect === 'committed_only' && !value.sourceAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceAccountId'],
        message: 'Elegí la cuenta donde queda comprometida esa plata.',
      })
    }

    if (value.availabilityEffect === 'moved_out') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['availabilityEffect'],
        message: 'La salida real a cajita queda diferida para una fase posterior.',
      })
    }
  })

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: goalId } = await params

  try {
    const parsed = createContributionSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const {
      amount,
      currency,
      contributedAt,
      sourceType,
      sourceAccountId,
      availabilityEffect,
      destinationKind,
      note,
      relatedTransferId,
    } = parsed.data

    const { data: goalData, error: goalError } = await supabase
      .from('goals')
      .select('id, currency, status')
      .eq('id', goalId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (goalError) return NextResponse.json({ error: goalError.message }, { status: 500 })
    if (!goalData) return NextResponse.json({ error: 'Meta no encontrada' }, { status: 404 })

    const goal = goalData as Pick<GoalRow, 'id' | 'currency' | 'status'>

    if (goal.status === 'archived') {
      return NextResponse.json({ error: 'No se puede aportar a una meta archivada' }, { status: 400 })
    }

    if (currency !== goal.currency) {
      return NextResponse.json(
        { error: `El aporte debe ser en ${goal.currency} (misma moneda que la meta)` },
        { status: 400 },
      )
    }

    if (sourceAccountId) {
      const { data: accountData } = await supabase
        .from('accounts')
        .select('id')
        .eq('id', sourceAccountId)
        .eq('user_id', user.id)
        .eq('archived', false)
        .maybeSingle()

      if (!accountData) {
        return NextResponse.json({ error: 'Cuenta origen no encontrada' }, { status: 404 })
      }
    }

    if (sourceType === 'transfer_linked' && relatedTransferId) {
      const [{ data: transferData }, { data: existingLink }] = await Promise.all([
        supabase
          .from('transfers')
          .select('id')
          .eq('id', relatedTransferId)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('goal_contributions')
          .select('id, goal_id')
          .eq('user_id', user.id)
          .eq('source_type', 'transfer_linked')
          .eq('related_transfer_id', relatedTransferId)
          .maybeSingle(),
      ])

      if (!transferData) {
        return NextResponse.json({ error: 'Transferencia no encontrada' }, { status: 404 })
      }

      if (existingLink) {
        return NextResponse.json(
          { error: 'Esa transferencia ya está vinculada a una meta. Eliminá el vínculo anterior antes de reutilizarla.' },
          { status: 409 },
        )
      }
    }

    const { data, error } = await supabase
      .from('goal_contributions')
      .insert({
        goal_id: goalId,
        user_id: user.id,
        amount,
        currency,
        contributed_at: contributedAt,
        source_type: sourceType,
        source_account_id: sourceAccountId ?? null,
        availability_effect: availabilityEffect,
        destination_kind:
          destinationKind ?? (availabilityEffect === 'committed_only' ? 'same_account' : null),
        note: note ?? null,
        related_transfer_id: relatedTransferId ?? null,
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Esa transferencia ya está vinculada a una meta. Eliminá el vínculo anterior antes de reutilizarla.' },
          { status: 409 },
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await recomputeGoalStatus(supabase, user.id, goalId)

    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (error) {
    console.error('Contribution POST error:', error)
    return NextResponse.json({ error: 'Error al registrar aporte' }, { status: 500 })
  }
}
