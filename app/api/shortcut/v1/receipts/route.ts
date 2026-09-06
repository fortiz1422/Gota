import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createReceiptIngestHandler, type ReceiptUpload } from '@/lib/shortcut-receipts/ingest'
import { authorizeDeviceToken, type DeviceTokenRecord } from '@/lib/device-auth/device-token'
import { isShortcutReceiptsEnabled } from '@/lib/shortcut-receipts/feature'
import { parseShortcutReceiptRequest } from '@/lib/shortcut-receipts/request'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const BUCKET = 'shared-receipts-private'
const noStoreHeaders = { 'Cache-Control': 'no-store', Pragma: 'no-cache' }

export async function POST(request: Request) {
  if (!isShortcutReceiptsEnabled(process.env.SHORTCUT_RECEIPTS_ENABLED)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: noStoreHeaders })
  }

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

    const { data: rateLimitAllowed, error: rateLimitError } = await admin.rpc(
      'consume_shared_receipt_rate_limit',
      { p_device_id: authorization.device.id, p_limit: 20, p_window_seconds: 600 },
    )
    if (rateLimitError) throw rateLimitError
    if (rateLimitAllowed !== true) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { ...noStoreHeaders, 'Retry-After': '600' } },
      )
    }

    const parsedRequest = await parseShortcutReceiptRequest(request)
    if (!parsedRequest.ok) {
      return NextResponse.json(
        { error: parsedRequest.error },
        { status: parsedRequest.status, headers: noStoreHeaders },
      )
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

    const result = await handler({
      authorization: request.headers.get('authorization'),
      file: parsedRequest.file as ReceiptUpload,
      sourceAppHint: parsedRequest.sourceAppHint,
    })
    return NextResponse.json(result.body, {
      status: result.status,
      headers: result.headers,
    })
  } catch {
    return NextResponse.json({ error: 'ingest_failed' }, { status: 500, headers: noStoreHeaders })
  }
}
