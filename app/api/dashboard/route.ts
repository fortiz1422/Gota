import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentMonth } from '@/lib/dates'
import { processYieldAccrual } from '@/lib/yieldEngine'
import { FF_YIELD } from '@/lib/flags'
import { todayAR } from '@/lib/format'
import { readDashboardData } from '@/lib/server/dashboard-queries'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processSubscriptions(supabase: any, userId: string, currentMonth: string, currentDay: number) {
  const monthDate = currentMonth + '-01'

  const { data: subs } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (!subs?.length) return

  const { data: insertions } = await supabase
    .from('subscription_insertions')
    .select('subscription_id, expense_id')
    .eq('month', monthDate)

  const inserted = new Set(
    (insertions ?? [])
      .filter((i: { expense_id: string | null }) => i.expense_id)
      .map((i: { subscription_id: string }) => i.subscription_id),
  )

  for (const sub of subs) {
    if (inserted.has(sub.id) || currentDay < sub.day_of_month) continue

    const { data: reservation, error: reservationError } = await supabase
      .from('subscription_insertions')
      .insert({ subscription_id: sub.id, month: monthDate })
      .select('id')
      .single()

    if (reservationError || !reservation) continue

    const expDate = `${currentMonth}-${String(sub.day_of_month).padStart(2, '0')}`
    const { data: expense, error: expenseError } = await supabase
      .from('expenses')
      .insert({
        user_id: userId,
        subscription_id: sub.id,
        description: sub.description,
        category: sub.category,
        amount: sub.amount,
        currency: sub.currency,
        payment_method: sub.payment_method,
        card_id: sub.card_id,
        account_id: sub.account_id ?? null,
        date: expDate,
      })
      .select('id')
      .single()

    if (expenseError || !expense) {
      await supabase.from('subscription_insertions').delete().eq('id', reservation.id)
      continue
    }

    if (expense) {
      await supabase
        .from('subscription_insertions')
        .update({ expense_id: expense.id })
        .eq('id', reservation.id)
    }
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const monthParam = searchParams.get('month')
  const currencyParam = searchParams.get('currency')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const currentMonth = getCurrentMonth()
  const selectedMonth = monthParam ?? currentMonth
  const viewCurrency = (currencyParam === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD'
  const todayDate = todayAR()

  // Fire-and-forget subscription auto-insert (current month only)
  void processSubscriptions(supabase, user.id, currentMonth, parseInt(todayDate.split('-')[2], 10))
  // Home now reflects live balances even when browsing another month.
  if (FF_YIELD) await processYieldAccrual(supabase, user.id, currentMonth)

  const data = await readDashboardData({
    supabase,
    userId: user.id,
    selectedMonth,
    viewCurrency,
  })

  return NextResponse.json(data)
}
