import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const Schema = z.object({
  account_id: z.string().uuid().nullable().optional(),
  amount: z.number().positive(),
  currency: z.enum(['ARS', 'USD']).default('ARS'),
  description: z.string().max(100).default(''),
  category: z.enum(['salary', 'freelance', 'other']).default('other'),
  date: z.string().datetime().optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const rawMonth = searchParams.get('month') ?? ''
  if (!rawMonth) return NextResponse.json({ error: 'month required' }, { status: 400 })

  const monthDate = rawMonth.length === 7 ? rawMonth + '-01' : rawMonth
  const [y, m] = monthDate.split('-').map(Number)
  const nextMonthDate = new Date(y, m, 1).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('income_entries')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', monthDate)
    .lt('date', nextMonthDate)
    .order('date', { ascending: false })

  if (error) return NextResponse.json({ error: 'Error' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { account_id, amount, currency, description, category, date } = Schema.parse(body)

    const { data, error } = await supabase
      .from('income_entries')
      .insert({
        user_id: user.id,
        account_id: account_id ?? null,
        amount,
        currency,
        description,
        category,
        date: date ?? new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error('income-entries POST error:', e)
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }
}
