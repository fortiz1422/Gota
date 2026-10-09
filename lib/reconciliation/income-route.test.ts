import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addCheckpoint, acceptAdjustment, emptyWorkspace } from './domain'
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  rows: vi.fn(),
  balance: vi.fn(),
  accounts: vi.fn(),
  incomes: vi.fn(),
  expenses: vi.fn(),
}))
const account = '10000000-0000-4000-8000-000000000001',
  fingerprint = 'a'.repeat(32)
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: '00000000-0000-0000-0000-000000000001',
            is_anonymous: false,
          },
        },
      }),
    },
    from: (table: string) => {
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        in: () => q,
        neq: () => q,
        order: () => q,
        limit: () => q,
        single: async () => ({
          data: {
            id: '10000000-0000-4000-8000-000000000001',
            name: 'BBVA',
            type: 'bank',
          },
          error: null,
        }),
        then: (
          resolve: (value: unknown) => unknown,
          reject: (reason: unknown) => unknown
        ) =>
          (table === 'accounts'
            ? mocks.accounts()
            : table === 'income_entries'
              ? mocks.incomes()
              : mocks.expenses()
          ).then(resolve, reject),
      }
      return q
    },
  }),
}))
vi.mock('@/lib/current-account-balance', () => ({
  getCurrentAccountBalance: mocks.balance,
}))
vi.mock('@/lib/reconciliation/repository', () => ({
  reconciliationEnabled: () => true,
  ledgerSnapshot: async () => ({
    fingerprint: 'a'.repeat(32),
    movementIds: [],
  }),
  readWorkspaces: mocks.rows,
  readReceipt: async () => null,
  saveWorkspace: mocks.save,
}))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: () => true }))
import { POST, GET } from '@/app/api/reconciliation/route'
function request(payload: Record<string, unknown> = {}) {
  return new Request(
    `http://localhost/api/reconciliation?accountId=${account}&currency=ARS`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: '30000000-0000-4000-8000-000000000001',
        version: 0,
        fingerprint,
        action: 'resolve',
        targetId: 'adjustment',
        included: true,
        draft: {
          kind: 'income',
          amount: '25000',
          description: 'Ingreso faltante',
          category: 'freelance',
          date: '2026-10-06',
        },
        ...payload,
      }),
    }
  )
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('BALANCE_RECONCILIATION_SCHEMA_READY', 'true')
  const cp = addCheckpoint(emptyWorkspace(account, 'ARS'), {
    id: 'cp',
    expected: 30000000,
    confirmed: 35000000,
    observedAt: '2026-10-07T12:00:00Z',
    includedMovementIds: [],
  })
  const state = acceptAdjustment(cp, {
    id: 'adjustment',
    checkpointId: 'cp',
    currentExpected: 30000000,
    now: '2026-10-07T12:00:00Z',
  })
  mocks.rows.mockResolvedValue([
    { account_id: account, currency: 'ARS', version: 0, state },
  ])
  mocks.balance.mockResolvedValue(350000)
  mocks.save.mockResolvedValue({})
  mocks.accounts.mockResolvedValue({
    data: [
      { id: account, name: 'BBVA' },
      { id: '10000000-0000-4000-8000-000000000002', name: 'MP' },
      { id: '10000000-0000-4000-8000-000000000003', name: 'Nación' },
    ],
    error: null,
  })
  mocks.expenses.mockResolvedValue({ data: [], error: null })
  mocks.incomes.mockResolvedValue({
    data: [
      {
        id: 'income',
        amount: 25000,
        date: '2026-10-06',
        description: 'Ingreso',
      },
    ],
    error: null,
  })
})
describe('positive gap and account queue', () => {
  it('saves income and positive partial compensation in one request', async () => {
    expect((await POST(request())).status).toBe(200)
    const saved = mocks.save.mock.calls[0][0]
    expect(saved.expense).toBeUndefined()
    expect(saved.income.amount).toBe(25000)
    expect(saved.state.resolutions[0]).toMatchObject({
      effect: 2500000,
      movementKind: 'income',
      movementId: saved.income.id,
    })
  })
  it('rejects expense-shaped income categories without a write', async () => {
    const payload = await request().json()
    payload.draft.category = 'Supermercado'
    const response = await POST(request(payload))
    expect(response.status).toBe(422)
    expect((await response.json()).error).toContain('categoría del ingreso')
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('identifies dates after the balance observation', async () => {
    const payload = await request().json()
    payload.draft.date = '2026-10-08'
    const response = await POST(request(payload))
    expect(response.status).toBe(422)
    expect((await response.json()).error).toContain('después de confirmar')
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('includes income candidates and a due zero-activity account', async () => {
    const response = await GET(
      new Request(
        `http://localhost/api/reconciliation?accountId=${account}&currency=ARS`
      )
    )
    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result.candidates[0].kind).toBe('income')
    expect(result.queue.map((a: { name: string }) => a.name)).toEqual([
      'BBVA',
      'MP',
      'Nación',
    ])
  })
})
