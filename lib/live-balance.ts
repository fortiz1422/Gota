import type { Account, Currency, Instrument } from '@/types/database'

type AccountAmountRow = {
  account_id: string | null
  amount: number
}

type TransferRow = {
  from_account_id: string
  to_account_id: string
  amount_from: number
  amount_to: number
  currency_from: Currency
  currency_to: Currency
}

type YieldRow = {
  account_id: string
  accumulated: number
}

type HeroAmountRow = {
  amount: number
  currency: Currency
}

export type LiveBreakdownRow = {
  id: string
  name: string
  type: string
  is_primary: boolean
  saldo: number
}

export type HeroSummaryByCurrency = {
  saldoInicial: number
  ingresos: number
  gastosPercibidos: number
  pagoTarjetas: number
  rendimientos: number
}

export type LiveBalanceHeroSummary = Record<Currency, HeroSummaryByCurrency>

type LiveBreakdownInput = {
  accounts: Account[]
  currency: Currency
  incomes: AccountAmountRow[]
  debitExpenses: AccountAmountRow[]
  cardPayments: AccountAmountRow[]
  transfers: TransferRow[]
  yields?: YieldRow[]
  activeInstruments?: Pick<Instrument, 'account_id' | 'amount' | 'currency'>[]
}

export function buildLiveBalanceBreakdown({
  accounts,
  currency,
  incomes,
  debitExpenses,
  cardPayments,
  transfers,
  yields = [],
  activeInstruments = [],
}: LiveBreakdownInput): LiveBreakdownRow[] {
  if (accounts.length === 0) return []

  const primaryId = accounts.find((a) => a.is_primary)?.id ?? accounts[0].id
  const accountIds = new Set(accounts.map((a) => a.id))

  const resolve = (id: string | null) => {
    const nextId = id ?? primaryId
    return accountIds.has(nextId) ? nextId : primaryId
  }

  const balanceMap = new Map<string, number>()
  for (const account of accounts) {
    balanceMap.set(
      account.id,
      currency === 'ARS' ? account.opening_balance_ars : account.opening_balance_usd,
    )
  }

  for (const income of incomes) {
    const id = resolve(income.account_id)
    balanceMap.set(id, (balanceMap.get(id) ?? 0) + income.amount)
  }

  for (const expense of debitExpenses) {
    const id = resolve(expense.account_id)
    balanceMap.set(id, (balanceMap.get(id) ?? 0) - expense.amount)
  }

  for (const payment of cardPayments) {
    const id = resolve(payment.account_id)
    balanceMap.set(id, (balanceMap.get(id) ?? 0) - payment.amount)
  }

  if (currency === 'ARS') {
    for (const y of yields) {
      const id = resolve(y.account_id)
      balanceMap.set(id, (balanceMap.get(id) ?? 0) + y.accumulated)
    }
  }

  for (const transfer of transfers) {
    if (transfer.currency_from === currency) {
      const fromId = resolve(transfer.from_account_id)
      balanceMap.set(fromId, (balanceMap.get(fromId) ?? 0) - transfer.amount_from)
    }
    if (transfer.currency_to === currency) {
      const toId = resolve(transfer.to_account_id)
      balanceMap.set(toId, (balanceMap.get(toId) ?? 0) + transfer.amount_to)
    }
  }

  for (const instrument of activeInstruments) {
    if (instrument.currency !== currency) continue
    const id = resolve(instrument.account_id)
    balanceMap.set(id, (balanceMap.get(id) ?? 0) - instrument.amount)
  }

  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    is_primary: account.is_primary,
    saldo: balanceMap.get(account.id) ?? 0,
  }))
}

export function sumLiveBreakdown(breakdown: LiveBreakdownRow[]): number {
  return breakdown.reduce((sum, account) => sum + account.saldo, 0)
}

export function buildLiveBalanceHeroSummary({
  accounts,
  incomes,
  debitExpenses,
  cardPayments,
  yields = [],
}: {
  accounts: Account[]
  incomes: HeroAmountRow[]
  debitExpenses: HeroAmountRow[]
  cardPayments: HeroAmountRow[]
  yields?: Pick<YieldRow, 'accumulated'>[]
}): LiveBalanceHeroSummary {
  const saldoInicial = {
    ARS: accounts.reduce((sum, account) => sum + account.opening_balance_ars, 0),
    USD: accounts.reduce((sum, account) => sum + account.opening_balance_usd, 0),
  }

  const ingresos = {
    ARS: incomes
      .filter((row) => row.currency === 'ARS')
      .reduce((sum, row) => sum + row.amount, 0),
    USD: incomes
      .filter((row) => row.currency === 'USD')
      .reduce((sum, row) => sum + row.amount, 0),
  }

  const gastosPercibidos = {
    ARS: debitExpenses
      .filter((row) => row.currency === 'ARS')
      .reduce((sum, row) => sum + row.amount, 0),
    USD: debitExpenses
      .filter((row) => row.currency === 'USD')
      .reduce((sum, row) => sum + row.amount, 0),
  }

  const pagoTarjetas = {
    ARS: cardPayments
      .filter((row) => row.currency === 'ARS')
      .reduce((sum, row) => sum + row.amount, 0),
    USD: cardPayments
      .filter((row) => row.currency === 'USD')
      .reduce((sum, row) => sum + row.amount, 0),
  }

  const rendimientos = {
    ARS: yields.reduce((sum, row) => sum + row.accumulated, 0),
    USD: 0,
  }

  return {
    ARS: {
      saldoInicial: saldoInicial.ARS,
      ingresos: ingresos.ARS,
      gastosPercibidos: gastosPercibidos.ARS,
      pagoTarjetas: pagoTarjetas.ARS,
      rendimientos: rendimientos.ARS,
    },
    USD: {
      saldoInicial: saldoInicial.USD,
      ingresos: ingresos.USD,
      gastosPercibidos: gastosPercibidos.USD,
      pagoTarjetas: pagoTarjetas.USD,
      rendimientos: rendimientos.USD,
    },
  }
}

export function sumCrossCurrencyTransferAdjustment(
  transfers: Pick<TransferRow, 'amount_from' | 'amount_to' | 'currency_from' | 'currency_to'>[],
  currency: Currency,
): number {
  return transfers.reduce((sum, transfer) => {
    if (transfer.currency_from !== transfer.currency_to) {
      if (transfer.currency_from === currency) return sum - transfer.amount_from
      if (transfer.currency_to === currency) return sum + transfer.amount_to
    }
    return sum
  }, 0)
}

export function sumActiveInstrumentCapital(
  instruments: Pick<Instrument, 'amount' | 'currency'>[],
  currency: Currency,
): number {
  return instruments.reduce((sum, instrument) => {
    if (instrument.currency !== currency) return sum
    return sum + instrument.amount
  }, 0)
}
