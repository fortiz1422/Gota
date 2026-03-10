import type { Account, MonthlyIncome } from '@/types/database'

export type PrevMonthSummary = {
  prevIncomeId: string | null // null when no monthly_income for that month
  prevMonth: string           // YYYY-MM
  ingresos: number
  saldoInicial: number
  gastosMes: number
  pagosTarjeta: number
  saldoFinal: number
}

type MinExpense = { amount: number; category: string; payment_method: string }
type MinIncomeEntry = { amount: number; currency: string }
type MinAccountBalance = { balance_ars: number; balance_usd: number }

export function calcularSaldoFinal(
  prevIncome: Pick<
    MonthlyIncome,
    'amount_ars' | 'amount_usd' | 'saldo_inicial_ars' | 'saldo_inicial_usd'
  >,
  prevExpenses: MinExpense[],
  currency: 'ARS' | 'USD',
): number {
  const ingresos = currency === 'ARS' ? prevIncome.amount_ars : prevIncome.amount_usd
  const saldoInicial =
    currency === 'ARS' ? prevIncome.saldo_inicial_ars : prevIncome.saldo_inicial_usd

  const gastosMes = prevExpenses
    .filter(
      (e) =>
        ['CASH', 'DEBIT', 'TRANSFER'].includes(e.payment_method) &&
        e.category !== 'Pago de Tarjetas',
    )
    .reduce((s, e) => s + e.amount, 0)

  const pagosTarjeta = prevExpenses
    .filter((e) => e.category === 'Pago de Tarjetas')
    .reduce((s, e) => s + e.amount, 0)

  return Math.max(0, saldoInicial + ingresos - gastosMes - pagosTarjeta)
}

/**
 * Builds the previous month summary for rollover.
 *
 * Priority (same as get_dashboard_data SQL):
 *   saldo_inicial → account_period_balance > monthly_income > 0
 *   ingresos      → income_entries > monthly_income > 0
 *
 * prevIncome can be null when the user never used monthly_income.
 */
export function buildPrevMonthSummary(
  prevIncome: MonthlyIncome | null,
  prevExpenses: MinExpense[],
  currency: 'ARS' | 'USD',
  prevMonth: string,
  prevIncomeEntries: MinIncomeEntry[] = [],
  prevAccountBalances: MinAccountBalance[] = [],
): PrevMonthSummary {
  // Ingresos: income_entries first, fallback to monthly_income
  const entriesSum = prevIncomeEntries
    .filter((e) => e.currency === currency)
    .reduce((s, e) => s + e.amount, 0)

  const ingresos =
    entriesSum > 0
      ? entriesSum
      : prevIncome
        ? currency === 'ARS'
          ? prevIncome.amount_ars
          : prevIncome.amount_usd
        : 0

  // Saldo inicial: account_period_balance first, fallback to monthly_income
  const balanceSum = prevAccountBalances.reduce(
    (s, b) => s + (currency === 'ARS' ? b.balance_ars : b.balance_usd),
    0,
  )

  const saldoInicial =
    balanceSum > 0
      ? balanceSum
      : prevIncome
        ? currency === 'ARS'
          ? prevIncome.saldo_inicial_ars
          : prevIncome.saldo_inicial_usd
        : 0

  const gastosMes = prevExpenses
    .filter(
      (e) =>
        ['CASH', 'DEBIT', 'TRANSFER'].includes(e.payment_method) &&
        e.category !== 'Pago de Tarjetas',
    )
    .reduce((s, e) => s + e.amount, 0)

  const pagosTarjeta = prevExpenses
    .filter((e) => e.category === 'Pago de Tarjetas')
    .reduce((s, e) => s + e.amount, 0)

  const saldoFinal = Math.max(0, saldoInicial + ingresos - gastosMes - pagosTarjeta)

  return {
    prevIncomeId: prevIncome?.id ?? null,
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
