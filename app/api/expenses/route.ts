import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ExpenseSchema } from '@/lib/validation/schemas'
import { toDateOnly } from '@/lib/format'
import { buildInstallmentRows } from '@/lib/expenses/installments'
import { ZodError } from 'zod'
import { captureRouteError } from '@/lib/observability/sentry'
import { recordProductEvent } from '@/lib/product-analytics/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const pageSize = 20
  const offset = (page - 1) * pageSize

  let query = supabase
    .from('expenses')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  const month = searchParams.get('month')
  if (month) {
    const [y, m] = month.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    query = query
      .gte('date', `${month}-01`)
      .lte('date', `${month}-${String(lastDay).padStart(2, '0')}`)
  }

  const category = searchParams.get('category')
  if (category) query = query.eq('category', category)

  const paymentMethod = searchParams.get('payment_method')
  if (paymentMethod)
    query = query.eq('payment_method', paymentMethod as 'CASH' | 'DEBIT' | 'TRANSFER' | 'CREDIT')

  const cardId = searchParams.get('card_id')
  if (cardId) query = query.eq('card_id', cardId)

  const currency = searchParams.get('currency')
  if (currency) query = query.eq('currency', currency as 'ARS' | 'USD')

  const { data, count, error } = await query
  if (error) {
    captureRouteError(error, {
      route: 'GET /api/expenses',
      operation: 'list_expenses',
    })
    console.error('Get expenses error:', error)
    return NextResponse.json({ error: 'Error al obtener gastos' }, { status: 500 })
  }

  return NextResponse.json({
    expenses: data ?? [],
    total: count ?? 0,
    page,
    page_size: pageSize,
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validated = ExpenseSchema.parse(body)
    const { count: existingExpenseCount } = await supabase
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const { installments, installment_start, installment_grand_total, ...expenseFields } = validated
    const numInstallments = installments ?? 1
    const isFirstExpense = existingExpenseCount === 0

    const recordFirstExpense = async () => {
      if (!isFirstExpense) return
      await recordProductEvent(
        supabase,
        user.id,
        'first_expense_created',
        {
          currency: expenseFields.currency ?? 'ARS',
          has_installments: numInstallments > 1,
          payment_method: expenseFields.payment_method,
        },
        { isAnonymous: user.is_anonymous === true },
      )
    }

    if (numInstallments === 1) {
      const { data, error } = await supabase
        .from('expenses')
        .insert({ user_id: user.id, ...expenseFields, date: toDateOnly(expenseFields.date) })
        .select()
        .single()
      if (error) throw error
      await recordFirstExpense()
      return NextResponse.json(data, { status: 201 })
    }

    const rows = buildInstallmentRows({
      userId: user.id,
      expenseFields: {
        ...expenseFields,
        date: toDateOnly(expenseFields.date),
      },
      installments: numInstallments,
      installmentStart: installment_start,
      installmentGrandTotal: installment_grand_total,
    })

    const { data, error } = await supabase.from('expenses').insert(rows).select()
    if (error) throw error
    await recordFirstExpense()

    return NextResponse.json(data?.[0] ?? {}, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
        { status: 400 }
      )
    }
    captureRouteError(error, {
      route: 'POST /api/expenses',
      operation: 'create_expense',
    })
    console.error('Create expense error:', error)
    return NextResponse.json(
      { error: 'Error al guardar el gasto' },
      { status: 500 }
    )
  }
}
