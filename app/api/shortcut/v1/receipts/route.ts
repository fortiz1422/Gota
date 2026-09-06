import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createReceiptIngestHandler, type ReceiptUpload } from '@/lib/shortcut-receipts/ingest'
import { authorizeDeviceToken, type DeviceTokenRecord } from '@/lib/device-auth/device-token'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BUCKET = 'shared-receipts-private'
const noStoreHeaders = { 'Cache-Control': 'no-store', Pragma: 'no-cache' }

function isUpload(value: FormDataEntryValue): value is File {
  return typeof value !== 'string'
}

export async function POST(request: Request) {
  try {
    const admin = createAdminClient()
    let resolvedToken: DeviceTokenRecord | null = null
    const authorization = await authorizeDeviceToken(
      request.headers.get('authorization'),
      'receipt:write',
      async (prefix, hash) => {
        const { data, error } = await admin
          .from('device_access_tokens')
          .select('id, user_id, label, token_hash, token_prefix, scopes, revoked_at, expires_at')
          .eq('token_prefix', prefix)
          .eq('token_hash', hash)
          .is('revoked_at', null)
          .maybeSingle()
        if (error) throw error
        if (!data) return null
        resolvedToken = {
          id: data.id,
          userId: data.user_id,
          label: data.label,
          tokenHash: data.token_hash,
          tokenPrefix: data.token_prefix,
          scopes: data.scopes,
          revokedAt: data.revoked_at,
          expiresAt: data.expires_at,
        }
        return resolvedToken
      },
    )
    if (authorization.kind !== 'authorized' || !resolvedToken) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: noStoreHeaders })
    }

    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
      return NextResponse.json(
        { error: 'unsupported_media_type' },
        { status: 415, headers: noStoreHeaders },
      )
    }

    let form: FormData
    try {
      form = await request.formData()
    } catch {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400, headers: noStoreHeaders })
    }
    const uploads = Array.from(form.values()).filter(isUpload)
    const file = form.get('file')
    if (uploads.length !== 1 || !file || !isUpload(file)) {
      return NextResponse.json({ error: 'one_file_required' }, { status: 400, headers: noStoreHeaders })
    }

    const handler = createReceiptIngestHandler({
      findDeviceToken: async () => resolvedToken,
      async findDuplicate(userId, contentSha256) {
        const { data, error } = await admin
          .from('shared_receipts')
          .select('id')
          .eq('user_id', userId)
          .eq('content_sha256', contentSha256)
          .maybeSingle()
        if (error) throw error
        return data ? { id: data.id, status: 'received' as const } : null
      },
      async upload(path, bytes, mimeType) {
        const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
          contentType: mimeType,
          upsert: false,
        })
        if (error) throw error
      },
      async remove(path) {
        const { error } = await admin.storage.from(BUCKET).remove([path])
        if (error) throw error
      },
      async insert(input) {
        const { data, error } = await admin
          .from('shared_receipts')
          .insert(input as never)
          .select('id')
          .single()
        if (error) throw error
        return { id: data.id, status: 'received' as const }
      },
      newId: randomUUID,
    })

    const sourceAppHint = form.get('source_app_hint')
    const result = await handler({
      authorization: request.headers.get('authorization'),
      file: file as ReceiptUpload,
      sourceAppHint: typeof sourceAppHint === 'string' ? sourceAppHint : null,
    })
    return NextResponse.json(result.body, {
      status: result.status,
      headers: result.headers,
    })
  } catch {
    return NextResponse.json({ error: 'ingest_failed' }, { status: 500, headers: noStoreHeaders })
  }
}
