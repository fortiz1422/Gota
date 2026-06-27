import { NextResponse } from 'next/server'
import { addMonths, getCurrentMonth } from '@/lib/dates'
import { todayAR } from '@/lib/format'
import { createClient } from '@/lib/supabase/server'
import { processDailyYieldEntries } from '@/lib/server/daily-yield-entries'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('account_id')
  const month = searchParams.get('month') ?? getCurrentMonth()
  const monthStart = `${month}-01`
  const nextMonthStart = `${addMonths(month, 1)}-01`

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!accountId) return NextResponse.json({ error: 'account_id is required' }, { status: 400 })

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id, name, daily_yield_enabled, daily_yield_rate, daily_yield_provider, daily_yield_cap_amount')
    .eq('id', accountId)
    .eq('user_id', user.id)
    .single()

  if (accountError || !account) {
    return NextResponse.json({ error: accountError?.message ?? 'Account not found' }, { status: 404 })
  }

  const { data: entries, error } = await supabase
    .from('yield_daily_entries')
    .select('*')
    .eq('user_id', user.id)
    .eq('account_id', accountId)
    .gte('date', monthStart)
    .lt('date', nextMonthStart)
    .order('date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = entries ?? []
  const estimated_total = roundMoney(
    rows.reduce((sum, entry) => sum + Number(entry.expected_amount ?? 0), 0),
  )
  const actual_total = roundMoney(
    rows.reduce((sum, entry) => sum + Number(entry.actual_amount ?? 0), 0),
  )
  const balance_total = roundMoney(
    rows
      .filter((entry) => entry.date <= todayAR())
      .reduce((sum, entry) => sum + Number(entry.actual_amount ?? entry.expected_amount ?? 0), 0),
  )

  return NextResponse.json({
    account,
    entries: rows,
    summary: {
      month,
      estimated_total,
      actual_total,
      balance_total,
      count: rows.length,
      matched_count: rows.filter((entry) => entry.status === 'matched').length,
      difference_count: rows.filter((entry) => entry.status === 'difference').length,
    },
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const month = String(body.month ?? getCurrentMonth())
  const result = await processDailyYieldEntries(supabase, user.id, month)

  return NextResponse.json({ month, ...result })
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
