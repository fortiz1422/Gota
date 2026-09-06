import { describe, expect, it, vi } from 'vitest'
import {
  analyzeSharedReceipt,
  confirmSharedPurchase,
  dismissSharedReceipt,
  getSharedReceipt,
  listSharedReceipts,
} from './operations'

const receipt = {
  id: 'receipt-1',
  user_id: 'user-1',
  status: 'received' as const,
  storage_path: 'user-1/receipt-1.webp',
  mime_type: 'image/webp' as const,
  parsed_payload: null,
  created_at: '2026-09-06T10:00:00Z',
}

describe('shared receipt inbox operations', () => {
  it('requires a session and lists only pending owner receipts', async () => {
    const listPending = vi.fn(async () => [receipt])
    expect(await listSharedReceipts(null, { listPending })).toEqual({ status: 401, body: { error: 'Unauthorized' } })
    expect(listPending).not.toHaveBeenCalled()

    const response = await listSharedReceipts('user-1', { listPending })
    expect(listPending).toHaveBeenCalledWith('user-1', ['received', 'parsing', 'needs_review', 'parse_failed'])
    expect(response.status).toBe(200)
  })

  it('returns only an owned receipt with a short-lived signed image URL', async () => {
    const findOwned = vi.fn(async (userId: string, id: string) =>
      userId === 'user-1' && id === receipt.id ? receipt : null,
    )
    const signObject = vi.fn(async () => 'https://private.example/signed')

    expect(await getSharedReceipt('user-2', receipt.id, { findOwned, signObject })).toEqual({
      status: 404,
      body: { error: 'Not found' },
    })
    const response = await getSharedReceipt('user-1', receipt.id, { findOwned, signObject })
    expect(signObject).toHaveBeenCalledWith(receipt.storage_path, 300)
    expect(response.body).toMatchObject({ receipt: { id: receipt.id, image_url: 'https://private.example/signed' } })
  })

  it('dismisses the owner row before best-effort private object removal', async () => {
    const calls: string[] = []
    const response = await dismissSharedReceipt('user-1', receipt.id, {
      dismissOwned: async () => {
        calls.push('dismiss')
        return receipt
      },
      removeObject: async () => {
        calls.push('remove')
        throw new Error('storage unavailable')
      },
    })
    expect(response).toEqual({ status: 204, body: null })
    expect(calls).toEqual(['dismiss', 'remove'])
  })
})

describe('private shared receipt analysis', () => {
  it('downloads a private owner object, sanitizes Gemini output and persists a proposal without finance writes', async () => {
    const saveProposal = vi.fn(async (...args: [string, string, unknown]) => {
      expect(args[0]).toBe('user-1')
      expect(args[1]).toBe(receipt.id)
    })
    const response = await analyzeSharedReceipt('user-1', receipt.id, {
      claimOwned: async () => receipt,
      downloadObject: async () => new Uint8Array([1, 2, 3]),
      generateProposal: async ({ mimeType, bytes }) => {
        expect(mimeType).toBe('image/webp')
        expect(bytes).toEqual(new Uint8Array([1, 2, 3]))
        return {
          transaction_type: 'purchase',
          amount: 4200,
          currency: 'ARS',
          reference: 'Visa 4507991234564242',
          confidence: 0.8,
        }
      },
      saveProposal,
      saveFailure: async () => undefined,
    })

    expect(response.status).toBe(200)
    expect(saveProposal).toHaveBeenCalledOnce()
    expect(JSON.stringify(saveProposal.mock.calls[0][2])).not.toContain('4507991234564242')
  })

  it('records parse failure without mutating the ledger', async () => {
    const saveFailure = vi.fn(async () => undefined)
    const response = await analyzeSharedReceipt('user-1', receipt.id, {
      claimOwned: async () => receipt,
      downloadObject: async () => new Uint8Array([1]),
      generateProposal: async () => {
        throw new Error('model failure secret')
      },
      saveProposal: async () => undefined,
      saveFailure,
    })
    expect(response).toEqual({ status: 422, body: { error: 'Receipt could not be analyzed' } })
    expect(saveFailure).toHaveBeenCalledWith('user-1', receipt.id, 'analysis_failed')
  })
})

