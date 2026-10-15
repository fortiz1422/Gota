import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { parseCardCreate } from '@/lib/cards/input'
import { cardInsertPayload } from '@/lib/cards/persist'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('user_id', user.id)
    .eq('archived', false)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try {
    body = parseCardCreate(await request.json())
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: 'Invalid card data' }, { status: 400 })
    throw error
  }
  const { data, error } = await supabase
    .from('cards')
    .insert(cardInsertPayload(user.id, body))
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
