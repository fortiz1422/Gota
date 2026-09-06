import { NextResponse } from 'next/server'
import { createDeviceHandlers, createSupabaseShortcutDeviceStore } from '@/lib/shortcut-receipts/device-store'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const noStoreHeaders = { 'Cache-Control': 'no-store', Pragma: 'no-cache' }

function toResponse(result: Awaited<ReturnType<ReturnType<typeof createDeviceHandlers>['list']>>) {
  return NextResponse.json(result.body, { status: result.status, headers: result.headers })
}

async function authenticatedUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function GET() {
  try {
    const handlers = createDeviceHandlers(createSupabaseShortcutDeviceStore(createAdminClient()))
    return toResponse(await handlers.list(await authenticatedUserId()))
  } catch {
    return NextResponse.json({ error: 'device_list_failed' }, { status: 500, headers: noStoreHeaders })
  }
}

export async function POST(request: Request) {
  try {
    const userId = await authenticatedUserId()
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400, headers: noStoreHeaders })
    }
    const handlers = createDeviceHandlers(createSupabaseShortcutDeviceStore(createAdminClient()))
    return toResponse(await handlers.create(userId, body, new URL(request.url).origin))
  } catch {
    return NextResponse.json({ error: 'device_create_failed' }, { status: 500, headers: noStoreHeaders })
  }
}
