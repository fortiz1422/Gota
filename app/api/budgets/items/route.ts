import { NextResponse } from 'next/server'
import { z } from 'zod'
import { normalizeBudgetCategory } from '@/lib/budgets/computeBudgetMetrics'
import { createClient } from '@/lib/supabase/server'

const createItemSchema = z.object({
  planId: z.string().uuid(),
  category: z.string().min(1),
  amount: z.number().positive(),
  sortOrder: z.number().int().min(0).optional(),
})

function isDuplicateConstraintError(message: string | undefined): boolean {
  return !!message && message.toLowerCase().includes('duplicate')
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = createItemSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('budget_items')
    .insert({
      plan_id: parsed.data.planId,
      user_id: user.id,
      category: normalizeBudgetCategory(parsed.data.category),
      amount: parsed.data.amount,
      sort_order: parsed.data.sortOrder ?? 0,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json(
      {
        error: isDuplicateConstraintError(error.message)
          ? 'Esa categoría ya existe en el presupuesto'
          : error.message,
      },
      { status: isDuplicateConstraintError(error.message) ? 409 : 500 },
    )
  }

  return NextResponse.json(data, { status: 201 })
}
