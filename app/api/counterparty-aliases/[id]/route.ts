import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AliasPatchSchema, aliasErrorResponse } from '@/lib/counterparty-aliases/schemas'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = AliasPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_alias' }, { status: 400 })
  if (parsed.data.profile_id) {
    const { data: profile } = await supabase.from('counterparty_profiles')
      .select('id').eq('id', parsed.data.profile_id).eq('user_id', user.id).maybeSingle()
    if (!profile) return NextResponse.json({ error: 'profile_not_found' }, { status: 404 })
  }
  const { id } = await params
  const { data, error } = await supabase.from('counterparty_aliases')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', user.id).select().maybeSingle()
  if (error) {
    const mapped = aliasErrorResponse(error)
    return NextResponse.json(mapped.body, { status: mapped.status })
  }
  if (!data) return NextResponse.json({ error: 'alias_not_found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { data, error } = await supabase.from('counterparty_aliases')
    .delete().eq('id', id).eq('user_id', user.id).select('id').maybeSingle()
  if (error) return NextResponse.json({ error: 'counterparty_alias_error' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'alias_not_found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
