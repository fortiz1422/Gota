import { describe, expect, it } from 'vitest'
import { isMissingPendingMerchantMemoryColumn } from './pending-merchant-memory'
import { listPendingMerchantMemoryRetries } from './pending-merchant-memory-service'

async function loadPendingRetriesForInbox(
  userId: string,
  listRows: (ownerId: string) => Promise<
    Array<{ id: string; pending_merchant_memory: unknown }>
  >
) {
  try {
    return await listPendingMerchantMemoryRetries(userId, { listRows })
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      isMissingPendingMerchantMemoryColumn(
        error as { code?: string; message?: string }
      )
    ) {
      return []
    }
    throw error
  }
}

describe('shared receipt inbox pending retries', () => {
  it('treats PostgREST schema-cache errors as an absent column', () => {
    const error = {
      code: 'PGRST204',
      message:
        "Could not find the 'pending_merchant_memory' column of 'shared_receipts' in the schema cache",
    }
    expect(isMissingPendingMerchantMemoryColumn(error)).toBe(true)
  })

  it('returns an empty retry list when pending rows cannot be queried', async () => {
    const retries = await loadPendingRetriesForInbox('user-1', async () => {
      throw {
        code: 'PGRST204',
        message:
          "Could not find the 'pending_merchant_memory' column of 'shared_receipts' in the schema cache",
      }
    })
    expect(retries).toEqual([])
  })
})
