import { NextResponse } from 'next/server'
import { z } from 'zod'
import { normalizeBudgetCategory } from '@/lib/budgets/computeBudgetMetrics'
import { getBudgetSnapshot } from '@/lib/server/budget-queries'
import { createClient } from '@/lib/supabase/server'

const querySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  currency: z.enum(['ARS', 'USD']).optional(),
})

const createSchema = z.object({
  periodMonth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  baseCurrency: z.enum(['ARS', 'USD']),
  items: z
    .array(
      z.object({
        category: z.string().min(1),
        amount: z.number().positive(),
      }),
    )
    .min(1),
})

function buildDuplicateError(items: Array<{ category: string; amount: number }>): string | null {
  const seen = new Set<string>()
  for (const item of items) {
    const key = normalizeBudgetCategory(item.category).toLocaleLowerCase('es-AR')
    if (seen.has(key)) return 'No puede haber categorías duplicadas en el plan'
    seen.add(key)
  }
  return null
}

function isDuplicateConstraintError(message: string | undefined): boolean {
  return !!message && message.toLowerCase().includes('duplicate')
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({
    month: searchParams.get('month'),
    currency: searchParams.get('currency') ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  const { data: config } = await supabase
    .from('user_config')
    .select('default_currency')
    .eq('user_id', user.id)
    .single()

  const currency = parsed.data.currency ?? config?.default_currency ?? 'ARS'
  const snapshot = await getBudgetSnapshot({
    supabase,
    userId: user.id,
    month: parsed.data.month,
    currency,
  })

  return NextResponse.json({ ...snapshot, currency })
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

    const duplicateError = buildDuplicateError(parsed.data.items)
    if (duplicateError) {
      return NextResponse.json({ error: duplicateError }, { status: 400 })
    }

    const normalizedItems = parsed.data.items.map((item, index) => ({
      user_id: user.id,
      category: normalizeBudgetCategory(item.category),
      amount: item.amount,
      sort_order: index,
    }))

    const { data: plan, error: planError } = await supabase
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

    const { error: itemsError } = await supabase.from('budget_items').insert(
      normalizedItems.map((item) => ({
        ...item,
        plan_id: plan.id,
      })),
    )

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    const snapshot = await getBudgetSnapshot({
      supabase,
      userId: user.id,
      month: parsed.data.periodMonth.substring(0, 7),
      currency: parsed.data.baseCurrency,
    })

    return NextResponse.json(snapshot, { status: 201 })
  } catch (error) {
    console.error('Create budget error:', error)
    return NextResponse.json({ error: 'Error al crear presupuesto' }, { status: 500 })
  }
}
