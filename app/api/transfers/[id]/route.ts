import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type TransferUpdateBody = {
  from_account_id: string
  to_account_id: string
  amount_from: number
  amount_to: number
  currency_from: 'ARS' | 'USD'
  currency_to: 'ARS' | 'USD'
  exchange_rate?: number | null
  note?: string | null
  date: string
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = (await request.json()) as TransferUpdateBody
  const {
    from_account_id,
    to_account_id,
    amount_from,
    amount_to,
    currency_from,
    currency_to,
    exchange_rate,
    note,
    date,
  } = body

  if (from_account_id === to_account_id) {
    return NextResponse.json({ error: 'Origen y destino no pueden ser la misma cuenta' }, { status: 400 })
  }

  const { error } = await supabase
    .from('transfers')
    .update({
      from_account_id,
      to_account_id,
      amount_from,
      amount_to,
      currency_from,
      currency_to,
      exchange_rate: exchange_rate ?? null,
      note: note ?? null,
      date,
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { error } = await supabase
    .from('transfers')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
