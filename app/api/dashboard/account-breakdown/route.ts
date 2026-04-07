import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMonth } from '@/lib/dates'
import { todayAR } from '@/lib/format'
import { buildLiveBalanceBreakdown, sumLiveBreakdown } from '@/lib/live-balance'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const currency = (searchParams.get('currency') === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const currentMonth = getCurrentMonth()
  const todayDate = todayAR()

  const [
    { data: accountsData },
    { data: incomeData },
    { data: debitExpData },
    { data: cardPayData },
    { data: transfersData },
    { data: yieldData },
    { data: instrumentsData },
  ] = await Promise.all([
    supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('is_primary', { ascending: false }),
    supabase
      .from('income_entries')
      .select('account_id, amount')
      .eq('user_id', user.id)
      .eq('currency', currency)
      .lte('date', todayDate),
    supabase
      .from('expenses')
      .select('account_id, amount')
      .eq('user_id', user.id)
      .eq('currency', currency)
      .lte('date', todayDate)
      .in('payment_method', ['CASH', 'DEBIT', 'TRANSFER'])
      .neq('category', 'Pago de Tarjetas'),
    supabase
      .from('expenses')
      .select('account_id, amount')
      .eq('user_id', user.id)
      .eq('currency', currency)
      .lte('date', todayDate)
      .eq('category', 'Pago de Tarjetas'),
    supabase
      .from('transfers')
      .select('from_account_id, to_account_id, amount_from, amount_to, currency_from, currency_to')
      .eq('user_id', user.id)
      .lte('date', todayDate),
    supabase
      .from('yield_accumulator')
      .select('account_id, accumulated')
      .eq('user_id', user.id)
      .lte('month', currentMonth),
    supabase
      .from('instruments')
      .select('account_id, amount, currency')
      .eq('user_id', user.id)
      .eq('status', 'active'),
  ])

  const breakdown = buildLiveBalanceBreakdown({
    accounts: accountsData ?? [],
    currency,
    incomes: incomeData ?? [],
    debitExpenses: debitExpData ?? [],
    cardPayments: cardPayData ?? [],
    transfers: transfersData ?? [],
    yields: yieldData ?? [],
    activeInstruments: instrumentsData ?? [],
  })

  return NextResponse.json({
    breakdown,
    total: sumLiveBreakdown(breakdown),
    currency,
  })
}
