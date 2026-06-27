import type { SupabaseClient } from '@supabase/supabase-js'
import { getCurrentMonth } from '@/lib/dates'
import { todayAR } from '@/lib/format'
import { buildLiveBalanceBreakdown } from '@/lib/live-balance'
import { buildEstimatedDailyYieldEntries, type ExistingYieldDailyEntry } from '@/lib/yield-daily'
import type { Account, Database, YieldDailyEntryInsert } from '@/types/database'

export async function processDailyYieldEntries(
  supabase: SupabaseClient<Database>,
  userId: string,
  month = getCurrentMonth(),
): Promise<{ inserted_or_updated: number }> {
  const today = todayAR()
  const monthStart = `${month}-01`
  const effectiveTo = today < monthStart ? monthStart : today
  const effectiveFrom = effectiveTo < monthStart ? effectiveTo : monthStart

  const { data: accountsData } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('daily_yield_enabled', true)
    .eq('archived', false)

  const accounts = (accountsData ?? []) as Account[]
  if (accounts.length === 0) return { inserted_or_updated: 0 }

  const [
    { data: incomeData },
    { data: debitExpenseData },
    { data: cardPaymentData },
    { data: transfersData },
    { data: instrumentsData },
    { data: existingEntriesData },
  ] = await Promise.all([
    supabase
      .from('income_entries')
      .select('account_id, amount')
      .eq('user_id', userId)
      .eq('currency', 'ARS')
      .lte('date', today),
    supabase
      .from('expenses')
      .select('account_id, amount')
      .eq('user_id', userId)
      .eq('currency', 'ARS')
      .lte('date', today)
      .in('payment_method', ['CASH', 'DEBIT', 'TRANSFER'])
      .neq('category', 'Pago de Tarjetas'),
    supabase
      .from('expenses')
      .select('account_id, amount')
      .eq('user_id', userId)
      .eq('currency', 'ARS')
      .lte('date', today)
      .eq('category', 'Pago de Tarjetas'),
    supabase
      .from('transfers')
      .select('from_account_id, to_account_id, amount_from, amount_to, currency_from, currency_to')
      .eq('user_id', userId)
      .lte('date', today),
    supabase
      .from('instruments')
      .select('account_id, amount, currency')
      .eq('user_id', userId)
      .eq('status', 'active'),
    supabase
      .from('yield_daily_entries')
      .select('account_id, date, status')
      .eq('user_id', userId)
      .gte('date', monthStart)
      .lte('date', today),
  ])

  const breakdown = buildLiveBalanceBreakdown({
    accounts,
    currency: 'ARS',
    incomes: incomeData ?? [],
    debitExpenses: debitExpenseData ?? [],
    cardPayments: cardPaymentData ?? [],
    transfers: transfersData ?? [],
    yields: [],
    activeInstruments: instrumentsData ?? [],
  })
  const balanceByAccount = new Map(breakdown.map((row) => [row.id, Math.max(0, row.saldo)]))
  const existingByAccount = new Map<string, ExistingYieldDailyEntry[]>()

  for (const entry of existingEntriesData ?? []) {
    const accountEntries = existingByAccount.get(entry.account_id) ?? []
    accountEntries.push({ date: entry.date, status: entry.status ?? 'estimated' })
    existingByAccount.set(entry.account_id, accountEntries)
  }

  const upserts: YieldDailyEntryInsert[] = accounts.flatMap((account) => {
    const rateTna = account.daily_yield_rate ?? 0
    if (rateTna <= 0) return []
    const baseBalance = balanceByAccount.get(account.id) ?? 0
    if (baseBalance <= 0) return []

    return buildEstimatedDailyYieldEntries({
      userId,
      accountId: account.id,
      fromDate: effectiveFrom,
      toDate: effectiveTo,
      baseBalance,
      rateTna,
      capAmount: account.daily_yield_cap_amount,
      existingEntries: existingByAccount.get(account.id) ?? [],
    })
  })

  if (upserts.length === 0) return { inserted_or_updated: 0 }

  const { error } = await supabase
    .from('yield_daily_entries')
    .upsert(upserts, { onConflict: 'account_id,date', ignoreDuplicates: false })

  if (error) throw new Error(error.message)
  return { inserted_or_updated: upserts.length }
}
