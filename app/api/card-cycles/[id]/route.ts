import { NextResponse } from 'next/server'
import { isValidCycleDateRange } from '@/lib/card-cycles'
import { createClient } from '@/lib/supabase/server'
import type { CardCycleUpdate } from '@/types/database'

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
  const { period_month, closing_date, due_date, status, amount_paid, paid_at, amount_draft, dates_confirmed_at } = body

  if (closing_date !== undefined && due_date !== undefined && !isValidCycleDateRange(closing_date, due_date)) {
    return NextResponse.json({ error: 'due_date must be on or after closing_date' }, { status: 400 })
  }

  const update: CardCycleUpdate = {}
  if (period_month !== undefined) update.period_month = `${period_month}-01`
  if (closing_date !== undefined) update.closing_date = closing_date
  if (due_date !== undefined) update.due_date = due_date
  if (status !== undefined) update.status = status
  if (amount_paid !== undefined) update.amount_paid = amount_paid
  if (paid_at !== undefined) update.paid_at = paid_at
  if (amount_draft !== undefined) update.amount_draft = amount_draft
  if (dates_confirmed_at !== undefined) update.dates_confirmed_at = dates_confirmed_at

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
