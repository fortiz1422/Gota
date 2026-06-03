import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recomputeGoalStatus } from '@/lib/server/recompute-goal-status'

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

  if (from_account_id === to_account_id && currency_from === currency_to) {
    return NextResponse.json({ error: 'Origen y destino no pueden ser la misma cuenta' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
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
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'No se encontró la transferencia' }, { status: 404 })
  }
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

  const { data: linkedContributions, error: linkedContributionsError } = await supabase
    .from('goal_contributions')
    .select('goal_id')
    .eq('related_transfer_id', id)
    .eq('source_type', 'transfer_linked')
    .eq('user_id', user.id)

  if (linkedContributionsError) {
    return NextResponse.json({ error: linkedContributionsError.message }, { status: 500 })
  }

  const affectedGoalIds = Array.from(
    new Set((linkedContributions ?? []).map((contribution) => contribution.goal_id)),
  )

  const { error: contribError } = await supabase
    .from('goal_contributions')
    .delete()
    .eq('related_transfer_id', id)
    .eq('source_type', 'transfer_linked')
    .eq('user_id', user.id)

  if (contribError) return NextResponse.json({ error: contribError.message }, { status: 500 })

  for (const goalId of affectedGoalIds) {
    await recomputeGoalStatus(supabase, user.id, goalId)
  }

  const { error } = await supabase
    .from('transfers')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
