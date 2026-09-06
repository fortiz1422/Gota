import { NextResponse } from 'next/server'
import { createDeviceHandlers, createSupabaseShortcutDeviceStore } from '@/lib/shortcut-receipts/device-store'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const noStoreHeaders = { 'Cache-Control': 'no-store', Pragma: 'no-cache' }

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { id } = await params
    const handlers = createDeviceHandlers(createSupabaseShortcutDeviceStore(createAdminClient()))
    const result = await handlers.revoke(user?.id ?? null, id)
    if (result.status === 204) {
      return new NextResponse(null, { status: 204, headers: result.headers })
    }
    return NextResponse.json(result.body, { status: result.status, headers: result.headers })
  } catch {
    return NextResponse.json({ error: 'device_revoke_failed' }, { status: 500, headers: noStoreHeaders })
  }
}