describe('atomic shared purchase confirmation', () => {
  const validBody = {
    transaction_type: 'purchase',
    amount: 4200,
    currency: 'ARS',
    category: 'Alimentos',
    description: 'Compra',
    is_want: false,
    payment_method: 'DEBIT',
    account_id: '10000000-0000-4000-8000-000000000001',
    card_id: null,
    date: '2026-09-06',
    installments: 1,
  }

  it('accepts canonical installment counts from 1 through 60', async () => {
    const confirmAtomic = vi.fn(async () => ({ outcome: 'confirmed' as const, expense_id: 'expense-1' }))
    for (const installments of [1, 2, 60]) {
      expect((await confirmSharedPurchase('user-1', receipt.id, { ...validBody, installments }, { confirmAtomic })).status).toBe(201)
    }
    expect(confirmAtomic).toHaveBeenCalledTimes(3)
  })

  it('rejects non-purchases, extra user_id, out-of-range installments and invalid canonical fields before the RPC', async () => {
    const confirmAtomic = vi.fn()
    for (const body of [
      { ...validBody, transaction_type: 'income' },
      { ...validBody, user_id: 'attacker' },
      { ...validBody, installments: 0 },
      { ...validBody, installments: 61 },
      { ...validBody, currency: 'EUR' },
      { ...validBody, date: 'not-a-date' },
    ]) {
      expect((await confirmSharedPurchase('user-1', receipt.id, body, { confirmAtomic })).status).toBe(400)
    }
    expect(confirmAtomic).not.toHaveBeenCalled()
  })

  it('passes owner identity and a stable payload hash to the single atomic RPC and returns replay', async () => {
    const confirmAtomic = vi.fn(async (...args: [string, string, unknown, string]) => {
      expect(args[0]).toBe('user-1')
      expect(args[1]).toBe(receipt.id)
      return { outcome: 'replay' as const, expense_id: 'expense-1' }
    })
    const first = await confirmSharedPurchase('user-1', receipt.id, validBody, { confirmAtomic })
    const second = await confirmSharedPurchase('user-1', receipt.id, { ...validBody }, { confirmAtomic })

    expect(first).toEqual({ status: 200, body: { outcome: 'replay', expense_id: 'expense-1' } })
    expect(second).toEqual(first)
    expect(confirmAtomic.mock.calls[0][0]).toBe('user-1')
    expect(confirmAtomic.mock.calls[0][1]).toBe(receipt.id)
    expect(confirmAtomic.mock.calls[0][3]).toMatch(/^[a-f0-9]{64}$/)
    expect(confirmAtomic.mock.calls[0][3]).toBe(confirmAtomic.mock.calls[1][3])
  })

  it('clears the owner-scoped storage path then removes the confirmed private blob best-effort', async () => {
    const calls: string[] = []
    const response = await confirmSharedPurchase('user-1', receipt.id, validBody, {
      confirmAtomic: async () => ({ outcome: 'confirmed', expense_id: 'expense-1', storage_path: receipt.storage_path }),
      clearStoragePath: async (userId, receiptId, path) => {
        calls.push(`clear:${userId}:${receiptId}:${path}`)
        return true
      },
      removeObject: async (path) => {
        calls.push(`remove:${path}`)
        throw new Error('storage unavailable')
      },
    })
    expect(response.status).toBe(201)
    expect(calls).toEqual([
      `clear:user-1:${receipt.id}:${receipt.storage_path}`,
      `remove:${receipt.storage_path}`,
    ])
  })

  it('does not remove a blob when the owner-scoped storage path could not be cleared', async () => {
    const removeObject = vi.fn(async () => undefined)
    await confirmSharedPurchase('user-1', receipt.id, validBody, {
      confirmAtomic: async () => ({ outcome: 'confirmed', expense_id: 'expense-1', storage_path: receipt.storage_path }),
      clearStoragePath: async () => false,
      removeObject,
    })
    expect(removeObject).not.toHaveBeenCalled()
  })
})
