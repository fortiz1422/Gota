import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { readDashboardData } from '@/lib/server/dashboard-queries'
import { getCurrentBalanceBreakdown } from '@/lib/current-account-balance'
import type { createClient as serverClient } from '@/lib/supabase/server'

vi.mock('@/lib/reconciliation/repository', () => ({
  readCorrections: async () => [],
}))
vi.mock('@/lib/flags', () => ({ FF_INSTRUMENTS: true }))
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-29T15:00:00Z'))
})
afterEach(() => vi.useRealTimers())

type Row = Record<string, unknown>
function fixtureClient(
  expenses: Row[],
  incomes: Row[] = [],
  options: {
    cap?: number
    tables?: Record<string, Row[]>
    failingTable?: string
    failingOffset?: number
  } = {}
) {
  const requests: string[] = []
  const rows: Record<string, Row[]> = {
    accounts: [
      {
        id: 'bank',
        name: 'Banco',
        user_id: 'user',
        type: 'bank',
        is_primary: true,
        archived: false,
        opening_balance_ars: 36_000_000,
        opening_balance_usd: 0,
      },
    ],
    expenses,
    income_entries: incomes,
    ...options.tables,
  }
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    const table = url.pathname.split('/').at(-1)!
    requests.push(url.toString())
    if (
      table === options.failingTable &&
      Number(url.searchParams.get('offset') ?? 0) >=
        (options.failingOffset ?? 0)
    )
      return new Response(JSON.stringify({ message: 'unavailable' }), {
        status: 503,
        headers: { 'Retry-After': '0' },
      })
    if (table === 'get_dashboard_data')
      return new Response('null', { status: 200 })
    if (table === 'user_config')
      return new Response(
        JSON.stringify({
          default_currency: 'ARS',
          hero_balance_mode: 'default_currency',
          rollover_mode: 'auto',
        }),
        { status: 200 }
      )
    let data = [...(rows[table] ?? [])]
    for (const [key, filter] of url.searchParams) {
      if (['select', 'order', 'offset', 'limit', 'or'].includes(key)) continue
      const dot = filter.indexOf('.')
      const op = filter.slice(0, dot),
        value = filter.slice(dot + 1)
      data = data.filter((row) => {
        const actual = String(row[key])
        if (op === 'eq') return actual === value
        if (op === 'neq') return actual !== value
        if (op === 'in') return value.slice(1, -1).split(',').includes(actual)
        if (op === 'lt') return actual < value
        if (op === 'lte') return actual <= value
        if (op === 'gte') return actual >= value
        return true
      })
    }
    const total = data.length
    if (url.searchParams.get('order')?.startsWith('id.'))
      data.sort((a, b) => String(a.id).localeCompare(String(b.id)))
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const limit = Math.min(
      options.cap ?? 1000,
      Number(url.searchParams.get('limit') ?? 1000)
    )
    data = data.slice(offset, offset + limit)
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Range': data.length
          ? `${offset}-${offset + data.length - 1}/${total}`
          : `*/${total}`,
      },
    })
  })
  const client = createClient('https://fixture.supabase.co', 'fixture', {
    global: { fetch: fetcher },
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as Awaited<ReturnType<typeof serverClient>>
  return { client, requests }
}

it('includes the large outgoing entries beyond the Data API 1000-row cap in the Home balance', async () => {
  const expenses = Array.from({ length: 1048 }, (_, n) => ({
    id: `e${String(n).padStart(5, '0')}`,
    user_id: 'user',
    account_id: 'bank',
    currency: 'ARS',
    date: '2026-10-10T12:00:00Z',
    payment_method: n < 1000 ? 'CREDIT' : 'TRANSFER',
    category: 'Otros',
    amount: n === 1000 ? 33_999_953 : 1,
  }))
  const { client, requests } = fixtureClient(expenses)
  const data = await readDashboardData({
    supabase: client,
    userId: 'user',
    selectedMonth: '2026-10',
    viewCurrency: 'ARS',
  })
  expect(data.heroBreakdown.ARS).toBeCloseTo(2_000_000, 2)
  expect(data.accountBalances[0].saldo).toBeCloseTo(data.heroBreakdown.ARS, 2)
  expect(
    requests.filter(
      (url) =>
        url.includes('/expenses?') &&
        url.includes('payment_method=in.') &&
        url.includes('offset=')
    )
  ).toHaveLength(3)
})

it('reads all income pages for the per-account balance used by transfers and reconciliation', async () => {
  const incomes = Array.from({ length: 1001 }, (_, n) => ({
    id: `i${String(n).padStart(5, '0')}`,
    user_id: 'user',
    account_id: 'bank',
    currency: 'ARS',
    date: '2026-10-10T12:00:00Z',
    amount: 10,
  }))
  const { client } = fixtureClient([], incomes)
  const balances = await getCurrentBalanceBreakdown({
    supabase: client,
    userId: 'user',
    currency: 'ARS',
  })
  expect(balances[0].saldo).toBeCloseTo(36_010_010, 2)
})

it.each([1, 37, 100])(
  'preserves the Home total when the Data API caps responses at %i rows',
  async (cap) => {
    const expenses = Array.from({ length: 1001 }, (_, n) => ({
      id: `e${String(n).padStart(5, '0')}`,
      user_id: 'user',
      account_id: 'bank',
      currency: 'ARS',
      date: '2026-10-10T12:00:00Z',
      payment_method: 'TRANSFER',
      category: 'Otros',
      amount: n === 1000 ? 34000000 : 1,
    }))
    const { client } = fixtureClient(expenses, [], { cap })
    const data = await readDashboardData({
      supabase: client,
      userId: 'user',
      selectedMonth: '2026-10',
      viewCurrency: 'ARS',
    })
    expect(data.heroBreakdown.ARS).toBe(1999000)
  }
)

it('completes accounts, instrument capital and committed goal contributions beyond 1000 rows', async () => {
  const accounts = Array.from({ length: 1001 }, (_, n) => ({
    id: `a${String(n).padStart(5, '0')}`,
    user_id: 'user',
    name: 'Cuenta de prueba',
    type: 'bank',
    is_primary: n === 0,
    archived: false,
    opening_balance_ars: 100,
    opening_balance_usd: 0,
  }))
  const instruments = Array.from({ length: 1001 }, (_, n) => ({
    id: `i${n}`,
    user_id: 'user',
    account_id: 'a00000',
    amount: 1,
    currency: 'ARS',
    status: 'active',
    opened_at: '2026-10-01',
  }))
  const goals = [
    {
      id: 'g',
      user_id: 'user',
      name: 'Meta',
      status: 'active',
      currency: 'ARS',
      target_amount: 2000,
      starting_amount: 0,
      created_at: '2026-10-01',
      target_date: null,
      planned_monthly_contribution: 0,
    },
  ]
  const contributions = Array.from({ length: 1001 }, (_, n) => ({
    id: `c${n}`,
    user_id: 'user',
    goal_id: 'g',
    amount: 1,
    currency: 'ARS',
    availability_effect: 'committed_only',
    contributed_at: '2026-10-01',
  }))
  const { client } = fixtureClient([], [], {
    tables: { accounts, instruments, goals, goal_contributions: contributions },
  })
  const data = await readDashboardData({
    supabase: client,
    userId: 'user',
    selectedMonth: '2026-10',
    viewCurrency: 'ARS',
  })
  expect(data.accounts).toHaveLength(1001)
  expect(data.heroBreakdown.ARS).toBe(99099)
  expect(data.goalCommitmentsBreakdown.ARS).toBe(1001)
  expect(data.freeBreakdown.ARS).toBe(98098)
  expect(data.goals[0].committedAmount).toBe(1001)
  expect(data.accountBalances.reduce((sum, row) => sum + row.saldo, 0)).toBe(
    data.heroBreakdown.ARS
  )
})

it('fails the Home load rather than returning partial totals when a later page fails', async () => {
  const incomes = Array.from({ length: 1001 }, (_, n) => ({
    id: `i${n}`,
    user_id: 'user',
    account_id: 'bank',
    amount: 10,
    currency: 'ARS',
    date: '2026-10-10T12:00:00Z',
  }))
  const { client } = fixtureClient([], incomes, {
    failingTable: 'income_entries',
    failingOffset: 1000,
  })
  await expect(
    readDashboardData({
      supabase: client,
      userId: 'user',
      selectedMonth: '2026-10',
      viewCurrency: 'ARS',
    })
  ).rejects.toThrow('balance_unavailable')
})

it('does not use the twenty displayed incomes to decide whether a recurring income is still pending', async () => {
  const incomes = Array.from({ length: 21 }, (_, n) => ({
    id: `i${String(n).padStart(3, '0')}`,
    user_id: 'user',
    account_id: 'bank',
    amount: 10,
    currency: 'ARS',
    date: '2026-10-10T12:00:00Z',
    recurring_income_id: n === 20 ? 'recurring' : null,
  }))
  const { client } = fixtureClient([], incomes, {
    tables: {
      recurring_incomes: [
        { id: 'recurring', user_id: 'user', is_active: true, day_of_month: 1 },
      ],
    },
  })
  const data = await readDashboardData({
    supabase: client,
    userId: 'user',
    selectedMonth: '2026-10',
    viewCurrency: 'ARS',
  })
  expect(data.incomeEntries).toHaveLength(20)
  expect(data.recurringPending).toHaveLength(0)
  expect(data.heroBreakdown.ARS).toBe(36000210)
})
