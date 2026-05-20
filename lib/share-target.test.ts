import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  SHARE_TARGET_FOCUS_KEY,
  SHARE_TARGET_STORAGE_KEY,
  buildShareTargetCacheUrl,
  clearPendingSharedReceipt,
  consumeShareTargetFocusRequest,
  hydratePendingSharedReceipt,
  persistPendingSharedReceipt,
  readPendingSharedReceipt,
  readSharedReceiptFile,
  requestShareTargetFocus,
} from './share-target'

type StoredResponse = {
  blob: () => Promise<Blob>
  headers: Headers
}

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  clear() {
    this.values.clear()
  }
}

class MemoryCache {
  private entries = new Map<string, StoredResponse>()

  async match(request: string) {
    return this.entries.get(request) ?? null
  }

  async put(request: string, response: StoredResponse) {
    this.entries.set(request, response)
  }

  async delete(request: string) {
    return this.entries.delete(request)
  }

  async keys() {
    return Array.from(this.entries.keys()).map((url) => ({ url }))
  }
}

describe('share-target helpers', () => {
  const originalWindow = globalThis.window
  const storage = new MemoryStorage()
  const cache = new MemoryCache()

  beforeEach(() => {
    storage.clear()
    ;(globalThis as { window?: Window }).window = {
      localStorage: storage,
      caches: {
        open: async () => cache,
      },
    } as unknown as Window
  })

  afterEach(() => {
    if (originalWindow) {
      ;(globalThis as { window?: Window }).window = originalWindow
    } else {
      delete (globalThis as { window?: Window }).window
    }
  })

  it('builds deterministic cache URLs', () => {
    expect(buildShareTargetCacheUrl('share-123')).toBe('/__share-target/share-123')
  })

  it('persists pending receipt metadata in localStorage', () => {
    persistPendingSharedReceipt({
      id: 'share-123',
      name: 'ticket.png',
      type: 'image/png',
      size: 2048,
      createdAt: '2026-05-19T00:00:00.000Z',
    })

    expect(readPendingSharedReceipt()).toEqual({
      id: 'share-123',
      name: 'ticket.png',
      type: 'image/png',
      size: 2048,
      createdAt: '2026-05-19T00:00:00.000Z',
    })
  })

  it('stores and consumes the focus flag once', () => {
    requestShareTargetFocus()

    expect(storage.getItem(SHARE_TARGET_FOCUS_KEY)).toBe('1')
    expect(consumeShareTargetFocusRequest()).toBe(true)
    expect(consumeShareTargetFocusRequest()).toBe(false)
  })

  it('hydrates a cached shared file into pending receipt metadata', async () => {
    const createdAt = '2026-05-19T12:34:56.000Z'
    await cache.put(buildShareTargetCacheUrl('share-456'), {
      blob: async () => new Blob(['png-bytes'], { type: 'image/png' }),
      headers: new Headers({
        'content-type': 'image/png',
        'x-gota-share-created-at': createdAt,
        'x-gota-share-filename': 'captura.png',
      }),
    })

    await expect(readSharedReceiptFile('share-456')).resolves.toMatchObject({
      name: 'captura.png',
      type: 'image/png',
      size: 9,
      lastModified: Date.parse(createdAt),
    })

    await expect(hydratePendingSharedReceipt('share-456')).resolves.toEqual({
      id: 'share-456',
      name: 'captura.png',
      type: 'image/png',
      size: 9,
      createdAt,
    })

    expect(JSON.parse(storage.getItem(SHARE_TARGET_STORAGE_KEY) ?? 'null')).toEqual({
      id: 'share-456',
      name: 'captura.png',
      type: 'image/png',
      size: 9,
      createdAt,
    })
  })

  it('clears both local metadata and cached file contents', async () => {
    persistPendingSharedReceipt({
      id: 'share-789',
      name: 'captura.png',
      type: 'image/png',
      size: 9,
      createdAt: '2026-05-19T12:34:56.000Z',
    })
    requestShareTargetFocus()
    await cache.put(buildShareTargetCacheUrl('share-789'), {
      blob: async () => new Blob(['png-bytes'], { type: 'image/png' }),
      headers: new Headers({
        'content-type': 'image/png',
      }),
    })

    await clearPendingSharedReceipt('share-789')

    expect(storage.getItem(SHARE_TARGET_STORAGE_KEY)).toBeNull()
    expect(storage.getItem(SHARE_TARGET_FOCUS_KEY)).toBeNull()
    await expect(cache.match(buildShareTargetCacheUrl('share-789'))).resolves.toBeNull()
  })
})
