import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getGoals } from '@/lib/server/goal-queries'

const createSchema = z.object({
  name: z.string().min(1).max(100),
  emoji: z.string().max(10).nullable().optional(),
  colorToken: z.string().max(30).nullable().optional(),
  currency: z.enum(['ARS', 'USD']),
  targetAmount: z.number().positive(),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  startingAmount: z.number().min(0).optional().default(0),
  plannedMonthlyContribution: z.number().positive().nullable().optional(),
  linkedAccountId: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
})

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const goals = await getGoals(supabase, user.id)
    return NextResponse.json({ goals })
  } catch (error) {
    console.error('Goals GET error:', error)
    return NextResponse.json({ error: 'Error al obtener metas' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const parsed = createSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
    }

    const {
      name,
      emoji,
      colorToken,
      currency,
      targetAmount,
      targetDate,
      startingAmount,
      plannedMonthlyContribution,
      linkedAccountId,
      notes,
    } = parsed.data

    const { data, error } = await supabase
      .from('goals')
      .insert({
        user_id: user.id,
        name,
        emoji: emoji ?? null,
        color_token: colorToken ?? null,
        currency,
        target_amount: targetAmount,
        target_date: targetDate ?? null,
        starting_amount: startingAmount ?? 0,
        planned_monthly_contribution: plannedMonthlyContribution ?? null,
        linked_account_id: linkedAccountId ?? null,
        notes: notes ?? null,
        status: 'active',
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch (error) {
    console.error('Goals POST error:', error)
    return NextResponse.json({ error: 'Error al crear meta' }, { status: 500 })
  }
}
