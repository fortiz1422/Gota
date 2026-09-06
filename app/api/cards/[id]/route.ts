import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { CardUpdate } from '@/types/database'
import { ZodError } from 'zod'
import { parseCardUpdate } from '@/lib/cards/input'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body
  try {
    body = parseCardUpdate(await request.json())
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: 'Invalid card data' }, { status: 400 })
    throw error
  }
  const { name, closing_day, due_day, account_id, last_four, archived } = body

  const update: CardUpdate = {}
  if (name !== undefined) update.name = name.trim()
  if (closing_day !== undefined) update.closing_day = closing_day
  if (due_day !== undefined) update.due_day = due_day
  if (account_id !== undefined) update.account_id = account_id
  if (last_four !== undefined) update.last_four = last_four
  if (archived !== undefined) update.archived = archived

  const { data, error } = await supabase
    .from('cards')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check if card has expenses — soft delete if so
  const { count } = await supabase
    .from('expenses')
    .select('id', { count: 'exact', head: true })
    .eq('card_id', id)
    .eq('user_id', user.id)

  if (count && count > 0) {
    const { error } = await supabase
      .from('cards')
      .update({ archived: true })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ archived: true })
  }

  const { error } = await supabase
    .from('cards')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
