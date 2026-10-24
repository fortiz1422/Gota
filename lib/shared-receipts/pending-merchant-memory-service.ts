import {
  parsePendingMerchantMemory,
  PendingMerchantMemorySchema,
  type PendingMerchantMemory,
  type PendingMerchantMemoryRetry,
} from './pending-merchant-memory'

type ServiceResponse = { status: number; body: unknown }

export async function listPendingMerchantMemoryRetries(
  userId: string | null,
  deps: {
    listRows: (
      ownerId: string
    ) => Promise<Array<{ id: string; pending_merchant_memory: unknown }>>
  }
): Promise<PendingMerchantMemoryRetry[]> {
  if (!userId) return []
  const rows = await deps.listRows(userId)
  const retries: PendingMerchantMemoryRetry[] = []
  for (const row of rows) {
    const pending = parsePendingMerchantMemory(row.pending_merchant_memory)
    if (!pending) continue
    retries.push({ receiptId: row.id, ...pending })
  }
  return retries
}

export async function savePendingMerchantMemory(
  userId: string | null,
  receiptId: string,
  input: unknown,
  deps: {
    findOwned: (
      ownerId: string,
      id: string
    ) => Promise<{ status: string } | null>
    save: (
      ownerId: string,
      id: string,
      payload: PendingMerchantMemory
    ) => Promise<boolean>
  }
): Promise<ServiceResponse> {
  if (!userId) return { status: 401, body: { error: 'Unauthorized' } }
  const parsed = PendingMerchantMemorySchema.safeParse(input)
  if (!parsed.success)
    return {
      status: 400,
      body: { error: 'No pudimos guardar el reintento de alias.' },
    }
  const receipt = await deps.findOwned(userId, receiptId)
  if (!receipt)
    return { status: 404, body: { error: 'Comprobante no encontrado.' } }
  if (receipt.status !== 'confirmed')
    return {
      status: 409,
      body: {
        error:
          'Solo se puede reintentar el alias después de confirmar el gasto.',
      },
    }
  const saved = await deps.save(userId, receiptId, parsed.data)
  if (!saved)
    return {
      status: 503,
      body: { error: 'No pudimos guardar el reintento. Reintentá.' },
    }
  return { status: 204, body: null }
}

export async function clearPendingMerchantMemory(
  userId: string | null,
  receiptId: string,
  deps: {
    clear: (ownerId: string, id: string) => Promise<boolean>
  }
): Promise<ServiceResponse> {
  if (!userId) return { status: 401, body: { error: 'Unauthorized' } }
  await deps.clear(userId, receiptId)
  return { status: 204, body: null }
}
