import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ProfileCreateSchema } from '@/lib/counterparty-aliases/schemas'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })

  const [{ data: profiles, error: profileError }, { data: aliases, error: aliasError }] = await Promise.all([
    supabase.from('counterparty_profiles').select('*').eq('user_id', user.id).order('display_name'),
    supabase.from('counterparty_aliases').select('*').eq('user_id', user.id).order('alias_value'),
  ])
  if (profileError || aliasError) {
    return NextResponse.json({ error: 'counterparty_profiles_unavailable' }, { status: 500, headers: NO_STORE })
  }
  return NextResponse.json({
    profiles: (profiles ?? []).map((profile) => ({
      ...profile,
      aliases: (aliases ?? []).filter((alias) => alias.profile_id === profile.id),
    })),
  }, { headers: NO_STORE })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = ProfileCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_profile' }, { status: 400 })
  const { data, error } = await supabase.from('counterparty_profiles')
    .insert({ ...parsed.data, user_id: user.id }).select().single()
  if (error) return NextResponse.json({ error: 'counterparty_profile_error' }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
