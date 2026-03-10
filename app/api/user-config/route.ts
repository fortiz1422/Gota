import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const CardSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  archived: z.boolean().optional(),
})

const UpdateSchema = z.object({
  default_currency: z.enum(['ARS', 'USD']).optional(),
  cards: z.array(CardSchema).optional(),
  onboarding_completed: z.boolean().optional(),
  rollover_mode: z.enum(['auto', 'manual', 'off']).optional(),
})

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_config')
    .select('default_currency, cards')
    .eq('user_id', user.id)
    .single()

  if (error) return NextResponse.json({ error: 'Error' }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const validated = UpdateSchema.parse(body)

    const { error } = await supabase
      .from('user_config')
      .update(validated)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Update user config error:', e)
    return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 })
  }
}
