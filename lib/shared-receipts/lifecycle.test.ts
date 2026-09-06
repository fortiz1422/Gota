import { describe, expect, it, vi } from 'vitest'
import { cleanupExpiredSharedReceipts, cleanupSharedReceiptsForAccount } from './lifecycle'

describe('shared receipt lifecycle cleanup', () => {
  it('expires eligible rows first, clears paths, and best-effort deletes each private object', async () => {
    const calls: string[] = []
    const result = await cleanupExpiredSharedReceipts('2026-09-06T12:00:00.000Z', {
      expireRows: async (now, statuses) => {
        calls.push(`expire:${now}:${statuses.join(',')}`)
        return [{ id: 'r1', storage_path: 'u/r1.jpg' }, { id: 'r2', storage_path: null }]
      },
      clearStoragePath: async (id, path) => {
        calls.push(`clear:${id}:${path}`)
        return true
      },
      removeObject: async (path) => {
        calls.push(`remove:${path}`)
        throw new Error('best effort')
      },
    })
    expect(result).toEqual({ expired: 2, objectsCleared: 1 })
    expect(calls).toEqual([
      'expire:2026-09-06T12:00:00.000Z:received,needs_review,parse_failed',
      'clear:r1:u/r1.jpg',
      'remove:u/r1.jpg',
    ])
  })

  it('removes account-owned private objects before deleting durable rows and tokens', async () => {
    const calls: string[] = []
    await cleanupSharedReceiptsForAccount('user-1', {
      listObjects: async (owner) => {
        calls.push(`list:${owner}`)
        return ['user-1/a.jpg', 'user-1/b.jpg']
      },
      removeObjects: async (paths) => { calls.push(`objects:${paths.join(',')}`) },
      deleteReceipts: async (owner) => { calls.push(`receipts:${owner}`) },
      deleteDeviceTokens: async (owner) => { calls.push(`tokens:${owner}`) },
    })
    expect(calls).toEqual([
      'list:user-1',
      'objects:user-1/a.jpg,user-1/b.jpg',
      'receipts:user-1',
      'tokens:user-1',
    ])
  })

  it('does not delete account rows when private object cleanup fails', async () => {
    const deleteReceipts = vi.fn()
    await expect(cleanupSharedReceiptsForAccount('user-1', {
      listObjects: async () => ['user-1/a.jpg'],
      removeObjects: async () => { throw new Error('storage failed') },
      deleteReceipts,
      deleteDeviceTokens: vi.fn(),
    })).rejects.toThrow('storage failed')
    expect(deleteReceipts).not.toHaveBeenCalled()
  })
})
