import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { addMonths, getCurrentMonth } from '@/lib/dates'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const now = new Date()
  const month =
    searchParams.get('month') ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const currency = (searchParams.get('currency') === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD'
  const projected = searchParams.get('projected') === 'true'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // When projected, use current month's data (which becomes the projected opening balance)
  const queryMonth = projected ? getCurrentMonth() : month
  const monthDate = queryMonth + '-01'
  const nextMonthDate = addMonths(queryMonth, 1) + '-01'

  const [
    { data: accountsData },
    { data: incomeData },
    { data: debitExpData },
    { data: cardPayData },
    { data: balancesData },
    { data: transfersData },
  ] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, type, is_primary')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('is_primary', { ascending: false }),
    supabase
      .from('income_entries')
      .select('account_id, amount')
      .eq('user_id', user.id)
      .eq('currency', currency)
      .gte('date', monthDate)
      .lt('date', nextMonthDate),
    supabase
      .from('expenses')
      .select('account_id, amount')
      .eq('user_id', user.id)
      .eq('currency', currency)
      .gte('date', monthDate)
      .lt('date', nextMonthDate)
      .in('payment_method', ['CASH', 'DEBIT', 'TRANSFER'])
      .neq('category', 'Pago de Tarjetas'),
    supabase
      .from('expenses')
      .select('account_id, amount')
      .eq('user_id', user.id)
      .eq('currency', currency)
      .gte('date', monthDate)
      .lt('date', nextMonthDate)
      .eq('category', 'Pago de Tarjetas'),
    supabase
      .from('account_period_balance')
      .select('account_id, balance_ars, balance_usd')
      .eq('period', monthDate),
    supabase
      .from('transfers')
      .select('from_account_id, to_account_id, amount_from, amount_to, currency_from, currency_to')
      .eq('user_id', user.id)
      .gte('date', monthDate)
      .lt('date', nextMonthDate),
  ])

  const accounts = accountsData ?? []
  const primaryId = accounts.find((a) => a.is_primary)?.id ?? accounts[0]?.id ?? null

  // NULL account_id → primary account
  const resolve = (id: string | null) => id ?? primaryId

  // Opening balances per account
  const openingMap: Record<string, number> = {}
  for (const b of balancesData ?? []) {
    openingMap[b.account_id] =
      (openingMap[b.account_id] ?? 0) +
      (currency === 'ARS' ? b.balance_ars : b.balance_usd)
  }

  // Income per account
  const incomeMap: Record<string, number> = {}
  for (const e of incomeData ?? []) {
    const id = resolve(e.account_id)
    if (id) incomeMap[id] = (incomeMap[id] ?? 0) + e.amount
  }

  // Debit expenses per account
  const debitMap: Record<string, number> = {}
  for (const e of debitExpData ?? []) {
    const id = resolve(e.account_id)
    if (id) debitMap[id] = (debitMap[id] ?? 0) + e.amount
  }

  // Card payments per account
  const cardMap: Record<string, number> = {}
  for (const e of cardPayData ?? []) {
    const id = resolve(e.account_id)
    if (id) cardMap[id] = (cardMap[id] ?? 0) + e.amount
  }

  // Transfer adjustments per account (all transfers, not just cross-currency)
  // Same-currency (ARS→ARS): subtracts from source, adds to destination → total unchanged, per-account correct
  // Cross-currency (ARS→USD viewing ARS): only subtracts from source → per-currency correct
  const transferMap: Record<string, number> = {}
  for (const t of transfersData ?? []) {
    if (t.currency_from === currency) {
      const id = resolve(t.from_account_id)
      if (id) transferMap[id] = (transferMap[id] ?? 0) - t.amount_from
    }
    if (t.currency_to === currency) {
      const id = resolve(t.to_account_id)
      if (id) transferMap[id] = (transferMap[id] ?? 0) + t.amount_to
    }
  }

  const breakdown = accounts.map((acc) => ({
    id: acc.id,
    name: acc.name,
    type: acc.type,
    is_primary: acc.is_primary,
    saldo:
      (openingMap[acc.id] ?? 0) +
      (incomeMap[acc.id] ?? 0) -
      (debitMap[acc.id] ?? 0) -
      (cardMap[acc.id] ?? 0) +
      (transferMap[acc.id] ?? 0),
  }))

  const total = breakdown.reduce((s, a) => s + a.saldo, 0)

  return NextResponse.json({ breakdown, total, currency })
}
