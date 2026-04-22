import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type DeleteResult = {
  error: { code?: string; message: string } | null
}

function isMissingTableError(error: { code?: string; message: string }): boolean {
  return error.code === '42P01' || error.message.toLowerCase().includes('does not exist')
}

async function runDelete(
  label: string,
  action: () => PromiseLike<DeleteResult>,
  options: { allowMissingTable?: boolean } = {},
) {
  const { error } = await action()
  if (error) {
    if (options.allowMissingTable && isMissingTableError(error)) return
    throw new Error(`${label}: ${error.message}`)
  }
}

function getIds(rows: Array<{ id: string }> | null): string[] {
  return (rows ?? []).map((row) => row.id)
}

export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: 'Falta configurar credenciales server-side para borrar la cuenta' },
      { status: 500 },
    )
  }

  const userId = user.id
  const admin = createAdminClient()

  try {
    const [
      { data: subscriptions, error: subscriptionsError },
      { data: expenses, error: expensesError },
      { data: accounts, error: accountsError },
    ] = await Promise.all([
      admin.from('subscriptions').select('id').eq('user_id', userId),
      admin.from('expenses').select('id').eq('user_id', userId),
      admin.from('accounts').select('id').eq('user_id', userId),
    ])

    if (subscriptionsError) throw new Error(`subscriptions lookup: ${subscriptionsError.message}`)
    if (expensesError) throw new Error(`expenses lookup: ${expensesError.message}`)
    if (accountsError) throw new Error(`accounts lookup: ${accountsError.message}`)

    const subscriptionIds = getIds(subscriptions)
    const expenseIds = getIds(expenses)
    const accountIds = getIds(accounts)

    await runDelete('product_events', () =>
      admin.from('product_events').delete().eq('user_id', userId),
      { allowMissingTable: true },
    )

    if (subscriptionIds.length > 0) {
      await runDelete('subscription_insertions by subscription', () =>
        admin.from('subscription_insertions').delete().in('subscription_id', subscriptionIds),
        { allowMissingTable: true },
      )
    }

    if (expenseIds.length > 0) {
      await runDelete('subscription_insertions by expense', () =>
        admin.from('subscription_insertions').delete().in('expense_id', expenseIds),
        { allowMissingTable: true },
      )
    }

    if (accountIds.length > 0) {
      await runDelete('account_period_balance', () =>
        admin.from('account_period_balance').delete().in('account_id', accountIds),
      )
    }

    await runDelete('yield_accumulator', () =>
      admin.from('yield_accumulator').delete().eq('user_id', userId),
    )
    await runDelete('recurring_incomes', () =>
      admin.from('recurring_incomes').delete().eq('user_id', userId),
    )
    await runDelete('income_entries', () =>
      admin.from('income_entries').delete().eq('user_id', userId),
    )
    await runDelete('transfers', () => admin.from('transfers').delete().eq('user_id', userId))
    await runDelete('instruments', () =>
      admin.from('instruments').delete().eq('user_id', userId),
    )
    await runDelete('card_cycles', () =>
      admin.from('card_cycles').delete().eq('user_id', userId),
    )
    await runDelete('expenses', () => admin.from('expenses').delete().eq('user_id', userId))
    await runDelete('subscriptions', () =>
      admin.from('subscriptions').delete().eq('user_id', userId),
    )
    await runDelete('cards', () => admin.from('cards').delete().eq('user_id', userId))
    await runDelete('monthly_income', () =>
      admin.from('monthly_income').delete().eq('user_id', userId),
    )
    await runDelete('accounts', () => admin.from('accounts').delete().eq('user_id', userId))
    await runDelete('user_config', () =>
      admin.from('user_config').delete().eq('user_id', userId),
    )

    const { error: authError } = await admin.auth.admin.deleteUser(userId)
    if (authError) throw new Error(`auth user: ${authError.message}`)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete account error:', error)
    return NextResponse.json(
      { error: 'No se pudo eliminar la cuenta. Intenta de nuevo.' },
      { status: 500 },
    )
  }
}
