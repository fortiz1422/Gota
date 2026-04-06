import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { toDateOnly } from '@/lib/format'
import { z } from 'zod'

const UpdateSchema = z.object({
  amount: z.number().min(1).optional(),
  currency: z.enum(['ARS', 'USD']).optional(),
  category: z.string().min(1).optional(),
  description: z.string().max(100).optional(),
  is_want: z.boolean().nullable().optional(),
  payment_method: z.enum(['CASH', 'DEBIT', 'TRANSFER', 'CREDIT']).optional(),
  card_id: z.string().nullable().optional(),
  account_id: z.string().uuid().nullable().optional(),
  date: z.string().optional(),
})

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
    const updatePayload = {
      ...validated,
      date: validated.date ? toDateOnly(validated.date) : undefined,
    }

    const { data, error } = await supabase
      .from('expenses')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
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

  // Fetch the expense to check for installment group
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
    // Delete all rows in the installment group
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
