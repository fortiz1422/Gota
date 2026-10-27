import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hashDeviceToken, type DeviceTokenRecord } from '@/lib/device-auth/device-token'
import { MAX_RECEIPT_BYTES } from './ingest'

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  after: vi.fn(),
  preanalyze: vi.fn(),
}))

vi.mock('next/server', async (original) => ({
  ...(await original<typeof import('next/server')>()),
  after: mocks.after,
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.admin }))
vi.mock('@/lib/shared-receipts/preanalyze', () => ({
  preanalyzeReceivedReceipt: mocks.preanalyze,
}))

import { POST } from '@/app/api/shortcut/v1/receipts/route'

const RAW_TOKEN = 'gota_sr_v1_test_token_for_receipt_ingestion'
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])

function deviceRow(): DeviceTokenRecord {
  return {
    id: 'device-1',
    userId: 'user-1',
    label: 'iPhone',
    tokenHash: hashDeviceToken(RAW_TOKEN),
    tokenPrefix: RAW_TOKEN.slice(0, 20),
    scopes: ['receipt:write'],
    revokedAt: null,
    expiresAt: '2099-01-01T00:00:00.000Z',
  }
}

type AdminOptions = {
  token?: DeviceTokenRecord | null
  rateLimitAllowed?: boolean
  duplicate?: { id: string; status: string } | null
}

function setupAdmin(options: AdminOptions = {}) {
  const token = options.token === undefined ? deviceRow() : options.token
  const rateLimitAllowed = options.rateLimitAllowed ?? true
  const duplicate = options.duplicate ?? null
  const upload = vi.fn(async () => ({ error: null }))
  const remove = vi.fn(async () => ({ error: null }))
  const insert = vi.fn(async () => ({ data: { id: 'receipt-new' }, error: null }))

  const from = vi.fn((table: string) => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn(async () => insert()),
      maybeSingle: vi.fn(async () => {
        if (table === 'device_access_tokens') {
          return {
            data: token
              ? {
                  id: token.id,
                  user_id: token.userId,
                  label: token.label,
                  token_hash: token.tokenHash,
                  token_prefix: token.tokenPrefix,
                  scopes: token.scopes,
                  revoked_at: token.revokedAt,
                  expires_at: token.expiresAt,
                }
              : null,
            error: null,
          }
        }
        if (table === 'shared_receipts') {
          return { data: duplicate, error: null }
        }
        return { data: null, error: null }
      }),
    }
    return chain
  })

  const rpc = vi.fn(async (name: string) => {
    if (name === 'consume_shared_receipt_rate_limit') {
      return { data: rateLimitAllowed, error: null }
    }
    return { data: null, error: null }
  })

  mocks.admin.mockReturnValue({
    from,
    rpc,
    storage: {
      from: vi.fn(() => ({
        upload,
        remove,
      })),
    },
  })

  return { upload, remove, insert, rpc }
}

function multipartRequest(file: Blob, authorization = `Bearer ${RAW_TOKEN}`) {
  const form = new FormData()
  form.set('file', file, 'ticket.png')
  return new Request('https://gota.test/api/shortcut/v1/receipts', {
    method: 'POST',
    headers: { Authorization: authorization },
    body: form,
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('SHORTCUT_RECEIPTS_ENABLED', 'true')
  mocks.preanalyze.mockResolvedValue(undefined)
})

describe('shortcut receipt ingest route contract', () => {
  it('accepts a valid image upload', async () => {
    setupAdmin()
    const response = await POST(
      multipartRequest(new Blob([png], { type: 'image/png' })),
    )

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({
      status: 'accepted',
      receipt_id: expect.any(String),
      message: 'Comprobante recibido. Ya está disponible en Gota.',
    })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(mocks.after).toHaveBeenCalledOnce()
  })

  it('returns duplicate without uploading again', async () => {
    setupAdmin({ duplicate: { id: 'existing-1', status: 'received' } })
    const response = await POST(
      multipartRequest(new Blob([png], { type: 'image/png' })),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: 'duplicate',
      receipt_id: 'existing-1',
      message: 'Este comprobante ya estaba cargado en Gota.',
    })
  })

  it('returns 401 with actionable copy when the device token is unknown', async () => {
    setupAdmin({ token: null })
    const response = await POST(
      multipartRequest(new Blob([png], { type: 'image/png' }), 'Bearer unknown-token'),
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: 'unauthorized',
      message:
        'No pudimos autenticar este Atajo. Creá un token nuevo en Ajustes → Conexiones → Dispositivos.',
    })
  })

  it('returns 413 when the declared payload exceeds the upload limit', async () => {
    setupAdmin()
    const response = await POST(
      new Request('https://gota.test/api/shortcut/v1/receipts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RAW_TOKEN}`,
          'Content-Type': 'image/png',
          'Content-Length': String(MAX_RECEIPT_BYTES + 1),
        },
        body: png,
      }),
    )

    expect(response.status).toBe(413)
    expect(await response.json()).toMatchObject({
      error: 'file_too_large',
      message: 'La imagen supera el límite de 10 MB.',
    })
  })

  it('returns 429 when the per-device rate limit is exhausted', async () => {
    setupAdmin({ rateLimitAllowed: false })
    const response = await POST(
      multipartRequest(new Blob([png], { type: 'image/png' })),
    )

    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({
      error: 'rate_limited',
      message: 'Demasiados envíos. Esperá unos minutos y volvé a intentar.',
    })
    expect(response.headers.get('Retry-After')).toBe('600')
  })
})
