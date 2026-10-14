import { describe, expect, it, vi } from 'vitest'
import { buildParsePreviewConfirmPayload } from '@/components/dashboard/ParsePreview'
import { confirmSharedPurchase } from './operations'
import type { Account } from '@/types/database'

describe('receipt review and confirmation share one contract', () => {
  it('accepts and preserves the tags sent by the actual preview builder', async () => {
    const account = { id: '10000000-0000-4000-8000-000000000001', type: 'bank' } as Account
    const payload = buildParsePreviewConfirmPayload({
      amount: 12345, currency: 'ARS', category: 'Educación', description: 'Ejemplo ficticio',
      is_want: false, is_recurring: true, is_extraordinary: false,
      payment_method: 'TRANSFER', card_id: null, date: '2026-01-10',
    }, account.id, [account], 1)
    const confirmAtomic = vi.fn(async () => ({ outcome: 'confirmed' as const, expense_id: 'test-expense' }))
    const result = await confirmSharedPurchase('test-user', 'test-receipt', payload, { confirmAtomic })
    expect(result.status).toBe(201)
    expect(confirmAtomic).toHaveBeenCalledWith('test-user', 'test-receipt', expect.objectContaining({
      is_recurring: true, is_extraordinary: false,
    }), expect.any(String))
  })
})
