import { expect, it, vi } from 'vitest'
import { liveLedgerExclusiveEnd } from '@/lib/live-ledger-date'
import { getCurrentBalanceBreakdown } from '@/lib/current-account-balance'
import type { createClient } from '@/lib/supabase/server'
vi.mock('@/lib/format', () => ({ todayAR: () => '2026-10-31' }))
vi.mock('@/lib/reconciliation/repository', () => ({
  readCorrections: async () => [
    { account_id: 'bank', currency: 'ARS', amount: -80 },
  ],
}))
it('includes expenses/income throughout today in Argentina, excludes tomorrow, and preserves date-only inputs', async () => {
  const rows: Record<string, Record<string, unknown>[]> = {
    accounts: [
      {
        id: 'bank',
        user_id: 'user',
        name: 'Banco',
        type: 'bank',
        is_primary: true,
        archived: false,
        opening_balance_ars: 1000,
        opening_balance_usd: 0,
      },
    ],
    expenses: [
      {
        user_id: 'user',
        account_id: 'bank',
        amount: 120,
        currency: 'ARS',
        category: 'Supermercado',
        payment_method: 'DEBIT',
        date: '2026-10-31T15:00:00Z',
      },
      {
        user_id: 'user',
        account_id: 'bank',
        amount: 100,
        currency: 'ARS',
        category: 'Supermercado',
        payment_method: 'DEBIT',
        date: '2026-11-01T02:59:59Z',
      },
      {
        user_id: 'user',
        account_id: 'bank',
        amount: 900,
        currency: 'ARS',
        category: 'Supermercado',
        payment_method: 'DEBIT',
        date: '2026-11-01T03:00:00Z',
      },
    ],
    income_entries: [
      {
        user_id: 'user',
        account_id: 'bank',
        amount: 50,
        currency: 'ARS',
        date: '2026-10-31T18:00:00Z',
      },
    ],
    transfers: [],
    yield_daily_entries: [],
    instruments: [],
  }
  const filters: string[][] = []
  const supabase = {
    from: (table: string) => {
      let data = rows[table]
      const q = {
        select: () => q,
        order: () => q,
        eq: (key: string, value: unknown) => {
          data = data.filter((r) => r[key] === value)
          return q
        },
        neq: (key: string, value: unknown) => {
          data = data.filter((r) => r[key] !== value)
          return q
        },
        in: (key: string, values: unknown[]) => {
          data = data.filter((r) => values.includes(r[key]))
          return q
        },
        lt: (key: string, value: string) => {
          filters.push([table, 'lt', value])
          data = data.filter(
            (r) => Date.parse(String(r[key])) < Date.parse(value)
          )
          return q
        },
        lte: (key: string, value: string) => {
          filters.push([table, 'lte', value])
          data = data.filter((r) => String(r[key]) <= value)
          return q
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({ data, error: null }).then(resolve),
      }
      return q
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>
  const balance = await getCurrentBalanceBreakdown({
    supabase,
    userId: 'user',
    currency: 'ARS',
  })
  expect(balance[0].saldo).toBe(750)
  expect(liveLedgerExclusiveEnd('2026-10-31')).toBe('2026-11-01T03:00:00.000Z')
  expect(filters).toContainEqual(['transfers', 'lte', '2026-10-31'])
  expect(filters).toContainEqual([
    'income_entries',
    'lt',
    '2026-11-01T03:00:00.000Z',
  ])
})
