import { NextResponse } from 'next/server'
import { getEffectiveCardCycleState, isMissingCardCycleAmountsTableError } from '@/lib/card-cycle-amounts'
import { createClient } from '@/lib/supabase/server'

function isMissingCardPaymentAllocationsTableError(message: string | undefined): boolean {
  return !!message && message.toLowerCase().includes('card_payment_allocations')
}

async function deleteAdjustmentExpenses(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  closingDate: string | null,
  currency: 'ARS' | 'USD',
) {
  if (!closingDate) return

  await supabase
    .from('expenses')
    .delete()
    .eq('user_id', userId)
    .eq('currency', currency)
    .eq('date', closingDate)
    .in('description', ['Cargo bancario', 'Gasto no registrado'])
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { currency?: 'ARS' | 'USD' }
  const currency = body.currency ?? 'ARS'

  const { data: cycle, error: cycleError } = await supabase
    .from('card_cycles')
    .select('id, card_id, paid_at, amount_paid, amount_draft, status, closing_date')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (cycleError || !cycle) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: cycleAmountsData, error: cycleAmountsError } = await supabase
    .from('card_cycle_amounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('card_cycle_id', id)
    .eq('currency', currency)
    .maybeSingle()

  if (cycleAmountsError && !isMissingCardCycleAmountsTableError(cycleAmountsError.message)) {
    return NextResponse.json({ error: cycleAmountsError.message }, { status: 500 })
  }

  const state = getEffectiveCardCycleState(
    cycle,
    currency,
    cycleAmountsData ? new Map([[id, { [currency]: cycleAmountsData }]]) : undefined,
  )

  if (state.status !== 'paid') return NextResponse.json({ error: 'Cycle is not paid' }, { status: 400 })
  if (!state.paid_at || state.amount_paid == null) {
    return NextResponse.json({ error: 'Cycle payment data is incomplete' }, { status: 400 })
  }

  const { data: allocations, error: allocationsError } = await supabase
    .from('card_payment_allocations')
    .select('id, expense_id, amount_applied')
    .eq('user_id', user.id)
    .eq('card_cycle_id', id)

  if (allocationsError && !isMissingCardPaymentAllocationsTableError(allocationsError.message)) {
    return NextResponse.json({ error: allocationsError.message }, { status: 500 })
  }

  if (!allocationsError && allocations && allocations.length > 0) {
    if (allocations.length !== 1) {
      return NextResponse.json(
        { error: 'No se puede revertir este pago porque el resumen tiene multiples pagos aplicados.' },
        { status: 400 },
      )
    }

    const matchingAllocation = allocations[0]
    const { data: expenseAllocations, error: expenseAllocationsError } = await supabase
      .from('card_payment_allocations')
      .select('id')
      .eq('user_id', user.id)
      .eq('expense_id', matchingAllocation.expense_id)
      .limit(2)

    if (expenseAllocationsError) {
      return NextResponse.json({ error: expenseAllocationsError.message }, { status: 500 })
    }

    if (!expenseAllocations || expenseAllocations.length !== 1) {
      return NextResponse.json(
        { error: 'No se puede revertir este pago porque ese movimiento se aplicó a más de un resumen.' },
        { status: 400 },
      )
    }

    const { data: paymentExpense, error: paymentExpenseError } = await supabase
      .from('expenses')
      .select('currency')
      .eq('id', matchingAllocation.expense_id)
      .eq('user_id', user.id)
      .single()

    if (paymentExpenseError || !paymentExpense || paymentExpense.currency !== currency) {
      return NextResponse.json(
        { error: 'No se puede revertir este pago desde otra moneda.' },
        { status: 400 },
      )
    }

    const { error: deleteAllocationsError } = await supabase
      .from('card_payment_allocations')
      .delete()
      .eq('user_id', user.id)
      .eq('expense_id', matchingAllocation.expense_id)

    if (deleteAllocationsError) {
      return NextResponse.json({ error: deleteAllocationsError.message }, { status: 500 })
    }

    const { error: deleteExpenseError } = await supabase
      .from('expenses')
      .delete()
      .eq('id', matchingAllocation.expense_id)
      .eq('user_id', user.id)

    if (deleteExpenseError) {
      return NextResponse.json({ error: deleteExpenseError.message }, { status: 500 })
    }

    await deleteAdjustmentExpenses(supabase, user.id, cycle.closing_date, currency)

    const { error: resetError } = await supabase
      .from('card_cycle_amounts')
      .upsert({
        user_id: user.id,
        card_cycle_id: id,
        currency,
        status: 'open',
        paid_at: null,
        amount_paid: null,
        amount_draft: null,
      }, { onConflict: 'card_cycle_id,currency' })

    if (resetError) return NextResponse.json({ error: resetError.message }, { status: 500 })
    return NextResponse.json({ ok: true, mode: 'allocations' })
  }

  const paidDate = state.paid_at.substring(0, 10)
  const { data: matchingExpenses } = await supabase
    .from('expenses')
    .select('id')
    .eq('user_id', user.id)
    .eq('card_id', cycle.card_id)
    .eq('currency', currency)
    .eq('category', 'Pago de Tarjetas')
    .eq('amount', state.amount_paid)
    .gte('date', `${paidDate}T00:00:00Z`)
    .lte('date', `${paidDate}T23:59:59Z`)
    .limit(2)

  if (!matchingExpenses || matchingExpenses.length !== 1) {
    return NextResponse.json(
      { error: 'No se puede revertir este pago porque no hay un único movimiento compatible.' },
      { status: 400 },
    )
  }

  await supabase
    .from('expenses')
    .delete()
    .eq('id', matchingExpenses[0].id)
    .eq('user_id', user.id)

  await deleteAdjustmentExpenses(supabase, user.id, cycle.closing_date, currency)

  const { error: resetError } = await supabase
    .from('card_cycle_amounts')
    .upsert({
      user_id: user.id,
      card_cycle_id: id,
      currency,
      status: 'open',
      paid_at: null,
      amount_paid: null,
      amount_draft: null,
    }, { onConflict: 'card_cycle_id,currency' })

  if (resetError) return NextResponse.json({ error: resetError.message }, { status: 500 })

  return NextResponse.json({ ok: true, mode: 'legacy' })
}
