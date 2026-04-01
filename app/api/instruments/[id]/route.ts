import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z, ZodError } from 'zod'

const CloseSchema = z.object({
  action: z.literal('close'),
  closed_amount: z.number().min(0),
  income_description: z.string().max(100).optional(),
})

const RenovarSchema = z.object({
  action: z.literal('renovar'),
  closed_amount: z.number().min(0),
  new_amount: z.number().min(1),
  rate: z.number().min(0).max(9999).nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  opened_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const EditSchema = z.object({
  action: z.literal('edit'),
  label: z.string().max(100).nullable().optional(),
  rate: z.number().min(0).max(9999).nullable().optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
})

const PatchSchema = z.discriminatedUnion('action', [CloseSchema, RenovarSchema, EditSchema])

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const body = await request.json()
    const validated = PatchSchema.parse(body)

    // Fetch and verify ownership
    const { data: instrument, error: fetchError } = await supabase
      .from('instruments')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !instrument) {
      return NextResponse.json({ error: 'Instrumento no encontrado' }, { status: 404 })
    }

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Buenos_Aires' })
    const todayISO = new Date(today + 'T12:00:00-03:00').toISOString()
    const typeLabel = instrument.type === 'plazo_fijo' ? 'Plazo fijo' : 'FCI'

    // ── EDIT ────────────────────────────────────────────────────────────────
    if (validated.action === 'edit') {
      const updates: Record<string, unknown> = {}
      if ('label' in validated) updates.label = validated.label
      if ('rate' in validated) updates.rate = validated.rate
      if ('due_date' in validated) updates.due_date = validated.due_date

      const { data, error } = await supabase
        .from('instruments')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json(data)
    }

    // ── CLOSE (vencimiento / rescate) ────────────────────────────────────────
    if (validated.action === 'close') {
      if (instrument.status === 'closed') {
        return NextResponse.json({ error: 'El instrumento ya está cerrado' }, { status: 400 })
      }

      const description =
        validated.income_description ??
        `Vencimiento ${typeLabel}${instrument.label ? ' — ' + instrument.label : ''}`

      // Income entry: capital + interests return to account
      if (instrument.account_id) {
        const { error: incomeError } = await supabase.from('income_entries').insert({
          user_id: user.id,
          account_id: instrument.account_id,
          amount: validated.closed_amount,
          currency: instrument.currency,
          description: description.slice(0, 100),
          category: 'other',
          date: todayISO,
        })
        if (incomeError) throw incomeError
      }

      const { data, error } = await supabase
        .from('instruments')
        .update({ status: 'closed', closed_at: today, closed_amount: validated.closed_amount })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json(data)
    }

    // ── RENOVAR ──────────────────────────────────────────────────────────────
    if (validated.action === 'renovar') {
      if (instrument.status === 'closed') {
        return NextResponse.json({ error: 'El instrumento ya está cerrado' }, { status: 400 })
      }

      // Income entry for the closed amount (offsets the new PF deduction in Saldo Vivo)
      if (instrument.account_id) {
        const { error: incomeError } = await supabase.from('income_entries').insert({
          user_id: user.id,
          account_id: instrument.account_id,
          amount: validated.closed_amount,
          currency: instrument.currency,
          description: `Renovación ${typeLabel}${instrument.label ? ' — ' + instrument.label : ''}`.slice(0, 100),
          category: 'other',
          date: todayISO,
        })
        if (incomeError) throw incomeError
      }

      // Close old instrument
      const { error: closeError } = await supabase
        .from('instruments')
        .update({ status: 'closed', closed_at: today, closed_amount: validated.closed_amount })
        .eq('id', id)
        .eq('user_id', user.id)

      if (closeError) throw closeError

      // Open new instrument
      const { data: newInstrument, error: newError } = await supabase
        .from('instruments')
        .insert({
          user_id: user.id,
          type: instrument.type,
          label: instrument.label,
          amount: validated.new_amount,
          currency: instrument.currency,
          rate: validated.rate ?? null,
          account_id: instrument.account_id,
          opened_at: validated.opened_at,
          due_date: validated.due_date ?? null,
          status: 'active',
        })
        .select()
        .single()

      if (newError) throw newError
      return NextResponse.json({ closed: true, new_instrument: newInstrument }, { status: 201 })
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.issues }, { status: 400 })
    }
    console.error('Instrument PATCH error:', error)
    return NextResponse.json({ error: 'Error al procesar la acción' }, { status: 500 })
  }
}
