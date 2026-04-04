import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  const body = await request.json()
  const { period_month, closing_date, due_date, status } = body

  const update: Record<string, unknown> = {}
  if (period_month !== undefined) update.period_month = `${period_month}-01`
  if (closing_date !== undefined) update.closing_date = closing_date
  if (due_date !== undefined) update.due_date = due_date
  if (status !== undefined) update.status = status

  const { data, error } = await supabase
    .from('card_cycles')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(data)
}

