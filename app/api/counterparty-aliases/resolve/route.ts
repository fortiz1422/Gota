import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ResolveAliasSchema } from '@/lib/counterparty-aliases/schemas'
import { resolveSavedCounterparty } from '@/lib/counterparty-aliases/server'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  const parsed = ResolveAliasSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_alias' }, { status: 400, headers: NO_STORE })
  try {
    const match = await resolveSavedCounterparty(supabase, user.id, parsed.data.alias_value)
    return NextResponse.json({ match }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: 'counterparty_alias_error' }, { status: 500, headers: NO_STORE })
  }
}
