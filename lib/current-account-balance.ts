import { todayAR } from '@/lib/format'
import { buildLiveBalanceBreakdown, type LiveBreakdownRow } from '@/lib/live-balance'
import type { createClient } from '@/lib/supabase/server'
import type { Currency } from '@/types/database'

export function getBalanceForAccount(breakdown: LiveBreakdownRow[], accountId: string): number | null {
  return breakdown.find((account) => account.id === accountId)?.saldo ?? null
}

export function hasSufficientFunds(availableBalance: number, requestedAmount: number, epsilon = 0.01): boolean {
  return requestedAmount <= availableBalance + epsilon
}

export async function getCurrentBalanceBreakdown(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  currency: Currency
}): Promise<LiveBreakdownRow[]> {
  const todayDate = todayAR()
  const { supabase, userId, currency } = params

  const [
    { data: accountsData },
    { data: incomeData },
    { data: debitExpData },
    { data: cardPayData },
    { data: transfersData },
    { data: yieldEntriesData },
    { data: instrumentsData },
  ] = await Promise.all([
    supabase
      .from('accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('archived', false)
      .order('is_primary', { ascending: false }),
    supabase
      .from('income_entries')
      .select('account_id, amount')
      .eq('user_id', userId)
      .eq('currency', currency)
      .lte('date', todayDate),
    supabase
      .from('expenses')
      .select('account_id, amount')
      .eq('user_id', userId)
      .eq('currency', currency)
      .lte('date', todayDate)
      .in('payment_method', ['CASH', 'DEBIT', 'TRANSFER'])
      .neq('category', 'Pago de Tarjetas'),
    supabase
      .from('expenses')
      .select('account_id, amount')
      .eq('user_id', userId)
      .eq('currency', currency)
      .lte('date', todayDate)
      .eq('category', 'Pago de Tarjetas'),
    supabase
      .from('transfers')
      .select('from_account_id, to_account_id, amount_from, amount_to, currency_from, currency_to')
      .eq('user_id', userId)
      .lte('date', todayDate),
    supabase
      .from('yield_daily_entries')
      .select('account_id, expected_amount, actual_amount')
      .eq('user_id', userId)
      .lte('date', todayDate),
    supabase
      .from('instruments')
      .select('account_id, amount, currency')
      .eq('user_id', userId)
      .eq('status', 'active'),
  ])

  const yieldTotals = sumYieldEntriesByAccount(yieldEntriesData ?? [])

  return buildLiveBalanceBreakdown({
    accounts: accountsData ?? [],
    currency,
    incomes: incomeData ?? [],
    debitExpenses: debitExpData ?? [],
    cardPayments: cardPayData ?? [],
    transfers: transfersData ?? [],
    yields: yieldTotals,
    activeInstruments: instrumentsData ?? [],
  })
}

function sumYieldEntriesByAccount(
  entries: { account_id: string; expected_amount: number | null; actual_amount: number | null }[],
): { account_id: string; accumulated: number }[] {
  const totals = new Map<string, number>()
  for (const entry of entries) {
    totals.set(
      entry.account_id,
      (totals.get(entry.account_id) ?? 0) + Number(entry.actual_amount ?? entry.expected_amount ?? 0),
    )
  }
  return [...totals.entries()].map(([account_id, accumulated]) => ({
    account_id,
    accumulated: Math.round((accumulated + Number.EPSILON) * 100) / 100,
  }))
}

export async function getCurrentAccountBalance(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  accountId: string
  currency: Currency
}): Promise<number | null> {
  const breakdown = await getCurrentBalanceBreakdown({
    supabase: params.supabase,
    userId: params.userId,
    currency: params.currency,
  })

  return getBalanceForAccount(breakdown, params.accountId)
}
