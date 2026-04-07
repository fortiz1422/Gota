import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch cycle to get payment details
  const { data: cycle, error: cycleError } = await supabase
    .from('card_cycles')
    .select('card_id, paid_at, amount_paid, status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (cycleError || !cycle) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (cycle.status !== 'paid') return NextResponse.json({ error: 'Cycle is not paid' }, { status: 400 })
  if (!cycle.paid_at || cycle.amount_paid == null) {
    return NextResponse.json({ error: 'Cycle payment data is incomplete' }, { status: 400 })
  }

  // Find matching "Pago de Tarjetas" expense: same card, same date, same amount
  const paidDate = cycle.paid_at.substring(0, 10)
  const { data: matchingExpenses } = await supabase
    .from('expenses')
    .select('id')
    .eq('user_id', user.id)
    .eq('card_id', cycle.card_id)
    .eq('category', 'Pago de Tarjetas')
    .eq('amount', cycle.amount_paid)
    .gte('date', `${paidDate}T00:00:00Z`)
    .lte('date', `${paidDate}T23:59:59Z`)
    .limit(1)

  // Delete matching expense if found
  if (matchingExpenses && matchingExpenses.length > 0) {
    await supabase
      .from('expenses')
      .delete()
      .eq('id', matchingExpenses[0].id)
      .eq('user_id', user.id)
  }

  // Reset cycle
  const { error: resetError } = await supabase
    .from('card_cycles')
    .update({ status: 'open', paid_at: null, amount_paid: null })
    .eq('id', id)
    .eq('user_id', user.id)

  if (resetError) return NextResponse.json({ error: resetError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
