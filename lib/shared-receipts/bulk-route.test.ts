import { beforeEach, describe, expect, it, vi } from 'vitest'
import { alias, draft, evidence } from './bulk-review.fixtures'
const mocks = vi.hoisted(() => ({
  server: vi.fn(),
  admin: vi.fn(),
  resolve: vi.fn(),
  rate: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.server }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.admin }))
vi.mock('@/lib/counterparty-aliases/server', () => ({
  resolveSavedCounterparty: mocks.resolve,
}))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.rate }))
import { POST } from '@/app/api/shared-receipts/bulk-confirm/route'

function setup(options: { user?: boolean; duplicateError?: boolean } = {}) {
  const queries: Array<{ table: string; column: string; value: unknown }> = []
  const from = vi.fn((table: string) => {
    const q = {
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn((column, value) => {
        queries.push({ table, column, value })
        return q
      }),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({
        data:
          table === 'shared_receipts'
            ? {
                status: 'needs_review',
                parsed_payload: evidence(),
                storage_path: null,
              }
            : { id: draft().payload.card_id, type: 'bank' },
        error: null,
      })),
      limit: vi.fn(async () => ({
        data: [],
        error: options.duplicateError ? new Error('unavailable') : null,
      })),
    }
    return q
  })
  const rpc = vi.fn(async () => ({
    data: [{ outcome: 'confirmed', expense_id: 'expense' }],
    error: null,
  }))
  mocks.server.mockResolvedValue({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: options.user === false ? null : { id: 'owner' } },
      })),
    },
    from,
  })
  mocks.admin.mockReturnValue({ from, rpc })
  mocks.resolve.mockResolvedValue(alias)
  mocks.rate.mockReturnValue(true)
  const row = draft()
  const request = () =>
    new Request('http://localhost/api/shared-receipts/bulk-confirm', {
      method: 'POST',
      body: JSON.stringify({
        entries: [
          {
            id: row.receipt.id,
            payload: row.payload,
            decisions: row.decisions,
          },
        ],
      }),
    })
  return { request, rpc, queries }
}
beforeEach(() => vi.resetAllMocks())
describe('bulk-confirm HTTP → service → canonical RPC', () => {
  it('authenticates before touching the admin client', async () => {
    const fixture = setup({ user: false })
    const response = await POST(fixture.request())
    expect(response.status).toBe(401)
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it('returns the exact UI contract and scopes admin/session queries to the owner', async () => {
    const fixture = setup()
    const response = await POST(fixture.request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      results: [
        { id: draft().receipt.id, outcome: 'confirmed', expenseId: 'expense' },
      ],
    })
    expect(fixture.rpc).toHaveBeenCalledWith(
      'confirm_shared_receipt_purchase',
      expect.objectContaining({
        p_user_id: 'owner',
        p_receipt_id: draft().receipt.id,
        p_payload_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    )
    expect(
      fixture.queries
        .filter((q) => q.column === 'user_id')
        .every((q) => q.value === 'owner')
    ).toBe(true)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })
  it('does not call the financial RPC when the database cannot verify duplicates', async () => {
    const fixture = setup({ duplicateError: true })
    const response = await POST(fixture.request())
    expect(await response.json()).toMatchObject({
      results: [{ outcome: 'error' }],
    })
    expect(fixture.rpc).not.toHaveBeenCalled()
  })
  it('does not treat a bank account as cash even with an owned active account ID', async () => {
    const fixture = setup()
    const row = draft()
    const response = await POST(
      new Request('http://localhost/api/shared-receipts/bulk-confirm', {
        method: 'POST',
        body: JSON.stringify({
          entries: [
            {
              id: row.receipt.id,
              payload: {
                ...row.payload,
                payment_method: 'CASH',
                card_id: null,
                account_id: '10000000-0000-4000-8000-000000000001',
              },
              decisions: row.decisions,
            },
          ],
        }),
      })
    )
    expect(await response.json()).toMatchObject({
      results: [{ outcome: 'blocked' }],
    })
    expect(fixture.rpc).not.toHaveBeenCalled()
  })
})
