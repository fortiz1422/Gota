import { describe, expect, it, vi } from 'vitest'
import {
  confirmReceiptBatch,
  type BulkConfirmationDeps,
} from './bulk-confirmation'
import { alias, draft, evidence } from './bulk-review.fixtures'

const entry = () => {
  const row = draft()
  return { id: row.receipt.id, payload: row.payload, decisions: row.decisions }
}
function deps(): BulkConfirmationDeps {
  return {
    findOwned: vi.fn(async () => ({
      status: 'needs_review',
      parsed_payload: evidence(),
    })),
    resolveAlias: vi.fn(async () => alias),
    referencesValid: vi.fn(async () => true),
    hasDuplicate: vi.fn(async () => false),
    confirm: vi.fn(async () => ({
      outcome: 'confirmed' as const,
      expenseId: 'expense',
    })),
  }
}

describe('server bulk confirmation', () => {
  it('rejects unauthenticated, empty, over-limit, duplicate-ID and injected owner payloads before reads/writes', async () => {
    const d = deps()
    expect(
      (await confirmReceiptBatch(null, { entries: [entry()] }, d)).status
    ).toBe(401)
    for (const input of [
      { entries: [] },
      { entries: [entry(), entry()] },
      {
        entries: Array.from({ length: 21 }, (_, i) => ({
          ...entry(),
          id: `20000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        })),
      },
      { entries: [{ ...entry(), user_id: 'other' }] },
    ]) {
      expect((await confirmReceiptBatch('owner', input, d)).status).toBe(400)
    }
    expect(d.findOwned).not.toHaveBeenCalled()
    expect(d.confirm).not.toHaveBeenCalled()
  })
  it('scopes every lookup, reference, duplicate check and write to the authenticated owner', async () => {
    const d = deps()
    const e = entry()
    const result = await confirmReceiptBatch('owner', { entries: [e] }, d)
    expect(result.body).toEqual({
      results: [
        { id: e.id, outcome: 'confirmed' as const, expenseId: 'expense' },
      ],
    })
    expect(d.findOwned).toHaveBeenCalledWith('owner', e.id)
    expect(d.resolveAlias).toHaveBeenCalledWith('owner', 'Juliana Farías')
    expect(d.referencesValid).toHaveBeenCalledWith('owner', e.payload)
    expect(d.hasDuplicate).toHaveBeenCalledWith('owner', e.payload)
    expect(d.confirm).toHaveBeenCalledWith('owner', e.id, e.payload)
  })
  it('does not trust stale client readiness after an alias category changes', async () => {
    const d = deps()
    d.resolveAlias = vi.fn(async () => ({
      ...alias,
      default_category: 'Otros' as const,
    }))
    const result = await confirmReceiptBatch('owner', { entries: [entry()] }, d)
    expect(result.body).toMatchObject({
      results: [{ outcome: 'blocked', message: 'Revisá categoría' }],
    })
    expect(d.confirm).not.toHaveBeenCalled()
  })
  it.each(['parsing', 'dismissed', 'expired'])(
    'blocks stale %s receipts',
    async (status) => {
      const d = deps()
      d.findOwned = vi.fn(async () => ({ status, parsed_payload: evidence() }))
      await confirmReceiptBatch('owner', { entries: [entry()] }, d)
      expect(d.confirm).not.toHaveBeenCalled()
    }
  )
  it('blocks foreign/missing receipts and unavailable references', async () => {
    const d = deps()
    d.findOwned = vi.fn(async () => null)
    await confirmReceiptBatch('owner', { entries: [entry()] }, d)
    expect(d.confirm).not.toHaveBeenCalled()
    const other = deps()
    other.referencesValid = vi.fn(async () => false)
    await confirmReceiptBatch('owner', { entries: [entry()] }, other)
    expect(other.confirm).not.toHaveBeenCalled()
  })
  it('rechecks duplicates after each commit and preserves partial successes', async () => {
    const d = deps()
    let committed = false
    d.hasDuplicate = vi.fn(async () => committed)
    d.confirm = vi.fn(async () => {
      committed = true
      return { outcome: 'confirmed' as const, expenseId: 'expense' }
    })
    const a = entry(),
      b = { ...entry(), id: '20000000-0000-4000-8000-000000000002' }
    const result = await confirmReceiptBatch('owner', { entries: [a, b] }, d)
    expect(result.body).toMatchObject({
      results: [
        { outcome: 'confirmed' },
        { outcome: 'blocked', message: expect.stringContaining('duplicado') },
      ],
    })
    expect(d.confirm).toHaveBeenCalledTimes(1)
  })
  it('fails closed on duplicate-check errors while continuing independent entries', async () => {
    const d = deps()
    d.hasDuplicate = vi
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValue(false)
    const result = await confirmReceiptBatch(
      'owner',
      {
        entries: [
          entry(),
          { ...entry(), id: '20000000-0000-4000-8000-000000000002' },
        ],
      },
      d
    )
    expect(result.body).toMatchObject({
      results: [{ outcome: 'error' }, { outcome: 'confirmed' }],
    })
    expect(d.confirm).toHaveBeenCalledTimes(1)
  })
  it('sends an already-confirmed receipt to the canonical hash guard without duplicate reinsertion', async () => {
    const d = deps()
    d.findOwned = vi.fn(async () => ({
      status: 'confirmed',
      parsed_payload: evidence(),
    }))
    d.confirm = vi.fn(async () => ({
      outcome: 'replay' as const,
      expenseId: 'expense',
    }))
    const result = await confirmReceiptBatch('owner', { entries: [entry()] }, d)
    expect(result.body).toMatchObject({
      results: [{ outcome: 'replay' as const, expenseId: 'expense' }],
    })
    expect(d.hasDuplicate).not.toHaveBeenCalled()
    d.confirm = vi.fn(async () => {
      throw new Error('payload hash mismatch')
    })
    expect(
      (await confirmReceiptBatch('owner', { entries: [entry()] }, d)).body
    ).toMatchObject({ results: [{ outcome: 'error' }] })
  })
})
