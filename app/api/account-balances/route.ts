import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const Schema = z.object({
  account_id: z.string().uuid(),
  period: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/),
  balance_ars: z.number().min(0).default(0),
  balance_usd: z.number().min(0).default(0),
  source: z.enum(['opening', 'rollover_auto', 'manual']).default('manual'),
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
  const period = rawMonth.length === 7 ? rawMonth + '-01' : rawMonth

  // Get all account IDs for this user
  const { data: userAccounts } = await supabase
    .from('accounts')
    .select('id')
    .eq('user_id', user.id)

  const accountIds = (userAccounts ?? []).map((a) => a.id)
  if (accountIds.length === 0) return NextResponse.json([])

  const { data, error } = await supabase
    .from('account_period_balance')
    .select('*')
    .in('account_id', accountIds)
    .eq('period', period)

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
    const { account_id, period: rawPeriod, balance_ars, balance_usd, source } = Schema.parse(body)
    const period = rawPeriod.length === 7 ? rawPeriod + '-01' : rawPeriod

    // Verify account belongs to user
    const { data: acct } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', account_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!acct) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('account_period_balance')
      .upsert(
        { account_id, period, balance_ars, balance_usd, source, updated_at: new Date().toISOString() },
        { onConflict: 'account_id,period' },
      )
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (e) {
    console.error('account-balances POST error:', e)
    return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
  }
}
