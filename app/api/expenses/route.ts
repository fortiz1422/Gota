import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ExpenseSchema } from '@/lib/validation/schemas'
import { toDateOnly } from '@/lib/format'
import { ZodError } from 'zod'

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

function addMonths(dateStr: string, n: number): string {
  // dateStr is YYYY-MM-DD
  const [year, month, day] = dateStr.split('-').map(Number)
  const targetMonth = month - 1 + n // 0-indexed month
  const targetYear = year + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12 // handle negative
  // Cap day to last day of target month
  const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate()
  const targetDay = Math.min(day, lastDay)
  return `${targetYear}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`
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

    const { installments, installment_start, installment_grand_total, ...expenseFields } = validated
    const numInstallments = installments ?? 1

    if (numInstallments === 1) {
      const { data, error } = await supabase
        .from('expenses')
        .insert({ user_id: user.id, ...expenseFields, date: toDateOnly(expenseFields.date) })
        .select()
        .single()
      if (error) throw error
      return NextResponse.json(data, { status: 201 })
    }

    // Multi-row insert for installments
    const baseDate = expenseFields.date.split('T')[0] // YYYY-MM-DD
    // If installment_start is provided, amount is already per-installment (cuotas en curso)
    const perInstallment = installment_start != null
      ? expenseFields.amount
      : Math.round((expenseFields.amount / numInstallments) * 100) / 100
    const startNumber = installment_start ?? 1
    const grandTotal = installment_grand_total ?? numInstallments
    const groupId = crypto.randomUUID()

    const rows = Array.from({ length: numInstallments }, (_, i) => ({
      user_id: user.id,
      ...expenseFields,
      amount: perInstallment,
      date: addMonths(baseDate, i),
      installment_group_id: groupId,
      installment_number: startNumber + i,
      installment_total: grandTotal,
    }))

    const { data, error } = await supabase.from('expenses').insert(rows).select()
    if (error) throw error

    return NextResponse.json(data?.[0] ?? {}, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Create expense error:', error)
    return NextResponse.json(
      { error: 'Error al guardar el gasto' },
      { status: 500 }
    )
  }
}
