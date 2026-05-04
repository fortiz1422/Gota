import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { toDateOnly } from '@/lib/format'
import { ExpenseSchema } from '@/lib/validation/schemas'
import { buildInstallmentRows, summarizeInstallmentGroup } from '@/lib/expenses/installments'
import { resolveCardCycleAssignments } from '@/lib/card-cycle-assignment'
import { z } from 'zod'

const UpdateSchema = z.object({
  amount: z.number().min(1).optional(),
  currency: z.enum(['ARS', 'USD']).optional(),
  category: z.string().min(1).optional(),
  description: z.string().max(100).optional(),
  is_want: z.boolean().nullable().optional(),
  is_recurring: z.boolean().nullable().optional(),
  is_extraordinary: z.boolean().nullable().optional(),
  payment_method: z.enum(['CASH', 'DEBIT', 'TRANSFER', 'CREDIT']).optional(),
  card_id: z.string().nullable().optional(),
  account_id: z.string().uuid().nullable().optional(),
  date: z.string().optional(),
  installments: z.number().int().min(1).max(72).optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: expense, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) {
    console.error('Get expense error:', error)
    return NextResponse.json({ error: 'Error al obtener gasto' }, { status: 500 })
  }

  if (!expense.installment_group_id) {
    return NextResponse.json({ expense, group: null })
  }

  const { data: groupRows, error: groupError } = await supabase
    .from('expenses')
    .select('*')
    .eq('installment_group_id', expense.installment_group_id)
    .eq('user_id', user.id)
    .order('installment_number', { ascending: true })
    .order('date', { ascending: true })

  if (groupError) {
    console.error('Get expense group error:', groupError)
    return NextResponse.json({ error: 'Error al obtener cuotas' }, { status: 500 })
  }

  const summary = summarizeInstallmentGroup(groupRows ?? [])
  const firstRow = summary.firstRow

  return NextResponse.json({
    expense,
    group: firstRow
      ? {
          installment_group_id: firstRow.installment_group_id,
          description: firstRow.description,
          category: firstRow.category,
          payment_method: firstRow.payment_method,
          card_id: firstRow.card_id,
          account_id: firstRow.account_id,
          currency: firstRow.currency,
          is_want: firstRow.is_want,
          is_recurring: firstRow.is_recurring,
          is_extraordinary: firstRow.is_extraordinary,
          total_amount: summary.totalAmount,
          date: summary.baseDate,
          recorded_installments: summary.recordedInstallments,
          first_installment_number: summary.firstInstallmentNumber,
          installment_total: firstRow.installment_total ?? summary.recordedInstallments,
        }
      : null,
  })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const body = await request.json()
    const validated = UpdateSchema.parse(body)
    const { data: existingExpense, error: existingError } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (existingError) throw existingError

    const currentGroupId = existingExpense.installment_group_id
    let originalRows = [existingExpense]
    let baseExpense = existingExpense
    let nextInstallments = validated.installments ?? 1

    if (currentGroupId) {
      const { data: groupRows, error: groupError } = await supabase
        .from('expenses')
        .select('*')
        .eq('installment_group_id', currentGroupId)
        .eq('user_id', user.id)
        .order('installment_number', { ascending: true })
        .order('date', { ascending: true })

      if (groupError) throw groupError

      const summary = summarizeInstallmentGroup(groupRows ?? [])
      if (!summary.firstRow) {
        return NextResponse.json({ error: 'Grupo de cuotas invalido.' }, { status: 409 })
      }

      if (summary.firstInstallmentNumber > 1) {
        return NextResponse.json(
          {
            error:
              'Las cuotas en curso que ya arrancan en una cuota avanzada no se pueden editar desde esta pantalla por ahora.',
          },
          { status: 409 }
        )
      }

      originalRows = summary.orderedRows
      baseExpense = {
        ...summary.firstRow,
        amount: summary.totalAmount,
        date: summary.baseDate ?? summary.firstRow.date,
      }
      nextInstallments = validated.installments ?? summary.recordedInstallments
    }

    const mergedExpense = {
      amount: validated.amount ?? baseExpense.amount,
      currency: validated.currency ?? baseExpense.currency,
      category: validated.category ?? baseExpense.category,
      description: validated.description ?? baseExpense.description,
      is_want: validated.is_want ?? baseExpense.is_want,
      is_recurring: validated.is_recurring ?? baseExpense.is_recurring,
      is_extraordinary: validated.is_extraordinary ?? baseExpense.is_extraordinary,
      payment_method: validated.payment_method ?? baseExpense.payment_method,
      card_id: validated.card_id !== undefined ? validated.card_id : baseExpense.card_id,
      account_id: validated.account_id !== undefined ? validated.account_id : baseExpense.account_id,
      date: toDateOnly(validated.date ?? baseExpense.date),
      is_legacy_card_payment: baseExpense.is_legacy_card_payment,
      installments: nextInstallments,
    }

    const parsedExpense = ExpenseSchema.safeParse(mergedExpense)
    if (!parsedExpense.success) {
      return NextResponse.json(
        { error: 'Datos invalidos', details: parsedExpense.error.issues },
        { status: 400 }
      )
    }

    if (parsedExpense.data.category === 'Pago de Tarjetas' && nextInstallments > 1) {
      return NextResponse.json(
        { error: 'Pago de Tarjetas no admite cuotas.' },
        { status: 400 }
      )
    }

    if (nextInstallments === 1) {
      const cycleAssignments =
        parsedExpense.data.payment_method === 'CREDIT' && parsedExpense.data.category !== 'Pago de Tarjetas'
          ? await resolveCardCycleAssignments({
              supabase,
              userId: user.id,
              cardId: parsedExpense.data.card_id,
              baseDate: parsedExpense.data.date,
              installments: 1,
            })
          : []

      if (!currentGroupId) {
        const { data, error } = await supabase
          .from('expenses')
          .update({
            amount: parsedExpense.data.amount,
            currency: parsedExpense.data.currency,
            category: parsedExpense.data.category,
            description: parsedExpense.data.description,
            is_want: parsedExpense.data.is_want,
            is_recurring: parsedExpense.data.is_recurring ?? false,
            is_extraordinary: parsedExpense.data.is_extraordinary ?? false,
            payment_method: parsedExpense.data.payment_method,
            card_id: parsedExpense.data.card_id,
            card_cycle_id: cycleAssignments[0]?.card_cycle_id ?? null,
            account_id: parsedExpense.data.account_id,
            date: parsedExpense.data.date,
          })
          .eq('id', id)
          .eq('user_id', user.id)
          .select()
          .single()

        if (error) throw error
        return NextResponse.json(data)
      }

      const { data: insertedSingle, error: insertSingleError } = await supabase
        .from('expenses')
        .insert({
          user_id: user.id,
          subscription_id: baseExpense.subscription_id,
          amount: parsedExpense.data.amount,
          currency: parsedExpense.data.currency,
          category: parsedExpense.data.category,
          description: parsedExpense.data.description,
          is_want: parsedExpense.data.is_want,
          is_recurring: parsedExpense.data.is_recurring ?? false,
          is_extraordinary: parsedExpense.data.is_extraordinary ?? false,
          is_legacy_card_payment: parsedExpense.data.is_legacy_card_payment,
          payment_method: parsedExpense.data.payment_method,
          card_id: parsedExpense.data.card_id,
          card_cycle_id: cycleAssignments[0]?.card_cycle_id ?? null,
          account_id: parsedExpense.data.account_id,
          date: parsedExpense.data.date,
        })
        .select()
        .single()

      if (insertSingleError) throw insertSingleError

      const originalIds = originalRows.map((row) => row.id)
      const { error: deleteGroupError } = await supabase
        .from('expenses')
        .delete()
        .in('id', originalIds)
        .eq('user_id', user.id)

      if (deleteGroupError) {
        await supabase.from('expenses').delete().eq('id', insertedSingle.id).eq('user_id', user.id)
        throw deleteGroupError
      }

      return NextResponse.json(insertedSingle)
    }

    const cycleAssignments =
      parsedExpense.data.payment_method === 'CREDIT' && parsedExpense.data.category !== 'Pago de Tarjetas'
        ? await resolveCardCycleAssignments({
            supabase,
            userId: user.id,
            cardId: parsedExpense.data.card_id,
            baseDate: parsedExpense.data.date,
            installments: nextInstallments,
          })
        : []

    const newRows = buildInstallmentRows({
      userId: user.id,
      expenseFields: {
        subscription_id: baseExpense.subscription_id,
        amount: parsedExpense.data.amount,
        currency: parsedExpense.data.currency,
        category: parsedExpense.data.category,
        description: parsedExpense.data.description,
        is_want: parsedExpense.data.is_want,
        is_recurring: parsedExpense.data.is_recurring ?? false,
        is_extraordinary: parsedExpense.data.is_extraordinary ?? false,
        is_legacy_card_payment: parsedExpense.data.is_legacy_card_payment,
        payment_method: parsedExpense.data.payment_method,
        card_id: parsedExpense.data.card_id,
        account_id: parsedExpense.data.account_id,
        date: parsedExpense.data.date,
      },
      installments: nextInstallments,
      cycleAssignments,
    })

    const newGroupId = newRows[0]?.installment_group_id
    const { data: insertedRows, error: insertError } = await supabase
      .from('expenses')
      .insert(newRows)
      .select()

    if (insertError) throw insertError

    const idsToDelete = originalRows.map((row) => row.id)
    const { error: deleteOriginalError } = await supabase
      .from('expenses')
      .delete()
      .in('id', idsToDelete)
      .eq('user_id', user.id)

    if (deleteOriginalError) {
      if (newGroupId) {
        await supabase
          .from('expenses')
          .delete()
          .eq('installment_group_id', newGroupId)
          .eq('user_id', user.id)
      }
      throw deleteOriginalError
    }

    return NextResponse.json(insertedRows?.[0] ?? {})
  } catch (e) {
    console.error('Update expense error:', e)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data: expense, error: fetchError } = await supabase
    .from('expenses')
    .select('installment_group_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchError) {
    console.error('Delete expense fetch error:', fetchError)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }

  let deleteError
  if (expense?.installment_group_id) {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('installment_group_id', expense.installment_group_id)
      .eq('user_id', user.id)
    deleteError = error
  } else {
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    deleteError = error
  }

  if (deleteError) {
    console.error('Delete expense error:', deleteError)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
