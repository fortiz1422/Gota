import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acceptAdjustment,
  addCheckpoint,
  emptyWorkspace,
  balanceCorrection,
} from './domain'
const a = '10000000-0000-4000-8000-000000000001',
  b = '10000000-0000-4000-8000-000000000002'
const user = '00000000-0000-4000-8000-000000000001',
  transferId = '20000000-0000-4000-8000-000000000001'
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  rows: vi.fn(),
  account: vi.fn(),
  transfer: vi.fn(),
  receipt: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: user, is_anonymous: false } },
      }),
    },
    from: (table: string) => {
      const filters: Record<string, unknown> = {}
      const q = {
        select: () => q,
        eq: (key: string, value: unknown) => {
          filters[key] = value
          return q
        },
        single: () =>
          table === 'accounts' ? mocks.account(filters.id) : mocks.transfer(),
      }
      return q
    },
  }),
}))
vi.mock('@/lib/current-account-balance', () => ({
  getCurrentAccountBalance: async () => 950000,
}))
vi.mock('@/lib/reconciliation/repository', () => ({
  reconciliationEnabled: () => true,
  ledgerSnapshot: async () => ({
    fingerprint: 'a'.repeat(32),
    movementIds: [],
  }),
  readWorkspaces: mocks.rows,
  readReceipt: mocks.receipt,
  saveTransferReconciliation: mocks.save,
  saveWorkspace: vi.fn(),
}))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: () => true }))
import { POST } from '@/app/api/reconciliation/route'
function workspace(id: string, sign: number) {
  const cp = addCheckpoint(emptyWorkspace(id, 'ARS'), {
    id: 'cp',
    expected: 10000000,
    confirmed: 10000000 + sign * 5000000,
    observedAt: '2026-10-09T12:00:00Z',
    includedMovementIds: [],
  })
  return acceptAdjustment(cp, {
    id: 'adjust',
    checkpointId: 'cp',
    currentExpected: 10000000,
    now: '2026-10-09T12:00:01Z',
  })
}
function request(change: Record<string, unknown> = {}) {
  return new Request(
    `http://localhost/api/reconciliation?accountId=${a}&currency=ARS`,
    {
      method: 'POST',
      body: JSON.stringify({
        requestId: '30000000-0000-4000-8000-000000000001',
        version: 1,
        fingerprint: 'a'.repeat(32),
        action: 'resolve',
        targetId: 'adjust',
        included: true,
        draft: {
          kind: 'transfer',
          amount: '50000',
          date: '2026-10-08',
          description: '',
          category: '',
          direction: 'out',
          counterAccountId: b,
        },
        transferPeer: {
          accountId: b,
          targetId: 'adjust',
          included: true,
          sameDayBefore: false,
        },
        ...change,
      }),
    }
  )
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('BALANCE_RECONCILIATION_SCHEMA_READY', 'true')
  mocks.rows.mockResolvedValue([
    { account_id: a, currency: 'ARS', version: 1, state: workspace(a, -1) },
    { account_id: b, currency: 'ARS', version: 2, state: workspace(b, 1) },
  ])
  mocks.account.mockImplementation(async (id) => ({
    data: { id, name: id === a ? 'BBVA' : 'MP', type: 'bank' },
    error: null,
  }))
  mocks.receipt.mockResolvedValue(null)
  mocks.save.mockResolvedValue({ saved: true })
  mocks.transfer.mockResolvedValue({
    data: {
      id: transferId,
      from_account_id: a,
      to_account_id: b,
      currency_from: 'ARS',
      currency_to: 'ARS',
      amount_from: 50000,
      amount_to: 50000,
      date: '2026-10-08',
    },
    error: null,
  })
})
describe('own transfers in reconciliation', () => {
  it('creates one transfer and resolves both explicit legs in one save', async () => {
    expect((await POST(request())).status).toBe(200)
    const saved = mocks.save.mock.calls[0][0]
    expect(saved.transfer).toMatchObject({
      from_account_id: a,
      to_account_id: b,
      amount_from: 50000,
      amount_to: 50000,
    })
    expect(saved.changes).toHaveLength(2)
    for (const change of saved.changes)
      expect(balanceCorrection(change.state)).toBe(0)
    expect(saved.changes[0].state.resolutions[0].movementId).toBe(
      saved.changes[1].state.resolutions[0].movementId
    )
    expect(
      saved.changes.map(
        (c: { state: ReturnType<typeof workspace> }) =>
          c.state.resolutions[0].effect
      )
    ).toEqual([-5000000, 5000000])
  })
  it('supports incoming transfers with the correct source and both signs', async () => {
    const rows = await mocks.rows()
    rows[0].state = workspace(a, 1)
    rows[1].state = workspace(b, -1)
    const payload = await request().json()
    payload.draft.direction = 'in'
    expect((await POST(request(payload))).status).toBe(200)
    const saved = mocks.save.mock.calls[0][0]
    expect(saved.transfer).toMatchObject({
      from_account_id: b,
      to_account_id: a,
    })
    expect(
      saved.changes.map(
        (c: { state: ReturnType<typeof workspace> }) =>
          c.state.resolutions[0].effect
      )
    ).toEqual([5000000, -5000000])
  })
  it('resolves an observation on the peer without inventing a posted adjustment', async () => {
    const rows = await mocks.rows()
    rows[1].state.adjustments = []
    const payload = await request().json()
    delete payload.transferPeer.targetId
    expect((await POST(request(payload))).status).toBe(200)
    const peer = mocks.save.mock.calls[0][0].changes[1].state
    expect(peer.adjustments).toHaveLength(0)
    expect(peer.resolutions[0].adjustmentId).toBe('checkpoint:cp')
    expect(peer.step).toBe('resolved')
  })
  it('keeps the residual in both partially explained adjustments', async () => {
    const payload = await request().json()
    payload.draft.amount = '20000'
    expect((await POST(request(payload))).status).toBe(200)
    expect(
      mocks.save.mock.calls[0][0].changes.map(
        (c: { state: ReturnType<typeof workspace> }) =>
          balanceCorrection(c.state)
      )
    ).toEqual([-3000000, 3000000])
  })
  it('links an existing transfer without creating another row', async () => {
    expect(
      (
        await POST(
          request({
            draft: undefined,
            movementId: transferId,
            movementKind: 'transfer',
          })
        )
      ).status
    ).toBe(200)
    expect(mocks.save.mock.calls[0][0].transfer).toBeUndefined()
  })
  it('links an existing incoming transfer and resolves its outgoing peer', async () => {
    const rows = await mocks.rows()
    rows[0].state = workspace(a, 1)
    rows[1].state = workspace(b, -1)
    const transfer = (await mocks.transfer()).data
    transfer.from_account_id = b
    transfer.to_account_id = a
    expect(
      (
        await POST(
          request({
            draft: undefined,
            movementId: transferId,
            movementKind: 'transfer',
          })
        )
      ).status
    ).toBe(200)
    const saved = mocks.save.mock.calls[0][0]
    expect(saved.transfer).toBeUndefined()
    expect(
      saved.changes.map(
        (c: { state: ReturnType<typeof workspace> }) =>
          c.state.resolutions[0].effect
      )
    ).toEqual([5000000, -5000000])
  })
  it('allows a new transfer when the peer has no correction without inventing a checkpoint', async () => {
    const rows = await mocks.rows()
    mocks.rows.mockResolvedValue([rows[0]])
    expect((await POST(request({ transferPeer: undefined }))).status).toBe(200)
    expect(mocks.save.mock.calls[0][0].changes).toHaveLength(1)
  })
  it('requires explicit peer confirmation when the other account has a posted correction', async () => {
    const response = await POST(request({ transferPeer: undefined }))
    expect((await response.json()).code).toBe('peer_confirmation_required')
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('rejects the same account and foreign/archived accounts', async () => {
    const payload = await request().json()
    payload.draft.counterAccountId = a
    expect((await POST(request(payload))).status).toBe(422)
    mocks.account.mockImplementation(async (id) => ({
      data: id === b ? null : { id },
      error: null,
    }))
    expect((await POST(request())).status).toBe(422)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('rejects a peer that is not the other leg', async () => {
    const payload = await request().json()
    payload.transferPeer.accountId = a
    expect((await POST(request(payload))).status).toBe(422)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('requires evidence inclusion separately for both accounts', async () => {
    for (const peer of [false, true]) {
      const payload = await request().json()
      if (peer) payload.transferPeer.included = false
      else payload.included = false
      expect((await POST(request(payload))).status).toBe(422)
    }
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('requires same-day ordering independently for the peer', async () => {
    const payload = await request().json()
    payload.draft.date = '2026-10-09'
    payload.sameDayBefore = true
    expect((await POST(request(payload))).status).toBe(422)
    payload.transferPeer.sameDayBefore = true
    expect((await POST(request(payload))).status).toBe(200)
  })
  it('rejects wrong direction, oversized amount and dates after confirmation', async () => {
    for (const change of [
      { direction: 'in' },
      { amount: '60000' },
      { date: '2026-10-10' },
    ]) {
      const payload = await request().json()
      Object.assign(payload.draft, change)
      expect((await POST(request(payload))).status).toBe(422)
    }
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('rejects evidence already captured by the checkpoint', async () => {
    const rows = await mocks.rows()
    rows[0].state.checkpoints[0].includedMovementIds = [
      `transfer:${transferId}`,
    ]
    expect(
      (
        await POST(
          request({
            draft: undefined,
            movementId: transferId,
            movementKind: 'transfer',
          })
        )
      ).status
    ).toBe(422)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it('returns a conflict when the transaction detects a concurrent change', async () => {
    mocks.save.mockRejectedValue(new Error('state_changed'))
    expect((await POST(request())).status).toBe(409)
  })
})
