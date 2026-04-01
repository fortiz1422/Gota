import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z, ZodError } from 'zod'

const InstrumentSchema = z.object({
  type: z.enum(['plazo_fijo', 'fci']),
  label: z.string().max(100).optional(),
  amount: z.number().min(1),
  currency: z.enum(['ARS', 'USD']),
  rate: z.number().min(0).max(9999).nullable().optional(),
  account_id: z.string().uuid().nullable().optional(),
  opened_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const validated = InstrumentSchema.parse(body)

    const { data: instrument, error } = await supabase
      .from('instruments')
      .insert({
        user_id: user.id,
        type: validated.type,
        label: validated.label ?? null,
        amount: validated.amount,
        currency: validated.currency,
        rate: validated.rate ?? null,
        account_id: validated.account_id ?? null,
        opened_at: validated.opened_at,
        due_date: validated.due_date ?? null,
        status: 'active',
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(instrument, { status: 201 })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.issues }, { status: 400 })
    }
    console.error('Create instrument error:', error)
    return NextResponse.json({ error: 'Error al crear instrumento' }, { status: 500 })
  }
}
