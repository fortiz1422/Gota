import { describe, expect, it, vi } from 'vitest'
import { hashDeviceToken, type DeviceTokenRecord } from '@/lib/device-auth/device-token'
import {
  createReceiptIngestHandler,
  detectImageMime,
  MAX_RECEIPT_BYTES,
  type ReceiptIngestDependencies,
  type ReceiptUpload,
} from './ingest'

const RAW_TOKEN = 'gota_sr_v1_test_token_for_receipt_ingestion'

function activeToken(overrides: Partial<DeviceTokenRecord> = {}): DeviceTokenRecord {
  return {
    id: 'device-1',
    userId: 'user-1',
    label: 'iPhone',
    tokenHash: hashDeviceToken(RAW_TOKEN),
    tokenPrefix: RAW_TOKEN.slice(0, 20),
    scopes: ['receipt:write'],
    revokedAt: null,
    expiresAt: '2099-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function upload(bytes: Uint8Array, type = 'image/png', name = 'ticket.png'): ReceiptUpload {
  return {
    name,
    type,
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.slice().buffer,
  }
}

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])

function dependencies(overrides: Partial<ReceiptIngestDependencies> = {}): ReceiptIngestDependencies {
  return {
    findDeviceToken: async () => activeToken(),
    findDuplicate: async () => null,
    upload: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    insert: vi.fn(async (input) => ({ id: input.id, status: 'received' as const })),
    newId: () => 'receipt-1',
    ...overrides,
  }
}

async function ingest(
  overrides: Partial<Parameters<ReturnType<typeof createReceiptIngestHandler>>[0]> = {},
  deps = dependencies(),
) {
  return createReceiptIngestHandler(deps)({
    authorization: `Bearer ${RAW_TOKEN}`,
    file: upload(png),
    sourceAppHint: null,
    ...overrides,
  })
}

describe('receipt ingestion authorization', () => {
  it.each([
    ['missing bearer', null, activeToken()],
    ['revoked token', `Bearer ${RAW_TOKEN}`, activeToken({ revokedAt: '2026-09-01T00:00:00Z' })],
    ['expired token', `Bearer ${RAW_TOKEN}`, activeToken({ expiresAt: '2020-01-01T00:00:00Z' })],
    ['wrong scope', `Bearer ${RAW_TOKEN}`, activeToken({ scopes: ['dashboard:read'] })],
  ])('rejects %s before touching storage', async (_case, authorization, record) => {
    const deps = dependencies({ findDeviceToken: async () => record })
    const result = await ingest({ authorization }, deps)

    expect(result.status).toBe(401)
    expect(deps.upload).not.toHaveBeenCalled()
    expect(result.headers['Cache-Control']).toBe('no-store')
  })
})

describe('receipt image validation', () => {
  it('rejects unsupported MIME types', async () => {
    const result = await ingest({ file: upload(png, 'application/pdf', 'ticket.pdf') })
    expect(result).toMatchObject({ status: 415, body: { error: 'unsupported_media_type' } })
  })

  it('rejects files larger than 10 MiB before reading bytes', async () => {
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(0))
    const result = await ingest({
      file: { name: 'huge.jpg', type: 'image/jpeg', size: MAX_RECEIPT_BYTES + 1, arrayBuffer },
    })
    expect(result.status).toBe(413)
    expect(arrayBuffer).not.toHaveBeenCalled()
  })

  it('rejects a declared image whose magic bytes do not match', async () => {
    const result = await ingest({ file: upload(new Uint8Array([1, 2, 3]), 'image/png') })
    expect(result).toMatchObject({ status: 415, body: { error: 'unsupported_media_type' } })
  })

  it('recognizes JPEG, PNG, and WebP signatures', () => {
    expect(detectImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg')
    expect(detectImageMime(png)).toBe('image/png')
    expect(detectImageMime(new Uint8Array([0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50]))).toBe('image/webp')
  })
})

describe('receipt ingestion persistence', () => {
  it('returns an owner-scoped duplicate without uploading', async () => {
    const findDuplicate = vi.fn(async () => ({ id: 'existing-1', status: 'received' as const }))
    const deps = dependencies({ findDuplicate })
    const result = await ingest({}, deps)

    expect(result).toMatchObject({ status: 200, body: { status: 'duplicate', receipt_id: 'existing-1' } })
    expect(findDuplicate).toHaveBeenCalledWith('user-1', expect.stringMatching(/^[a-f0-9]{64}$/))
    expect(deps.upload).not.toHaveBeenCalled()
  })

  it('does not insert when private storage upload fails', async () => {
    const deps = dependencies({ upload: vi.fn(async () => { throw new Error('storage down') }) })
    const result = await ingest({}, deps)

    expect(result.status).toBe(503)
    expect(deps.insert).not.toHaveBeenCalled()
  })

  it('removes the private object when row insertion fails', async () => {
    const deps = dependencies({ insert: vi.fn(async () => { throw new Error('db down') }) })
    const result = await ingest({}, deps)

    expect(result.status).toBe(500)
    expect(deps.remove).toHaveBeenCalledWith('user-1/receipt-1.png')
  })

  it('accepts one valid image without accepting a user id', async () => {
    const deps = dependencies()
    const result = await ingest({ sourceAppHint: 'Atajos' }, deps)

    expect(result).toMatchObject({
      status: 201,
      body: { status: 'accepted', receipt_id: 'receipt-1' },
    })
    expect(deps.upload).toHaveBeenCalledWith('user-1/receipt-1.png', expect.any(Uint8Array), 'image/png')
    expect(deps.insert).toHaveBeenCalledWith(expect.objectContaining({
      id: 'receipt-1',
      user_id: 'user-1',
      ingest_device_id: 'device-1',
      status: 'received',
      content_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      storage_path: 'user-1/receipt-1.png',
      source_app_hint: 'Atajos',
    }))
  })
})
