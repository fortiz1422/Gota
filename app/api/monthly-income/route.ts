import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const rawMonth = searchParams.get('month') ?? ''
  if (!rawMonth) return NextResponse.json({ error: 'month required' }, { status: 400 })
  const month = rawMonth.length === 7 ? rawMonth + '-01' : rawMonth

  const { data, error } = await supabase
    .from('monthly_income')
    .select('amount_ars, amount_usd, saldo_inicial_ars, saldo_inicial_usd, closed, closed_at')
    .eq('user_id', user.id)
    .eq('month', month)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Error' }, { status: 500 })
  return NextResponse.json(
    data ?? {
      amount_ars: 0,
      amount_usd: 0,
      saldo_inicial_ars: 0,
      saldo_inicial_usd: 0,
      closed: false,
      closed_at: null,
    },
  )
}

const Schema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/), // accepts YYYY-MM or YYYY-MM-DD
  amount_ars: z.number().min(0),
  amount_usd: z.number().min(0),
  saldo_inicial_ars: z.number().min(0).optional().default(0),
  saldo_inicial_usd: z.number().min(0).optional().default(0),
})

const CloseSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/),
})

export async function PUT(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { month: rawMonth } = CloseSchema.parse(body)
    const month = rawMonth.length === 7 ? rawMonth + '-01' : rawMonth

    const { error } = await supabase
      .from('monthly_income')
      .update({ closed: true, closed_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('month', month)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Close month error:', e)
    return NextResponse.json({ error: 'Error al cerrar mes' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { month: rawMonth, amount_ars, amount_usd, saldo_inicial_ars, saldo_inicial_usd } =
      Schema.parse(body)
    // Ensure full date format required by DATE column
    const month = rawMonth.length === 7 ? rawMonth + '-01' : rawMonth

    // Check if a record already exists for this user+month
    const { data: existing } = await supabase
      .from('monthly_income')
      .select('id')
      .eq('user_id', user.id)
      .eq('month', month)
      .maybeSingle()

    if (existing) {
      const { error } = await supabase
        .from('monthly_income')
        .update({ amount_ars, amount_usd, saldo_inicial_ars, saldo_inicial_usd })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('monthly_income')
        .insert({ user_id: user.id, month, amount_ars, amount_usd, saldo_inicial_ars, saldo_inicial_usd })
      if (error) throw error
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Monthly income error:', e)
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }
}
