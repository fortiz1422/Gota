import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') // YYYY-MM

  let query = supabase
    .from('transfers')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (month) {
    const [y, m] = month.split('-').map(Number)
    const start = `${month}-01`
    const end = new Date(y, m, 1).toISOString().split('T')[0]
    query = query.gte('date', start).lt('date', end)
  }

  const { data, error } = await query.limit(20)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ transfers: data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { from_account_id, to_account_id, amount_from, amount_to, currency_from, currency_to, exchange_rate, date, note } = body

  if (!from_account_id || !to_account_id || !amount_from || !amount_to || !currency_from || !currency_to || !date) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }
  if (from_account_id === to_account_id) {
    return NextResponse.json({ error: 'Origen y destino no pueden ser la misma cuenta' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('transfers')
    .insert({
      user_id: user.id,
      from_account_id,
      to_account_id,
      amount_from: Number(amount_from),
      amount_to: Number(amount_to),
      currency_from,
      currency_to,
      exchange_rate: exchange_rate ? Number(exchange_rate) : null,
      date,
      note: note || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
