import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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
  const { name, opening_balance_ars, opening_balance_usd, is_primary, archived } = body

  const update: Record<string, unknown> = {}
  if (name !== undefined) update.name = name.trim()
  if (opening_balance_ars !== undefined) update.opening_balance_ars = Number(opening_balance_ars) || 0
  if (opening_balance_usd !== undefined) update.opening_balance_usd = Number(opening_balance_usd) || 0
  if (archived !== undefined) update.archived = archived
  if (is_primary !== undefined) update.is_primary = is_primary

  // If setting as primary, unset current primary first
  if (is_primary === true) {
    await supabase
      .from('accounts')
      .update({ is_primary: false })
      .eq('user_id', user.id)
      .eq('is_primary', true)
      .neq('id', id)
  }

  const { data, error } = await supabase
    .from('accounts')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Sync opening balance to account_period_balance for the current month
  // so get_dashboard_data can reflect it in saldo_vivo
  if (opening_balance_ars !== undefined || opening_balance_usd !== undefined) {
    const now = new Date()
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    await supabase.from('account_period_balance').upsert(
      {
        account_id: id,
        period,
        balance_ars: Number(opening_balance_ars) || 0,
        balance_usd: Number(opening_balance_usd) || 0,
        source: 'opening',
        updated_at: now.toISOString(),
      },
      { onConflict: 'account_id,period', ignoreDuplicates: false },
    )
  }

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

  // Check if account has expenses — soft delete (archive) instead of hard delete
  const { count } = await supabase
    .from('expenses')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', id)
    .eq('user_id', user.id)

  if (count && count > 0) {
    // Soft delete
    const { error } = await supabase
      .from('accounts')
      .update({ archived: true })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ archived: true })
  }

  // Hard delete if no expenses linked
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
