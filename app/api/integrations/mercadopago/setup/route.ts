import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getMercadoPagoConnection } from '@/lib/mercadopago/server-repository'
import { backgroundDatabase, mercadoPagoBackgroundEnabled } from '@/lib/mercadopago/sync-lease'
import { INITIAL_IMPORT_PRESETS } from '@/lib/mercadopago/initial-import'

const headers = { 'Cache-Control': 'private, no-store' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers })
const schema = z.union([z.object({ preset: z.enum(INITIAL_IMPORT_PRESETS) }).strict(), z.object({ resume: z.literal(true) }).strict()])
async function userId() {
  const session = await createClient()
  return (await session.auth.getUser()).data.user?.id ?? null
}

export async function GET() {
  const id = await userId()
  if (!id) return json({ error: 'unauthorized' }, 401)
  if (!mercadoPagoBackgroundEnabled()) return json({ available: false })
  try {
    const connection = await getMercadoPagoConnection(id)
    if (!connection) return json({ available: true, state: 'not_connected', mode: 'shadow' })
    const admin = backgroundDatabase()
    const { data, error } = await admin.from('mercadopago_connections')
      .select('background_sync_enabled,initial_import_status,initial_import_preset,initial_import_started_at,initial_import_completed_at,last_incremental_success_at,last_incremental_attempt_at')
      .eq('id', connection.id).eq('user_id', id).single()
    if (error || !data) throw new Error('setup_read_failed')
    let accountName: string | null = null
    if (connection.linked_account_id) {
      const account = await admin.from('accounts').select('name').eq('id', connection.linked_account_id).eq('user_id', id).eq('archived', false).maybeSingle()
      if (account.error) throw new Error('account_read_failed')
      accountName = account.data?.name ?? null
    }
    return json({ available: true, state: connection.status === 'revoked' || connection.status === 'expired' || !connection.access_token_ciphertext ? 'needs_reconnect' : 'connected', mode: 'shadow', enabled: data.background_sync_enabled,
      initialImport: { status: data.initial_import_status, preset: data.initial_import_preset, startedAt: data.initial_import_started_at, completedAt: data.initial_import_completed_at },
      lastUpdateAt: data.last_incremental_success_at, lastAttemptAt: data.last_incremental_attempt_at, accountName })
  } catch { return json({ error: 'setup_unavailable' }, 503) }
}

export async function POST(request: Request) {
  const id = await userId()
  if (!id) return json({ error: 'unauthorized' }, 401)
  if (!mercadoPagoBackgroundEnabled()) return json({ error: 'setup_disabled' }, 503)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: 'invalid_initial_import' }, 422)
  try {
    const connection = await getMercadoPagoConnection(id)
    if (!connection) return json({ error: 'not_connected' }, 409)
    const resuming = 'resume' in parsed.data
    const { data, error } = await backgroundDatabase().rpc(resuming ? 'mercadopago_resume_sync' : 'mercadopago_start_initial_import', { p_user_id: id, p_connection_id: connection.id, ...('preset' in parsed.data ? { p_preset: parsed.data.preset } : {}) })
    if (error || !data) {
      const known = ['account_ambiguous', 'sync_busy', 'initial_import_already_started', 'initial_import_stopped', 'invalid_linked_account', 'not_connected']
      const reason = known.find(code => error?.message.includes(code))
      return json({ error: reason ?? 'setup_failed' }, reason ? 409 : 502)
    }
    return json({ state: 'queued', mode: 'shadow' }, 202)
  } catch { return json({ error: 'setup_failed' }, 502) }
}

export async function DELETE() {
  const id = await userId()
  if (!id) return json({ error: 'unauthorized' }, 401)
  if (!mercadoPagoBackgroundEnabled()) return json({ error: 'setup_disabled' }, 503)
  try {
    const connection = await getMercadoPagoConnection(id)
    if (!connection) return json({ state: 'disconnected' })
    const { data, error } = await backgroundDatabase().rpc('mercadopago_disconnect', { p_user_id: id, p_connection_id: connection.id })
    if (error || data !== true) throw new Error('disconnect_failed')
    return json({ state: 'disconnected' })
  } catch { return json({ error: 'disconnect_failed' }, 502) }
}
