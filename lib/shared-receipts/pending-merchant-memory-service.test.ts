import { describe, expect, it, vi } from 'vitest'
import {
  clearPendingMerchantMemory,
  listPendingMerchantMemoryRetries,
  savePendingMerchantMemory,
} from './pending-merchant-memory-service'

const validPayload = {
  memory: {
    enabled: true as const,
    mode: 'existing' as const,
    name: 'Juliana',
    profileId: 'profile-1',
  },
  detectedAlias: 'Juliana Farías',
  category: 'Alimentos',
  description: 'Juliana Farías',
  aliasMatch: null,
}

describe('pending merchant memory service', () => {
  it('lists only valid owner rows and drops corrupt payloads', async () => {
    const retries = await listPendingMerchantMemoryRetries('user-1', {
      listRows: async () => [
        { id: 'r-1', pending_merchant_memory: validPayload },
        { id: 'r-2', pending_merchant_memory: { broken: true } },
        { id: 'r-3', pending_merchant_memory: { ...validPayload, amount: 1 } },
      ],
    })
    expect(retries).toHaveLength(1)
    expect(retries[0]?.receiptId).toBe('r-1')
  })

  it('requires a confirmed receipt before persisting retry state', async () => {
    const save = vi.fn()
    expect(
      await savePendingMerchantMemory('user-1', 'r-1', validPayload, {
        findOwned: async () => ({ status: 'needs_review' }),
        save,
      })
    ).toMatchObject({ status: 409 })
    expect(save).not.toHaveBeenCalled()

    expect(
      await savePendingMerchantMemory('user-1', 'r-1', validPayload, {
        findOwned: async () => ({ status: 'confirmed' }),
        save: async () => 'saved',
      })
    ).toMatchObject({ status: 204 })
  })

  it('rejects extra keys when saving', async () => {
    const save = vi.fn()
    expect(
      await savePendingMerchantMemory('user-1', 'r-1', {
        ...validPayload,
        amount: 1,
      }, {
        findOwned: async () => ({ status: 'confirmed' }),
        save,
      })
    ).toMatchObject({ status: 400 })
    expect(save).not.toHaveBeenCalled()
  })

  it('isolates retries by owner lookup without writing', async () => {
    const save = vi.fn()
    const findOwned = vi.fn(
      async (ownerId: string, receiptId: string) => {
        expect(ownerId).toBe('user-a')
        expect(receiptId).toBe('r-foreign')
        return null
      }
    )
    expect(
      await savePendingMerchantMemory('user-a', 'r-foreign', validPayload, {
        findOwned,
        save,
      })
    ).toMatchObject({ status: 404 })
    expect(findOwned).toHaveBeenCalledWith('user-a', 'r-foreign')
    expect(save).not.toHaveBeenCalled()
  })

  it('returns 404 when the confirmed row is not updated', async () => {
    expect(
      await savePendingMerchantMemory('user-1', 'r-1', validPayload, {
        findOwned: async () => ({ status: 'confirmed' }),
        save: async () => 'not_found',
      })
    ).toMatchObject({ status: 404 })
  })

  it('returns 503 when persistence is unavailable', async () => {
    expect(
      await savePendingMerchantMemory('user-1', 'r-1', validPayload, {
        findOwned: async () => ({ status: 'confirmed' }),
        save: async () => 'unavailable',
      })
    ).toMatchObject({ status: 503 })
  })

  it('returns 404 when clear does not reclaim a pending row', async () => {
    expect(
      await clearPendingMerchantMemory('user-1', 'r-1', {
        clear: async () => 'not_found',
      })
    ).toMatchObject({ status: 404 })
  })

  it('returns 503 when clear fails', async () => {
    expect(
      await clearPendingMerchantMemory('user-1', 'r-1', {
        clear: async () => 'unavailable',
      })
    ).toMatchObject({ status: 503 })
  })

  it('clears pending state when a row is reclaimed', async () => {
    const clear = vi.fn(async () => 'saved' as const)
    expect(
      await clearPendingMerchantMemory('user-1', 'r-1', { clear })
    ).toMatchObject({ status: 204 })
    expect(clear).toHaveBeenCalledWith('user-1', 'r-1')
  })
})
