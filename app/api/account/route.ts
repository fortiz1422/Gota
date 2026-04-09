import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = user.id

  // Delete all user data (RLS scoped to user_id)
  await Promise.all([
    supabase.from('subscription_insertions').delete().eq('user_id', userId),
    supabase.from('yield_accumulator').delete().eq('user_id', userId),
    supabase.from('recurring_incomes').delete().eq('user_id', userId),
    supabase.from('income_entries').delete().eq('user_id', userId),
    supabase.from('transfers').delete().eq('user_id', userId),
    supabase.from('instruments').delete().eq('user_id', userId),
    supabase.from('account_period_balance').delete().eq('user_id', userId),
    supabase.from('subscriptions').delete().eq('user_id', userId),
    supabase.from('cards').delete().eq('user_id', userId),
    supabase.from('accounts').delete().eq('user_id', userId),
    supabase.from('expenses').delete().eq('user_id', userId),
    supabase.from('monthly_income').delete().eq('user_id', userId),
    supabase.from('user_config').delete().eq('user_id', userId),
  ])

  // Delete auth user (requires service role)
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: 'Error al eliminar la cuenta' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
