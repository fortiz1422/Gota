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
        save: async () => true,
      })
    ).toMatchObject({ status: 204 })
  })

  it('isolates retries by owner lookup', async () => {
    expect(
      await savePendingMerchantMemory('user-1', 'r-foreign', validPayload, {
        findOwned: async () => null,
        save: async () => true,
      })
    ).toMatchObject({ status: 404 })
  })

  it('clears pending state without requiring a row', async () => {
    const clear = vi.fn(async () => true)
    expect(
      await clearPendingMerchantMemory('user-1', 'r-1', { clear })
    ).toMatchObject({ status: 204 })
    expect(clear).toHaveBeenCalledWith('user-1', 'r-1')
  })
})
