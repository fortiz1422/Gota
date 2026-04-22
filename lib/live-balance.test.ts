import { describe, expect, it } from 'vitest'
import type { Account } from '@/types/database'
import {
  buildLiveBalanceBreakdown,
  buildLiveBalanceHeroSummary,
  sumActiveInstrumentCapital,
  sumCrossCurrencyTransferAdjustment,
  sumLiveBreakdown,
} from './live-balance'

function account(overrides: Partial<Account>): Account {
  return {
    id: 'account-1',
    user_id: 'user-1',
    name: 'Cuenta',
    type: 'bank',
    is_primary: false,
    archived: false,
    opening_balance_ars: 0,
    opening_balance_usd: 0,
    daily_yield_enabled: false,
    daily_yield_rate: null,
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('live balance hero summary', () => {
  it('groups initial balance, income, perceived expenses, card payments and yields by currency', () => {
    const summary = buildLiveBalanceHeroSummary({
      accounts: [
        account({
          id: 'account-1',
          opening_balance_ars: 1000,
          opening_balance_usd: 50,
        }),
        account({
          id: 'account-2',
          opening_balance_ars: 200,
          opening_balance_usd: 10,
        }),
      ],
      incomes: [
        { amount: 1000, currency: 'ARS' },
        { amount: 20, currency: 'USD' },
      ],
      debitExpenses: [
        { amount: 300, currency: 'ARS' },
        { amount: 5, currency: 'USD' },
      ],
      cardPayments: [
        { amount: 150, currency: 'ARS' },
        { amount: 10, currency: 'USD' },
      ],
      yields: [{ accumulated: 25 }],
    })

    expect(summary).toEqual({
      ARS: {
        saldoInicial: 1200,
        ingresos: 1000,
        gastosPercibidos: 300,
        pagoTarjetas: 150,
        rendimientos: 25,
      },
      USD: {
        saldoInicial: 60,
        ingresos: 20,
        gastosPercibidos: 5,
        pagoTarjetas: 10,
        rendimientos: 0,
      },
    })
  })
})

describe('live balance breakdown', () => {
  it('calculates per-account ARS balances across accounts, transfers, yields and instruments', () => {
    const accounts = [
      account({
        id: 'account-1',
        name: 'Principal',
        is_primary: true,
        opening_balance_ars: 1000,
        opening_balance_usd: 100,
      }),
      account({
        id: 'account-2',
        name: 'Billetera',
        type: 'digital',
        opening_balance_ars: 200,
        opening_balance_usd: 20,
      }),
    ]

    const breakdown = buildLiveBalanceBreakdown({
      accounts,
      currency: 'ARS',
      incomes: [
        { account_id: 'account-2', amount: 500 },
        { account_id: null, amount: 300 },
      ],
      debitExpenses: [
        { account_id: 'account-2', amount: 50 },
        { account_id: null, amount: 25 },
        { account_id: 'missing-account', amount: 15 },
      ],
      cardPayments: [{ account_id: 'account-1', amount: 100 }],
      transfers: [
        {
          from_account_id: 'account-1',
          to_account_id: 'account-2',
          amount_from: 200,
          amount_to: 200,
          currency_from: 'ARS',
          currency_to: 'ARS',
        },
        {
          from_account_id: 'account-2',
          to_account_id: 'account-1',
          amount_from: 100,
          amount_to: 4,
          currency_from: 'ARS',
          currency_to: 'USD',
        },
      ],
      yields: [{ account_id: 'account-2', accumulated: 10 }],
      activeInstruments: [
        { account_id: 'account-1', amount: 250, currency: 'ARS' },
        { account_id: 'account-2', amount: 5, currency: 'USD' },
      ],
    })

    expect(breakdown).toEqual([
      {
        id: 'account-1',
        name: 'Principal',
        type: 'bank',
        is_primary: true,
        saldo: 710,
      },
      {
        id: 'account-2',
        name: 'Billetera',
        type: 'digital',
        is_primary: false,
        saldo: 760,
      },
    ])
    expect(sumLiveBreakdown(breakdown)).toBe(1470)
  })

  it('returns no rows when there are no accounts', () => {
    expect(
      buildLiveBalanceBreakdown({
        accounts: [],
        currency: 'ARS',
        incomes: [],
        debitExpenses: [],
        cardPayments: [],
        transfers: [],
      }),
    ).toEqual([])
  })
})

describe('live balance helpers', () => {
  it('sums only cross-currency transfer effects for the selected currency', () => {
    const transfers = [
      {
        amount_from: 100,
        amount_to: 4,
        currency_from: 'ARS' as const,
        currency_to: 'USD' as const,
      },
      {
        amount_from: 5,
        amount_to: 120,
        currency_from: 'USD' as const,
        currency_to: 'ARS' as const,
      },
      {
        amount_from: 20,
        amount_to: 20,
        currency_from: 'ARS' as const,
        currency_to: 'ARS' as const,
      },
    ]

    expect(sumCrossCurrencyTransferAdjustment(transfers, 'ARS')).toBe(20)
    expect(sumCrossCurrencyTransferAdjustment(transfers, 'USD')).toBe(-1)
  })

  it('sums active instrument capital by currency', () => {
    const instruments = [
      { amount: 100, currency: 'ARS' as const },
      { amount: 50, currency: 'ARS' as const },
      { amount: 20, currency: 'USD' as const },
    ]

    expect(sumActiveInstrumentCapital(instruments, 'ARS')).toBe(150)
    expect(sumActiveInstrumentCapital(instruments, 'USD')).toBe(20)
  })
})
