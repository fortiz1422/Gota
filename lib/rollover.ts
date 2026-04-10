import type { Account } from '@/types/database'
import { isCardPayment, isPerceivedExpense } from '@/lib/movement-classification'

export type PrevMonthSummary = {
  prevIncomeId: null
  prevMonth: string // YYYY-MM
  ingresos: number
  saldoInicial: number
  gastosMes: number
  pagosTarjeta: number
  saldoFinal: number
}

type MinExpense = {
  amount: number
  currency?: string | null
  category: string
  payment_method: string
  account_id?: string | null
}
type MinIncomeEntry = {
  amount: number
  currency: string
  account_id?: string | null
}
type MinTransfer = {
  from_account_id: string
  to_account_id: string
  amount_from: number
  amount_to: number
  currency_from: string
  currency_to: string
}
type PrevAccountBalance = {
  account_id: string
  balance_ars: number
  balance_usd: number
}
type MinAccountBalance = { balance_ars: number; balance_usd: number }

/**
 * Builds the previous month summary for rollover.
 *
 * Priority:
 *   saldo_inicial -> account_period_balance > 0
 *   ingresos -> income_entries > 0
 */
export function buildPrevMonthSummary(
  prevExpenses: MinExpense[],
  currency: 'ARS' | 'USD',
  prevMonth: string,
  prevIncomeEntries: MinIncomeEntry[] = [],
  prevAccountBalances: MinAccountBalance[] = [],
): PrevMonthSummary {
  const entriesSum = prevIncomeEntries
    .filter((e) => e.currency === currency)
    .reduce((s, e) => s + e.amount, 0)

  const ingresos = entriesSum > 0 ? entriesSum : 0

  const balanceSum = prevAccountBalances.reduce(
    (s, b) => s + (currency === 'ARS' ? b.balance_ars : b.balance_usd),
    0,
  )

  const saldoInicial = balanceSum > 0 ? balanceSum : 0

  const gastosMes = prevExpenses
    .filter(
      (e) =>
        (!e.currency || e.currency === currency) &&
        isPerceivedExpense(e),
    )
    .reduce((s, e) => s + e.amount, 0)

  const pagosTarjeta = prevExpenses
    .filter((e) => (!e.currency || e.currency === currency) && isCardPayment(e))
    .reduce((s, e) => s + e.amount, 0)

  const saldoFinal = Math.max(0, saldoInicial + ingresos - gastosMes - pagosTarjeta)

  return {
    prevIncomeId: null,
    prevMonth,
    ingresos,
    saldoInicial,
    gastosMes,
    pagosTarjeta,
    saldoFinal,
  }
}

/**
 * Builds account_period_balance records for rollover.
 * Assigns the full saldoFinal to the primary account (or first account).
 * Used by CierreMesModal for manual rollover.
 */
export function buildPerAccountBalances(
  saldoFinal: number,
  accounts: Account[],
  currency: 'ARS' | 'USD',
): { account_id: string; balance_ars: number; balance_usd: number }[] {
  if (saldoFinal <= 0 || accounts.length === 0) return []
  const primary = accounts.find((a) => a.is_primary) ?? accounts[0]
  return [
    {
      account_id: primary.id,
      balance_ars: currency === 'ARS' ? saldoFinal : 0,
      balance_usd: currency === 'USD' ? saldoFinal : 0,
    },
  ]
}

/**
 * Builds per-account, per-currency balances for auto rollover.
 * Computes each account's closing balance by:
 *   1. Starting from previous period balances (saldo inicial per account)
 *   2. Adding income entries attributed to each account
 *   3. Subtracting CASH/DEBIT/TRANSFER expenses and card payments per account
 *   4. Applying internal transfers (from loses, to gains)
 *
 * Null account_id on income/expenses -> assigned to primary account.
 */
export function buildSmartPerAccountBalances(
  accounts: Account[],
  prevBalances: PrevAccountBalance[],
  incomeEntries: MinIncomeEntry[],
  expenses: MinExpense[],
  transfers: MinTransfer[],
): { account_id: string; balance_ars: number; balance_usd: number }[] {
  if (accounts.length === 0) return []

  const primary = accounts.find((a) => a.is_primary) ?? accounts[0]
  const accountIds = new Set(accounts.map((a) => a.id))

  const map = new Map<string, { ars: number; usd: number }>()
  for (const acc of accounts) {
    map.set(acc.id, { ars: 0, usd: 0 })
  }
  for (const b of prevBalances) {
    if (map.has(b.account_id)) {
      map.get(b.account_id)!.ars = b.balance_ars
      map.get(b.account_id)!.usd = b.balance_usd
    }
  }

  const resolve = (accountId: string | null | undefined): string => {
    const id = accountId ?? primary.id
    return accountIds.has(id) ? id : primary.id
  }

  for (const entry of incomeEntries) {
    const bal = map.get(resolve(entry.account_id))!
    if (entry.currency === 'ARS') bal.ars += entry.amount
    else if (entry.currency === 'USD') bal.usd += entry.amount
  }

  for (const exp of expenses) {
    const isDirectExpense = isPerceivedExpense(exp)
    const isCardPaymentExpense = isCardPayment(exp)
    if (!isDirectExpense && !isCardPaymentExpense) continue

    const bal = map.get(resolve(exp.account_id))!
    const cur = exp.currency ?? 'ARS'
    if (cur === 'ARS') bal.ars -= exp.amount
    else if (cur === 'USD') bal.usd -= exp.amount
  }

  for (const t of transfers) {
    const fromBal = map.get(t.from_account_id)
    const toBal = map.get(t.to_account_id)
    if (fromBal) {
      if (t.currency_from === 'ARS') fromBal.ars -= t.amount_from
      else if (t.currency_from === 'USD') fromBal.usd -= t.amount_from
    }
    if (toBal) {
      if (t.currency_to === 'ARS') toBal.ars += t.amount_to
      else if (t.currency_to === 'USD') toBal.usd += t.amount_to
    }
  }

  return accounts.map((acc) => {
    const bal = map.get(acc.id)!
    return {
      account_id: acc.id,
      balance_ars: Math.max(0, bal.ars),
      balance_usd: Math.max(0, bal.usd),
    }
  })
}

export function sumAccountBalances(
  balances: { balance_ars: number; balance_usd: number }[],
  currency: 'ARS' | 'USD',
): number {
  return balances.reduce(
    (sum, balance) => sum + (currency === 'ARS' ? balance.balance_ars : balance.balance_usd),
    0,
  )
}
