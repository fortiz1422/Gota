import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { CommandSchema } from './commands'
import { emptyWorkspace, addCheckpoint, acceptAdjustment } from './domain'
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  account: vi.fn(),
  movement: vi.fn(),
  balance: vi.fn(),
  snapshot: vi.fn(),
  rows: vi.fn(),
  receipt: vi.fn(),
  save: vi.fn(),
  rate: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mocks.auth },
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        single: () =>
          table === 'accounts' ? mocks.account() : mocks.movement(),
      }
      return query
    },
  }),
}))
vi.mock('@/lib/current-account-balance', () => ({
  getCurrentAccountBalance: mocks.balance,
}))
vi.mock('@/lib/reconciliation/repository', () => ({
  reconciliationEnabled: () => true,
  ledgerSnapshot: mocks.snapshot,
  readWorkspaces: mocks.rows,
  readReceipt: mocks.receipt,
  saveWorkspace: mocks.save,
}))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.rate }))
import { POST } from '@/app/api/reconciliation/route'
const user = '00000000-0000-0000-0000-000000000001',
  account = '10000000-0000-4000-8000-000000000001'
const fingerprint = 'a'.repeat(32),
  observed = '2026-10-07T12:00:00Z'
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
        action: 'confirm',
        amount: '900',
        ...payload,
      }),
    }
  )
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('BALANCE_RECONCILIATION_SCHEMA_READY', 'true')
  mocks.auth.mockResolvedValue({
    data: { user: { id: user, is_anonymous: false } },
  })
  mocks.account.mockResolvedValue({
    data: { id: account, name: 'Cuenta', type: 'bank' },
    error: null,
  })
  mocks.balance.mockResolvedValue(1000)
  mocks.snapshot.mockResolvedValue({ fingerprint, movementIds: [] })
  mocks.rows.mockResolvedValue([])
  mocks.receipt.mockResolvedValue(null)
  mocks.rate.mockReturnValue(true)
  mocks.save.mockResolvedValue({})
})
describe('reconciliation route guards and atomic commands', () => {
  it('acknowledges an exact committed request after a lost response without another save', async () => {
    const command = CommandSchema.parse(await request().json())
    const intent_hash = createHash('sha256')
      .update(JSON.stringify({ accountId: account, currency: 'ARS', command }))
      .digest('hex')
    mocks.receipt.mockResolvedValue({ intent_hash })
    mocks.rows.mockResolvedValue([
      {
        account_id: account,
        currency: 'ARS',
        version: 1,
        state: emptyWorkspace(account, 'ARS'),
      },
    ])
    expect((await POST(request())).status).toBe(200)
    expect(mocks.save).not.toHaveBeenCalled()
    expect((await POST(request({ amount: '800' }))).status).toBe(409)
  })
  it('saves an observation without a synthetic expense', async () => {
    expect((await POST(request())).status).toBe(200)
    expect(mocks.save.mock.calls[0][0].state.checkpoints[0].delta).toBe(-10000)
    expect(mocks.save.mock.calls[0][0].expense).toBeUndefined()
  })
  it('rejects anonymous sessions', async () => {
    mocks.auth.mockResolvedValue({
      data: { user: { id: user, is_anonymous: true } },
    })
    expect((await POST(request())).status).toBe(401)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('rejects an unavailable foreign account', async () => {
    mocks.account.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    expect((await POST(request())).status).toBe(422)
    expect(mocks.snapshot).not.toHaveBeenCalled()
  })
  it('rejects ledger activity during the balance read', async () => {
    mocks.snapshot
      .mockResolvedValueOnce({ fingerprint, movementIds: [] })
      .mockResolvedValueOnce({ fingerprint: 'b'.repeat(32), movementIds: [] })
    expect((await POST(request())).status).toBe(409)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('rejects stale workspace versions', async () => {
    expect((await POST(request({ version: 1 }))).status).toBe(409)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('commits a real expense and its partial compensation in one RPC', async () => {
    const cp = addCheckpoint(emptyWorkspace(account, 'ARS'), {
      id: 'cp',
      expected: 100000,
      confirmed: 80000,
      observedAt: observed,
      includedMovementIds: [],
    })
    const state = acceptAdjustment(cp, {
      id: 'adjustment',
      checkpointId: 'cp',
      currentExpected: 100000,
      now: observed,
    })
    mocks.rows.mockResolvedValue([
      { account_id: account, currency: 'ARS', version: 0, state },
    ])
    mocks.balance.mockResolvedValue(800)
    const response = await POST(
      request({
        action: 'resolve',
        targetId: 'adjustment',
        included: true,
        draft: {
          amount: '120',
          description: 'Compra',
          category: 'Supermercado',
          date: '2026-10-06',
        },
      })
    )
    expect(response.status).toBe(200)
    const saved = mocks.save.mock.calls[0][0]
    expect(saved.expense.amount).toBe(120)
    expect(saved.state.resolutions[0].effect).toBe(-12000)
    expect(saved.state.resolutions[0].movementId).toBe(saved.expense.id)
  })
  it('does not guess an unknown date or same-day ordering', async () => {
    const state = addCheckpoint(emptyWorkspace(account, 'ARS'), {
      id: 'cp',
      expected: 100000,
      confirmed: 80000,
      observedAt: observed,
      includedMovementIds: [],
    })
    mocks.rows.mockResolvedValue([
      { account_id: account, currency: 'ARS', version: 0, state },
    ])
    for (const date of ['', '2026-10-07'])
      expect(
        (
          await POST(
            request({
              action: 'resolve',
              included: true,
              draft: {
                amount: '120',
                description: 'Compra',
                category: 'Supermercado',
                date,
              },
            })
          )
        ).status
      ).toBe(422)
    expect(mocks.save).not.toHaveBeenCalled()
  })
})
