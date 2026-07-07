import { NextResponse } from 'next/server'
import { FF_INTELLIGENCE } from '@/lib/flags'
import { buildHeroesResponse } from '@/lib/intelligence/heroes'
import { loadFinancialSnapshot } from '@/lib/intelligence/snapshot'
import { captureRouteError } from '@/lib/observability/sentry'
import { checkRateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  if (!FF_INTELLIGENCE) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!checkRateLimit(`intelligence-heroes:${user.id}`, 20, 60_000)) {
    return NextResponse.json(
      { error: 'Demasiadas consultas. Probá de nuevo en un minuto.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }

  try {
    // Los héroes hablan del presente: siempre mes corriente.
    const snapshot = await loadFinancialSnapshot({ supabase, userId: user.id })
    return NextResponse.json(buildHeroesResponse(snapshot))
  } catch (error) {
    captureRouteError(error, {
      route: 'GET /api/intelligence/heroes',
      operation: 'intelligence_heroes',
    })
    console.error('Intelligence heroes error:', error)
    return NextResponse.json(
      { error: 'No pude generar la lectura inteligente ahora.' },
      { status: 500 },
    )
  }
}
