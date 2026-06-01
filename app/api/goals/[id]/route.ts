import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getGoalById } from '@/lib/server/goal-queries'
import type { GoalUpdate } from '@/types/database'

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  emoji: z.string().max(10).nullable().optional(),
  colorToken: z.string().max(30).nullable().optional(),
  targetAmount: z.number().positive().optional(),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  plannedMonthlyContribution: z.number().positive().nullable().optional(),
  linkedAccountId: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
})

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const goal = await getGoalById(supabase, user.id, id)
    if (!goal) return NextResponse.json({ error: 'Meta no encontrada' }, { status: 404 })
    return NextResponse.json(goal)
  } catch (error) {
    console.error('Goal GET error:', error)
    return NextResponse.json({ error: 'Error al obtener meta' }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const parsed = patchSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const { name, emoji, colorToken, targetAmount, targetDate, plannedMonthlyContribution, linkedAccountId, notes, status } = parsed.data

    const updates: GoalUpdate = { updated_at: new Date().toISOString() }
    if (name !== undefined) updates.name = name
    if (emoji !== undefined) updates.emoji = emoji
    if (colorToken !== undefined) updates.color_token = colorToken
    if (targetAmount !== undefined) updates.target_amount = targetAmount
    if (targetDate !== undefined) updates.target_date = targetDate
    if (plannedMonthlyContribution !== undefined) updates.planned_monthly_contribution = plannedMonthlyContribution
    if (linkedAccountId !== undefined) updates.linked_account_id = linkedAccountId
    if (notes !== undefined) updates.notes = notes
    if (status !== undefined) {
      updates.status = status
      if (status === 'completed') updates.completed_at = new Date().toISOString()
      if (status === 'paused') updates.paused_at = new Date().toISOString()
      if (status === 'active') {
        updates.paused_at = null
        updates.completed_at = null
      }
    }

    const { error } = await supabase
      .from('goals')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const goal = await getGoalById(supabase, user.id, id)
    if (!goal) return NextResponse.json({ error: 'Meta no encontrada' }, { status: 404 })

    return NextResponse.json(goal)
  } catch (error) {
    console.error('Goal PATCH error:', error)
    return NextResponse.json({ error: 'Error al actualizar meta' }, { status: 500 })
  }
}
