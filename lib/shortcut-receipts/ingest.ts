import { createHash } from 'node:crypto'
import {
  authorizeDeviceToken,
  type FindDeviceToken,
} from '@/lib/device-auth/device-token'

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024

const noStoreHeaders = { 'Cache-Control': 'no-store', Pragma: 'no-cache' } as const
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'] as const

type AllowedMimeType = (typeof allowedMimeTypes)[number]
type ReceiptStatus = 'received'

type ReceiptSummary = { id: string; status: ReceiptStatus }

export type ReceiptUpload = {
  name: string
  type: string
  size: number
  arrayBuffer(): Promise<ArrayBuffer>
}

export type InsertSharedReceipt = {
  id: string
  user_id: string
  ingest_device_id: string
  status: ReceiptStatus
  source_kind: 'ios_shortcut'
  source_app_hint: string | null
  original_filename: string | null
  mime_type: AllowedMimeType
  byte_size: number
  content_sha256: string
  storage_path: string
}

export type ReceiptIngestDependencies = {
  findDeviceToken: FindDeviceToken
  findDuplicate(userId: string, contentSha256: string): Promise<ReceiptSummary | null>
  upload(path: string, bytes: Uint8Array, mimeType: AllowedMimeType): Promise<void>
  remove(path: string): Promise<void>
  insert(input: InsertSharedReceipt): Promise<ReceiptSummary>
  newId(): string
}

type HandlerResult = {
  status: number
  body: unknown
  headers: typeof noStoreHeaders
}

type IngestInput = {
  authorization: string | null
  file: ReceiptUpload | null
  sourceAppHint: string | null
}

function result(status: number, body: unknown): HandlerResult {
  return { status, body, headers: noStoreHeaders }
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte)
}

export function detectImageMime(bytes: Uint8Array): AllowedMimeType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png'
  }
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  return null
}

function extensionFor(mimeType: AllowedMimeType): string {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/png') return 'png'
  return 'webp'
}

function safeFilename(name: string): string | null {
  const filename = name.split(/[\\/]/).pop()?.trim().slice(0, 255)
  return filename || null
}

function safeSourceAppHint(value: string | null): string | null {
  const hint = value?.trim().slice(0, 120)
  return hint || null
}

export function createReceiptIngestHandler(dependencies: ReceiptIngestDependencies) {
  return async function handleReceiptIngest(input: IngestInput): Promise<HandlerResult> {
    const authorization = await authorizeDeviceToken(
      input.authorization,
      'receipt:write',
      dependencies.findDeviceToken,
    )
    if (authorization.kind !== 'authorized') {
      return result(401, { error: 'unauthorized' })
    }

    const file = input.file
    if (!file || !Number.isSafeInteger(file.size) || file.size <= 0) {
      return result(400, { error: 'invalid_file' })
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      return result(413, { error: 'file_too_large' })
    }
    if (!allowedMimeTypes.includes(file.type as AllowedMimeType)) {
      return result(415, { error: 'unsupported_media_type' })
    }

    let bytes: Uint8Array
    try {
      bytes = new Uint8Array(await file.arrayBuffer())
    } catch {
      return result(400, { error: 'invalid_file' })
    }
    if (bytes.byteLength !== file.size) {
      return result(400, { error: 'invalid_file' })
    }

    const detectedMime = detectImageMime(bytes)
    if (!detectedMime || detectedMime !== file.type) {
      return result(415, { error: 'unsupported_media_type' })
    }

    const userId = authorization.device.userId
    const contentSha256 = createHash('sha256').update(bytes).digest('hex')
    const duplicate = await dependencies.findDuplicate(userId, contentSha256)
    if (duplicate) {
      return result(200, { status: 'duplicate', receipt_id: duplicate.id })
    }

    const receiptId = dependencies.newId()
    const storagePath = `${userId}/${receiptId}.${extensionFor(detectedMime)}`
    try {
      await dependencies.upload(storagePath, bytes, detectedMime)
    } catch {
      return result(503, { error: 'storage_unavailable' })
    }

    try {
      const receipt = await dependencies.insert({
        id: receiptId,
        user_id: userId,
        ingest_device_id: authorization.device.id,
        status: 'received',
        source_kind: 'ios_shortcut',
        source_app_hint: safeSourceAppHint(input.sourceAppHint),
        original_filename: safeFilename(file.name),
        mime_type: detectedMime,
        byte_size: bytes.byteLength,
        content_sha256: contentSha256,
        storage_path: storagePath,
      })
      return result(201, { status: 'accepted', receipt_id: receipt.id })
    } catch {
      try {
        await dependencies.remove(storagePath)
      } catch {
        // Best-effort compensation: never expose storage internals to the caller.
      }
      const racedDuplicate = await dependencies.findDuplicate(userId, contentSha256)
      if (racedDuplicate) {
        return result(200, { status: 'duplicate', receipt_id: racedDuplicate.id })
      }
      return result(500, { error: 'ingest_failed' })
    }
  }
}
