import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMercadoPagoConnection } from '@/lib/mercadopago/server-repository'

const headers = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' }
const bodySchema = z.object({ accountId: z.string().uuid() }).strict()
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers })
type Admin = {
  from: (table: 'accounts') => { select: (columns: string) => { eq: (column: string, value: string | boolean) => { eq: (column: string, value: string | boolean) => Promise<{ data: Array<{ id: string; name: string; type: string }> | null; error: unknown }> } } }
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: { account_id: string; link_version: number } | null; error: unknown }>
}

export async function GET() {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)
  try {
    const connection = await getMercadoPagoConnection(user.id)
    if (!connection) return json({ error: 'not_found' }, 404)
    const admin = createAdminClient() as unknown as Admin
    const { data, error } = await admin.from('accounts').select('id,name,type').eq('user_id', user.id).eq('archived', false)
    if (error || !data) return json({ error: 'account_link_failed' }, 500)
    return json({ linkedAccountId: connection.linked_account_id, linkedAccountVersion: connection.linked_account_version, accounts: data.filter((account) => account.type === 'digital') })
  } catch { return json({ error: 'account_link_failed' }, 500) }
}

export async function PUT(request: Request) {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)
  let body: z.infer<typeof bodySchema>
  try { body = bodySchema.parse(await request.json()) } catch { return json({ error: 'invalid_account_link' }, 422) }
  try {
    const connection = await getMercadoPagoConnection(user.id)
    if (!connection) return json({ error: 'not_found' }, 404)
    const admin = createAdminClient() as unknown as Admin
    const { data, error } = await admin.rpc('link_mercadopago_connection_account', { p_user_id: user.id, p_connection_id: connection.id, p_account_id: body.accountId })
    if (error || !data) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''
      return json({ error: code === 'P0002' || code === '22023' ? 'invalid_account_link' : 'account_link_failed' }, code === 'P0002' || code === '22023' ? 422 : 500)
    }
    return json({ linkedAccountId: data.account_id, linkedAccountVersion: data.link_version })
  } catch { return json({ error: 'account_link_failed' }, 500) }
}
