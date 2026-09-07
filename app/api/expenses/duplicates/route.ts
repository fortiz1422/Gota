import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const amount = Number(searchParams.get('amount'))
  const currency = searchParams.get('currency') ?? ''
  const date = searchParams.get('date') ?? ''

  if (!Number.isFinite(amount) || amount <= 0 || !['ARS', 'USD'].includes(currency) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid duplicate check input' }, { status: 400 })
  }

  const start = new Date(`${date}T00:00:00.000Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 1)
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: 'Invalid duplicate check input' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('expenses')
    .select('id, description, created_at')
    .eq('user_id', user.id)
    .eq('amount', amount)
    .eq('currency', currency)
    .gte('date', start.toISOString())
    .lt('date', end.toISOString())
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Duplicate check error:', error)
    return NextResponse.json({ error: 'Duplicate check failed' }, { status: 500 })
  }

  return NextResponse.json({ duplicates: data ?? [] })
}
