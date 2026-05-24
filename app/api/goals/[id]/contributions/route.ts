import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { GoalRow } from '@/lib/goals/types'

const createContributionSchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(['ARS', 'USD']),
  contributedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceType: z.enum(['manual', 'transfer_linked', 'income_linked', 'adjustment']),
  note: z.string().max(300).nullable().optional(),
  relatedTransferId: z.string().uuid().nullable().optional(),
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

    const { amount, currency, contributedAt, sourceType, note, relatedTransferId } = parsed.data

    // Verificar que la meta existe y pertenece al usuario
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

    // El aporte debe ser en la misma moneda que la meta
    if (currency !== goal.currency) {
      return NextResponse.json(
        { error: `El aporte debe ser en ${goal.currency} (misma moneda que la meta)` },
        { status: 400 },
      )
    }

    // Si es transfer_linked, verificar que la transferencia existe y pertenece al usuario
    if (sourceType === 'transfer_linked' && relatedTransferId) {
      const { data: transferData } = await supabase
        .from('transfers')
        .select('id')
        .eq('id', relatedTransferId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!transferData) {
        return NextResponse.json({ error: 'Transferencia no encontrada' }, { status: 404 })
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
        note: note ?? null,
        related_transfer_id: relatedTransferId ?? null,
      })
      .select('id')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Si el aporte completa la meta, marcarla como completada automáticamente
    const { data: allContribs } = await supabase
      .from('goal_contributions')
      .select('amount')
      .eq('goal_id', goalId)
      .eq('user_id', user.id)

    const totalContributed = (allContribs ?? []).reduce(
      (sum, c: { amount: number }) => sum + c.amount,
      0,
    )

    // Re-fetch goal to get starting_amount
    const { data: fullGoal } = await supabase
      .from('goals')
      .select('starting_amount, target_amount, status')
      .eq('id', goalId)
      .eq('user_id', user.id)
      .single()

    if (fullGoal) {
      const goalFull = fullGoal as Pick<GoalRow, 'starting_amount' | 'target_amount' | 'status'>
      const realCurrentAmount = goalFull.starting_amount + totalContributed
      if (
        realCurrentAmount >= goalFull.target_amount &&
        goalFull.status === 'active'
      ) {
        await supabase
          .from('goals')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', goalId)
          .eq('user_id', user.id)
      }
    }

    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (error) {
    console.error('Contribution POST error:', error)
    return NextResponse.json({ error: 'Error al registrar aporte' }, { status: 500 })
  }
}
