import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calcularMontoResumen } from '@/lib/analytics/computeResumen'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const cardId = searchParams.get('cardId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const currency = (searchParams.get('currency') ?? 'ARS') as 'ARS' | 'USD'

  if (!cardId || !from || !to) {
    return NextResponse.json({ error: 'Missing params: cardId, from, to' }, { status: 400 })
  }

  const { data: expenses, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .eq('card_id', cardId)
    .eq('currency', currency)
    .gte('date', from)
    .lte('date', to)

  if (error) {
    console.error('card-resumen fetch error:', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // Parse dates as noon UTC to avoid timezone ambiguity on Vercel (UTC server)
  const periodoDesde = new Date(`${from}T12:00:00Z`)
  const periodoHasta = new Date(`${to}T12:00:00Z`)

  const amount = calcularMontoResumen(expenses ?? [], cardId, periodoDesde, periodoHasta)

  return NextResponse.json({ amount })
}
