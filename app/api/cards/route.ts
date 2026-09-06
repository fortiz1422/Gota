import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { parseCardCreate } from '@/lib/cards/input'

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
  const { name, closing_day, due_day, account_id, last_four } = body

  const computedDueDay = due_day ?? (closing_day ? Math.min(closing_day + 10, 31) : 10)

  const { data, error } = await supabase
    .from('cards')
    .insert({
      user_id: user.id,
      name: name.trim(),
      closing_day: closing_day ?? null,
      due_day: computedDueDay,
      account_id: account_id ?? null,
      last_four: last_four ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
