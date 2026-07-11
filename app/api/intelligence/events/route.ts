import { NextResponse } from 'next/server'
import { FF_INTELLIGENCE_LIFECYCLE_V1 } from '@/lib/flags'
import { captureRouteError } from '@/lib/observability/sentry'
import { checkRateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'

const EVENT_TYPES = ['shown', 'snoozed', 'dismissed', 'acted', 'resolved', 'feedback'] as const
type EventType = (typeof EVENT_TYPES)[number]

const FEEDBACK_VALUES = ['useful', 'not_relevant', 'not_now'] as const
const STATUS_VALUES = ['calm', 'watch', 'risk'] as const

/**
 * Lifecycle de señales (guía §16). Solo claves, estados y timestamps:
 * nunca montos, merchants, tarjetas ni descripciones.
 */
export async function POST(request: Request) {
  if (!FF_INTELLIGENCE_LIFECYCLE_V1) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!checkRateLimit(`intelligence-events:${user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const type = String(body.type ?? '') as EventType
    const dedupeKey = String(body.dedupeKey ?? '').slice(0, 200)
    const insightKind = String(body.insightKind ?? '').slice(0, 60)
    const status = STATUS_VALUES.includes(body.status) ? (body.status as string) : null
    const surface = typeof body.surface === 'string' ? body.surface.slice(0, 40) : null

    if (!EVENT_TYPES.includes(type) || !dedupeKey || !insightKind) {
      return NextResponse.json({ error: 'Evento inválido' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const patch: Record<string, unknown> = { last_seen_at: now }
    if (status) patch.last_status = status
    if (surface) patch.surface = surface

    switch (type) {
      case 'snoozed': {
        const until = typeof body.until === 'string' ? body.until : null
        if (!until || Number.isNaN(Date.parse(until))) {
          return NextResponse.json({ error: 'Snooze sin fecha válida' }, { status: 400 })
        }
        patch.dismissed_until = until
        break
      }
      case 'dismissed':
        // Descartar sin fecha: hasta fin de mes corriente.
        patch.dismissed_until = `${now.substring(0, 7)}-31T23:59:59.000Z`
        break
      case 'acted':
        patch.acted_at = now
        break
      case 'resolved':
        patch.resolved_at = now
        break
      case 'feedback': {
        if (!FEEDBACK_VALUES.includes(body.feedback)) {
          return NextResponse.json({ error: 'Feedback inválido' }, { status: 400 })
        }
        patch.feedback = body.feedback
        break
      }
      case 'shown':
        break
    }

    const { data: existing } = await supabase
      .from('insight_events')
      .select('shown_count')
      .eq('user_id', user.id)
      .eq('dedupe_key', dedupeKey)
      .maybeSingle()

    const shownCount = (existing?.shown_count ?? 0) + (type === 'shown' ? 1 : 0)
    const { error } = await supabase.from('insight_events').upsert(
      {
        user_id: user.id,
        dedupe_key: dedupeKey,
        insight_kind: insightKind,
        shown_count: shownCount,
        ...patch,
      },
      { onConflict: 'user_id,dedupe_key' },
    )
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    captureRouteError(error, {
      route: 'POST /api/intelligence/events',
      operation: 'insight_lifecycle',
    })
    return NextResponse.json({ error: 'No se pudo registrar el evento' }, { status: 500 })
  }
}
