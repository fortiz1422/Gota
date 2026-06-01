import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { GoalContributionRow } from '@/lib/goals/types'
import type { GoalContributionUpdate } from '@/types/database'

const patchContributionSchema = z.object({
  amount: z.number().positive().optional(),
  note: z.string().max(300).nullable().optional(),
  contributedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; contributionId: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: goalId, contributionId } = await params

  try {
    // Fetch contribution to verify ownership and source_type
    const { data: contributionData, error: fetchError } = await supabase
      .from('goal_contributions')
      .select('id, source_type')
      .eq('id', contributionId)
      .eq('user_id', user.id)
      .eq('goal_id', goalId)
      .maybeSingle()

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
    if (!contributionData) {
      return NextResponse.json({ error: 'Aporte no encontrado' }, { status: 404 })
    }

    const contribution = contributionData as Pick<GoalContributionRow, 'id' | 'source_type'>

    if (contribution.source_type === 'transfer_linked') {
      return NextResponse.json(
        { error: 'Eliminá el vínculo desde el detalle de la transferencia' },
        { status: 400 },
      )
    }

    const { error: deleteError } = await supabase
      .from('goal_contributions')
      .delete()
      .eq('id', contributionId)
      .eq('user_id', user.id)
      .eq('goal_id', goalId)

    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Contribution DELETE error:', error)
    return NextResponse.json({ error: 'Error al eliminar aporte' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; contributionId: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: goalId, contributionId } = await params

  try {
    const parsed = patchContributionSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    // Fetch contribution to verify ownership and source_type
    const { data: contributionData, error: fetchError } = await supabase
      .from('goal_contributions')
      .select('id, source_type')
      .eq('id', contributionId)
      .eq('user_id', user.id)
      .eq('goal_id', goalId)
      .maybeSingle()

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
    if (!contributionData) {
      return NextResponse.json({ error: 'Aporte no encontrado' }, { status: 404 })
    }

    const contribution = contributionData as Pick<GoalContributionRow, 'id' | 'source_type'>

    if (contribution.source_type !== 'manual') {
      return NextResponse.json(
        { error: 'Solo se pueden editar aportes manuales' },
        { status: 400 },
      )
    }

    const { amount, note, contributedAt } = parsed.data
    const updates: GoalContributionUpdate = { updated_at: new Date().toISOString() }
    if (amount !== undefined) updates.amount = amount
    if (note !== undefined) updates.note = note
    if (contributedAt !== undefined) updates.contributed_at = contributedAt

    const { error: updateError } = await supabase
      .from('goal_contributions')
      .update(updates)
      .eq('id', contributionId)
      .eq('user_id', user.id)
      .eq('goal_id', goalId)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Contribution PATCH error:', error)
    return NextResponse.json({ error: 'Error al editar aporte' }, { status: 500 })
  }
}
