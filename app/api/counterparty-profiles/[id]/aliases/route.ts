import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AliasCreateSchema, aliasErrorResponse } from '@/lib/counterparty-aliases/schemas'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = AliasCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_alias' }, { status: 400 })
  const { id } = await params
  const { data: profile } = await supabase.from('counterparty_profiles')
    .select('id').eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!profile) return NextResponse.json({ error: 'profile_not_found' }, { status: 404 })
  const { data, error } = await supabase.from('counterparty_aliases').insert({
    ...parsed.data,
    profile_id: id,
    user_id: user.id,
  }).select().single()
  if (error) {
    const mapped = aliasErrorResponse(error)
    return NextResponse.json(mapped.body, { status: mapped.status })
  }
  return NextResponse.json(data, { status: 201 })
}
