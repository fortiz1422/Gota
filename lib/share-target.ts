'use client'

export const SHARE_TARGET_CACHE = 'gota-v1-share-target'
export const SHARE_TARGET_STORAGE_KEY = 'gota.share-target.pending'
export const SHARE_TARGET_FOCUS_KEY = 'gota.share-target.focus'
const SHARE_TARGET_PREFIX = '/__share-target/'

export interface PendingSharedReceipt {
  id: string
  name: string
  type: string
  size: number
  createdAt: string
}

export function buildShareTargetCacheUrl(id: string): string {
  return `/__share-target/${id}`
}

async function clearCachedSharedReceipts(cache: Cache): Promise<void> {
  const requests = await cache.keys()
  await Promise.all(
    requests
      .filter((request) => new URL(request.url).pathname.startsWith(SHARE_TARGET_PREFIX))
      .map((request) => cache.delete(request))
  )
}

export function readPendingSharedReceipt(): PendingSharedReceipt | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(SHARE_TARGET_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PendingSharedReceipt
    if (!parsed?.id) return null
    return parsed
  } catch {
    return null
  }
}

export function persistPendingSharedReceipt(receipt: PendingSharedReceipt): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(SHARE_TARGET_STORAGE_KEY, JSON.stringify(receipt))
  } catch {
    // localStorage failures should not block the share flow.
  }
}

export function requestShareTargetFocus(): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(SHARE_TARGET_FOCUS_KEY, '1')
  } catch {
    // Ignore focus persistence failures.
  }
}

export function consumeShareTargetFocusRequest(): boolean {
  if (typeof window === 'undefined') return false

  try {
    const shouldFocus = window.localStorage.getItem(SHARE_TARGET_FOCUS_KEY) === '1'
    if (shouldFocus) {
      window.localStorage.removeItem(SHARE_TARGET_FOCUS_KEY)
    }
    return shouldFocus
  } catch {
    return false
  }
}

export async function readSharedReceiptFile(id: string): Promise<File | null> {
  if (typeof window === 'undefined' || !('caches' in window)) return null

  const cache = await window.caches.open(SHARE_TARGET_CACHE)
  const response = await cache.match(buildShareTargetCacheUrl(id))
  if (!response) return null

  const blob = await response.blob()
  const type = response.headers.get('content-type') || blob.type || 'application/octet-stream'
  const name = response.headers.get('x-gota-share-filename') || `share-${id}`
  const createdAt = response.headers.get('x-gota-share-created-at')
  const lastModified = createdAt ? Date.parse(createdAt) : Date.now()

  return new File([blob], name, {
    type,
    lastModified: Number.isFinite(lastModified) ? lastModified : Date.now(),
  })
}

export async function hydratePendingSharedReceipt(id: string): Promise<PendingSharedReceipt | null> {
  const file = await readSharedReceiptFile(id)
  if (!file) return null

  const receipt: PendingSharedReceipt = {
    id,
    name: file.name,
    type: file.type,
    size: file.size,
    createdAt: new Date(file.lastModified).toISOString(),
  }

  persistPendingSharedReceipt(receipt)
  return receipt
}

export async function clearPendingSharedReceipt(id?: string): Promise<void> {
  if (typeof window === 'undefined') return

  const targetId = id ?? readPendingSharedReceipt()?.id

  try {
    window.localStorage.removeItem(SHARE_TARGET_STORAGE_KEY)
    window.localStorage.removeItem(SHARE_TARGET_FOCUS_KEY)
  } catch {
    // Ignore localStorage failures.
  }

  if (!('caches' in window)) return

  const cache = await window.caches.open(SHARE_TARGET_CACHE)
  if (!targetId) {
    await clearCachedSharedReceipts(cache)
    return
  }

  await cache.delete(buildShareTargetCacheUrl(targetId))
}
