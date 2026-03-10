import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const includeArchived = searchParams.get('include_archived') === 'true'

  let query = supabase
    .from('accounts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (!includeArchived) {
    query = query.eq('archived', false)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, type, opening_balance_ars = 0, opening_balance_usd = 0, is_primary = false } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (!['bank', 'cash', 'digital'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  // If setting as primary, unset current primary first
  if (is_primary) {
    await supabase
      .from('accounts')
      .update({ is_primary: false })
      .eq('user_id', user.id)
      .eq('is_primary', true)
  }

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      user_id: user.id,
      name: name.trim(),
      type,
      is_primary,
      opening_balance_ars: Number(opening_balance_ars) || 0,
      opening_balance_usd: Number(opening_balance_usd) || 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
