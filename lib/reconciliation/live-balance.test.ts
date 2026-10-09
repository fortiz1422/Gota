import { describe, expect, it } from 'vitest'
import type { Account } from '@/types/database'
import { buildLiveBalanceBreakdown } from '@/lib/live-balance'
import {
  emptyWorkspace,
  addCheckpoint,
  acceptAdjustment,
  resolveAdjustment,
  balanceCorrection,
  checkpointDay,
} from './domain'
const accounts = [
  {
    id: 'bank',
    name: 'Banco',
    type: 'bank',
    is_primary: true,
    opening_balance_ars: 1000,
    opening_balance_usd: 10,
  },
  {
    id: 'wallet',
    name: 'Billetera',
    type: 'digital',
    is_primary: false,
    opening_balance_ars: 0,
    opening_balance_usd: 0,
  },
] as Account[]
const input = {
  accounts,
  currency: 'ARS' as const,
  incomes: [],
  debitExpenses: [],
  cardPayments: [],
  transfers: [],
}
const now = '2026-10-07T12:00:00Z'
describe('reconciliation in the actual live-balance primitive', () => {
  it('preserves total own money when both missing transfer legs are explained', () => {
    const transfer = {
      from_account_id: 'bank',
      to_account_id: 'wallet',
      amount_from: 200,
      amount_to: 200,
      currency_from: 'ARS' as const,
      currency_to: 'ARS' as const,
    }
    const reconcile = (
      accountId: string,
      expected: number,
      confirmed: number,
      effect: number
    ) => {
      const cp = addCheckpoint(emptyWorkspace(accountId, 'ARS'), {
        id: 'cp',
        observedAt: now,
        expected,
        confirmed,
        includedMovementIds: [],
      })
      const adjusted = acceptAdjustment(cp, {
        id: 'a',
        checkpointId: 'cp',
        currentExpected: expected,
        now,
      })
      const resolved = resolveAdjustment(adjusted, {
        id: 'r',
        adjustmentId: 'a',
        movement: {
          id: 'transfer',
          kind: 'transfer',
          accountId,
          currency: 'ARS',
          effect,
          occurredAt: '2026-10-06T03:00:00Z',
          includedBeforeCheckpoint: false,
        },
        now,
        confirmedIncludedInBalance: true,
      })
      return {
        account_id: accountId,
        amount: balanceCorrection(resolved) / 100,
      }
    }
    const corrections = [
      reconcile('bank', 100000, 80000, -20000),
      reconcile('wallet', 0, 20000, 20000),
    ]
    const rows = buildLiveBalanceBreakdown({
      ...input,
      transfers: [transfer],
      reconciliationCorrections: corrections,
    })
    expect(rows.map((row) => row.saldo)).toEqual([800, 200])
    expect(rows.reduce((sum, row) => sum + row.saldo, 0)).toBe(1000)
  })
  it('keeps card payments and instrument capital separate from the correction', () => {
    const rows = buildLiveBalanceBreakdown({
      ...input,
      cardPayments: [{ account_id: 'bank', amount: 100 }],
      activeInstruments: [{ account_id: 'bank', amount: 200, currency: 'ARS' }],
      reconciliationCorrections: [{ account_id: 'bank', amount: -50 }],
    })
    expect(rows[0].saldo).toBe(650)
    expect(
      buildLiveBalanceBreakdown({
        ...input,
        currency: 'USD',
        reconciliationCorrections: [],
      })[0].saldo
    ).toBe(10)
  })
  it('never applies a reconciliation correction to an arbitrary primary account', () => {
    expect(() =>
      buildLiveBalanceBreakdown({
        ...input,
        reconciliationCorrections: [{ account_id: 'missing', amount: -50 }],
      })
    ).toThrow('reconciliation_account_missing')
    expect(() =>
      buildLiveBalanceBreakdown({
        ...input,
        accounts: [],
        reconciliationCorrections: [{ account_id: 'bank', amount: -50 }],
      })
    ).toThrow('reconciliation_account_unavailable')
  })
  it('uses Argentina calendar day even when UTC has advanced to tomorrow', () => {
    expect(checkpointDay('2026-11-01T01:30:00Z')).toBe('2026-10-31')
  })
})
