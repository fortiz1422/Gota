export const EXPIRABLE_RECEIPT_STATUSES = ['received', 'needs_review', 'parse_failed'] as const

type ExpiredReceipt = { id: string; storage_path: string | null }

export async function cleanupExpiredSharedReceipts(
  now: string,
  deps: {
    expireRows: (now: string, statuses: readonly string[]) => Promise<ExpiredReceipt[]>
    clearStoragePath: (receiptId: string, path: string) => Promise<boolean>
    removeObject: (path: string) => Promise<void>
  },
) {
  const rows = await deps.expireRows(now, EXPIRABLE_RECEIPT_STATUSES)
  let objectsCleared = 0
  for (const row of rows) {
    if (!row.storage_path) continue
    const cleared = await deps.clearStoragePath(row.id, row.storage_path)
    if (!cleared) continue
    objectsCleared += 1
    try {
      await deps.removeObject(row.storage_path)
    } catch {
      // The durable expiry/path clear wins; storage deletion is retryable maintenance.
    }
  }
  return { expired: rows.length, objectsCleared }
}

export async function cleanupSharedReceiptsForAccount(
  userId: string,
  deps: {
    listObjects: (userId: string) => Promise<string[]>
    removeObjects: (paths: string[]) => Promise<void>
    deleteReceipts: (userId: string) => Promise<void>
    deleteDeviceTokens: (userId: string) => Promise<void>
  },
) {
  const paths = await deps.listObjects(userId)
  if (paths.length > 0) await deps.removeObjects(paths)
  await deps.deleteReceipts(userId)
  await deps.deleteDeviceTokens(userId)
}
