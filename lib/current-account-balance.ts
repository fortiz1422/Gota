import { getCurrentMonth } from '@/lib/dates'
import { FF_YIELD } from '@/lib/flags'
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
  const currentMonth = getCurrentMonth()
  const todayDate = todayAR()
  const { supabase, userId, currency } = params

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
    FF_YIELD
      ? supabase
          .from('yield_accumulator')
          .select('account_id, accumulated')
          .eq('user_id', userId)
          .lte('month', currentMonth)
      : Promise.resolve({ data: [] as { account_id: string; accumulated: number }[] }),
    supabase
      .from('instruments')
      .select('account_id, amount, currency')
      .eq('user_id', userId)
      .eq('status', 'active'),
  ])

  return buildLiveBalanceBreakdown({
    accounts: accountsData ?? [],
    currency,
    incomes: incomeData ?? [],
    debitExpenses: debitExpData ?? [],
    cardPayments: cardPayData ?? [],
    transfers: transfersData ?? [],
    yields: FF_YIELD ? yieldData ?? [] : [],
    activeInstruments: instrumentsData ?? [],
  })
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
