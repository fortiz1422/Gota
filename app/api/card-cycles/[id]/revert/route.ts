import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function isMissingCardPaymentAllocationsTableError(message: string | undefined): boolean {
  return !!message && message.toLowerCase().includes('card_payment_allocations')
}

async function deleteAdjustmentExpenses(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  closingDate: string | null,
) {
  if (!closingDate) return

  await supabase
    .from('expenses')
    .delete()
    .eq('user_id', userId)
    .eq('date', closingDate)
    .in('description', ['Cargo bancario', 'Gasto no registrado'])
}

async function resetCyclePaymentState(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cycleId: string,
  userId: string,
) {
  return supabase
    .from('card_cycles')
    .update({ status: 'open', paid_at: null, amount_paid: null, amount_draft: null })
    .eq('id', cycleId)
    .eq('user_id', userId)
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: cycle, error: cycleError } = await supabase
    .from('card_cycles')
    .select('card_id, paid_at, amount_paid, amount_draft, status, closing_date')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (cycleError || !cycle) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (cycle.status !== 'paid') return NextResponse.json({ error: 'Cycle is not paid' }, { status: 400 })
  if (!cycle.paid_at || cycle.amount_paid == null) {
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

    const allocation = allocations[0]
    const { data: expenseAllocations, error: expenseAllocationsError } = await supabase
      .from('card_payment_allocations')
      .select('id')
      .eq('user_id', user.id)
      .eq('expense_id', allocation.expense_id)
      .limit(2)

    if (expenseAllocationsError) {
      return NextResponse.json({ error: expenseAllocationsError.message }, { status: 500 })
    }

    if (!expenseAllocations || expenseAllocations.length !== 1) {
      return NextResponse.json(
        { error: 'No se puede revertir este pago porque ese movimiento se aplico a mas de un resumen.' },
        { status: 400 },
      )
    }

    const { error: deleteAllocationsError } = await supabase
      .from('card_payment_allocations')
      .delete()
      .eq('user_id', user.id)
      .eq('expense_id', allocation.expense_id)

    if (deleteAllocationsError) {
      return NextResponse.json({ error: deleteAllocationsError.message }, { status: 500 })
    }

    const { error: deleteExpenseError } = await supabase
      .from('expenses')
      .delete()
      .eq('id', allocation.expense_id)
      .eq('user_id', user.id)

    if (deleteExpenseError) {
      return NextResponse.json({ error: deleteExpenseError.message }, { status: 500 })
    }

    await deleteAdjustmentExpenses(supabase, user.id, cycle.closing_date)

    const { error: resetError } = await resetCyclePaymentState(supabase, id, user.id)
    if (resetError) return NextResponse.json({ error: resetError.message }, { status: 500 })

    return NextResponse.json({ ok: true, mode: 'allocations' })
  }

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
    .limit(2)

  if (!matchingExpenses || matchingExpenses.length !== 1) {
    return NextResponse.json(
      { error: 'No se puede revertir este pago porque no hay un unico movimiento compatible.' },
      { status: 400 },
    )
  }

  await supabase
    .from('expenses')
    .delete()
    .eq('id', matchingExpenses[0].id)
    .eq('user_id', user.id)

  await deleteAdjustmentExpenses(supabase, user.id, cycle.closing_date)

  const { error: resetError } = await resetCyclePaymentState(supabase, id, user.id)
  if (resetError) return NextResponse.json({ error: resetError.message }, { status: 500 })

  return NextResponse.json({ ok: true, mode: 'legacy' })
}
