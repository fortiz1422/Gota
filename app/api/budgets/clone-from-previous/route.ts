import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getBudgetSnapshot } from '@/lib/server/budget-queries'
import { createClient } from '@/lib/supabase/server'

const cloneSchema = z.object({
  periodMonth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  baseCurrency: z.enum(['ARS', 'USD']),
})

function addMonths(monthDate: string, delta: number): string {
  const [year, month] = monthDate.split('-').map(Number)
  const date = new Date(year, month - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

function isDuplicateConstraintError(message: string | undefined): boolean {
  return !!message && message.toLowerCase().includes('duplicate')
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = cloneSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
  }

  const previousMonth = addMonths(parsed.data.periodMonth, -1)
  const { data: previousPlan, error: previousPlanError } = await supabase
    .from('budget_plans')
    .select('id')
    .eq('user_id', user.id)
    .eq('period_month', previousMonth)
    .eq('base_currency', parsed.data.baseCurrency)
    .single()

  if (previousPlanError || !previousPlan) {
    return NextResponse.json({ error: 'No existe presupuesto en el mes anterior' }, { status: 404 })
  }

  const { data: previousItems, error: previousItemsError } = await supabase
    .from('budget_items')
    .select('category, amount, sort_order')
    .eq('user_id', user.id)
    .eq('plan_id', previousPlan.id)
    .order('sort_order', { ascending: true })

  if (previousItemsError) {
    return NextResponse.json({ error: previousItemsError.message }, { status: 500 })
  }

  const { data: newPlan, error: planError } = await supabase
    .from('budget_plans')
    .insert({
      user_id: user.id,
      period_month: parsed.data.periodMonth,
      base_currency: parsed.data.baseCurrency,
      status: 'active',
    })
    .select('*')
    .single()

  if (planError) {
    return NextResponse.json(
      {
        error: isDuplicateConstraintError(planError.message)
          ? 'Ya existe un presupuesto para ese mes y moneda'
          : planError.message,
      },
      { status: isDuplicateConstraintError(planError.message) ? 409 : 500 },
    )
  }

  const { error: insertItemsError } = await supabase.from('budget_items').insert(
    (previousItems ?? []).map((item) => ({
      plan_id: newPlan.id,
      user_id: user.id,
      category: item.category,
      amount: item.amount,
      sort_order: item.sort_order,
    })),
  )

  if (insertItemsError) {
    return NextResponse.json({ error: insertItemsError.message }, { status: 500 })
  }

  const snapshot = await getBudgetSnapshot({
    supabase,
    userId: user.id,
    month: parsed.data.periodMonth.substring(0, 7),
    currency: parsed.data.baseCurrency,
  })

  return NextResponse.json(snapshot, { status: 201 })
}
