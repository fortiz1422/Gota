import { todayAR } from '@/lib/format'
import {
  buildLiveBalanceBreakdown,
  type LiveBreakdownRow,
} from '@/lib/live-balance'
import type { createClient } from '@/lib/supabase/server'
import type { Currency } from '@/types/database'
import { readCorrections } from '@/lib/reconciliation/repository'
import { liveLedgerExclusiveEnd } from '@/lib/live-ledger-date'
import { readCompleteLedger } from '@/lib/server/read-complete-ledger'

export function getBalanceForAccount(
  breakdown: LiveBreakdownRow[],
  accountId: string
): number | null {
  return breakdown.find((account) => account.id === accountId)?.saldo ?? null
}

export function hasSufficientFunds(
  availableBalance: number,
  requestedAmount: number,
  epsilon = 0.01
): boolean {
  return requestedAmount <= availableBalance + epsilon
}

export async function getCurrentBalanceBreakdown(params: {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  currency: Currency
  /** Ledger anchor for a new checkpoint. Home omits this and keeps the unpublished gap. */
  postedOnly?: boolean
}): Promise<LiveBreakdownRow[]> {
  const todayDate = todayAR()
  const timestampEnd = liveLedgerExclusiveEnd(todayDate)
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
    readCompleteLedger((from, to) =>
      supabase
        .from('income_entries')
        .select('id, account_id, amount', { count: 'exact' })
        .eq('user_id', userId)
        .eq('currency', currency)
        .lt('date', timestampEnd)
        .order('id', { ascending: true })
        .range(from, to)
    ),
    readCompleteLedger((from, to) =>
      supabase
        .from('expenses')
        .select('id, account_id, amount', { count: 'exact' })
        .eq('user_id', userId)
        .eq('currency', currency)
        .lt('date', timestampEnd)
        .in('payment_method', ['CASH', 'DEBIT', 'TRANSFER'])
        .neq('category', 'Pago de Tarjetas')
        .order('id', { ascending: true })
        .range(from, to)
    ),
    readCompleteLedger((from, to) =>
      supabase
        .from('expenses')
        .select('id, account_id, amount', { count: 'exact' })
        .eq('user_id', userId)
        .eq('currency', currency)
        .lt('date', timestampEnd)
        .eq('category', 'Pago de Tarjetas')
        .order('id', { ascending: true })
        .range(from, to)
    ),
    readCompleteLedger((from, to) =>
      supabase
        .from('transfers')
        .select(
          'id, from_account_id, to_account_id, amount_from, amount_to, currency_from, currency_to',
          { count: 'exact' }
        )
        .eq('user_id', userId)
        .lte('date', todayDate)
        .order('id', { ascending: true })
        .range(from, to)
    ),
    readCompleteLedger((from, to) =>
      supabase
        .from('yield_daily_entries')
        .select('id, account_id, expected_amount, actual_amount', {
          count: 'exact',
        })
        .eq('user_id', userId)
        .lte('date', todayDate)
        .order('id', { ascending: true })
        .range(from, to)
    ),
    supabase
      .from('instruments')
      .select('account_id, amount, currency')
      .eq('user_id', userId)
      .eq('status', 'active'),
  ]).then((results) => {
    if (results.some((result) => result.error))
      throw new Error('balance_unavailable')
    return results
  })
  const corrections = await readCorrections(
    userId,
    params.postedOnly ? { postedOnly: true } : undefined
  )

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
    reconciliationCorrections: corrections.filter(
      (row) => row.currency === currency
    ),
  })
}

function sumYieldEntriesByAccount(
  entries: {
    account_id: string
    expected_amount: number | null
    actual_amount: number | null
  }[]
): { account_id: string; accumulated: number }[] {
  const totals = new Map<string, number>()
  for (const entry of entries) {
    totals.set(
      entry.account_id,
      (totals.get(entry.account_id) ?? 0) +
        Number(entry.actual_amount ?? entry.expected_amount ?? 0)
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
  postedOnly?: boolean
}): Promise<number | null> {
  const breakdown = await getCurrentBalanceBreakdown({
    supabase: params.supabase,
    userId: params.userId,
    currency: params.currency,
    postedOnly: params.postedOnly,
  })

  return getBalanceForAccount(breakdown, params.accountId)
}
