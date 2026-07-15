import { NextResponse } from 'next/server'
import { FF_SIGNALS_CENTER_V1 } from '@/lib/flags'
import { captureRouteError } from '@/lib/observability/sentry'
import { checkRateLimit } from '@/lib/rate-limit'
import { loadIntelligenceSignals } from '@/lib/server/load-intelligence-signals'
import { createClient } from '@/lib/supabase/server'

const ERROR_CONTEXT = {
  route: 'GET /api/intelligence/signals',
  operation: 'intelligence_signals',
} as const

const INTERNAL_ERROR = { error: 'No pude cargar tus señales ahora.' } as const

export async function GET() {
  if (!FF_SIGNALS_CENTER_V1) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!checkRateLimit(`intelligence-signals:${user.id}`, 20, 60_000)) {
      return NextResponse.json(
        { error: 'Demasiadas consultas. Probá de nuevo en un minuto.' },
        { status: 429, headers: { 'Retry-After': '60' } },
      )
    }

    // El centro siempre representa el mes corriente y esta lectura no persiste estado.
    const model = await loadIntelligenceSignals({ supabase, userId: user.id })
    return NextResponse.json(model)
  } catch (error) {
    captureRouteError(error, ERROR_CONTEXT)
    return NextResponse.json(INTERNAL_ERROR, { status: 500 })
  }
}
