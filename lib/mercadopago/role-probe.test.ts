import { describe, expect, it, vi } from 'vitest'
import { pullPayments } from './observability-sync'
import { parseSyncWindow } from './sync-window'
const now = new Date('2026-10-02T02:26:00Z')
const window = parseSyncWindow({ preset: 'custom', beginDate: '2026-10-01', endDate: '2026-10-01' }, now)
describe('role-specific payment capture', () => {
  it.each(['payer', 'collector'] as const)('keeps %s filter across pages and preserves provider payload', async role => {
    const first = Array.from({ length: 50 }, (_, id) => ({ id, status: 'approved' }))
    const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ results: first, paging: { total: 51 } }))).mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ id: 50 }], paging: { total: 51 } })))
    const store = { upsertRawObservation: vi.fn() }
    const result = await pullPayments({ userId: 'owner', accessToken: 'secret', window, role, fetchImpl, store, started: now.toISOString(), batchId: 'batch' })
    expect(result).toMatchObject({ status: 'success', count: 51 })
    for (const [input] of fetchImpl.mock.calls) {
      const url = new URL(input)
      expect(url.searchParams.get(`${role}.id`)).toBe('me')
      expect(url.searchParams.has(`${role === 'payer' ? 'collector' : 'payer'}.id`)).toBe(false)
    }
    expect(store.upsertRawObservation.mock.calls[0][0].payload).toEqual(first[0])
    expect(JSON.stringify(result)).not.toContain('secret')
  })
  it('does not equate an empty role result with financial confirmation', async () => {
    const store = { upsertRawObservation: vi.fn() }
    const result = await pullPayments({ userId: 'owner', accessToken: 'secret', window, role: 'payer', fetchImpl: async () => new Response(JSON.stringify({ results: [], paging: { total: 0 } })), store, started: now.toISOString(), batchId: 'batch' })
    expect(result).toEqual({ source: 'payments_search', status: 'success', count: 0, errorCode: null })
    expect(store.upsertRawObservation).not.toHaveBeenCalled()
  })
})
