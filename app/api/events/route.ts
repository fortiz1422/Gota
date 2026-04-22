import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { recordProductEvent } from '@/lib/product-analytics/server'
import { PRODUCT_EVENT_NAMES } from '@/lib/product-analytics/events'

const EventValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

const EventSchema = z.object({
  event_name: z.enum(PRODUCT_EVENT_NAMES),
  properties: z.record(z.string(), EventValueSchema).optional(),
  session_id: z.string().max(120).nullable().optional(),
  path: z.string().max(180).nullable().optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = EventSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
  }

  const ok = await recordProductEvent(
    supabase,
    user.id,
    parsed.data.event_name,
    parsed.data.properties ?? {},
    {
      isAnonymous: user.is_anonymous === true,
      path: parsed.data.path ?? null,
      sessionId: parsed.data.session_id ?? null,
    },
  )

  return NextResponse.json({ ok }, { status: ok ? 201 : 202 })
}
