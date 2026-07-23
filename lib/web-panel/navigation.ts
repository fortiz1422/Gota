import type { NavId } from '@/components/dashboard/desktop/desktop-chrome'

const WEB_NAV_IDS = new Set<NavId>([
  'inicio',
  'movimientos',
  'tarjetas',
  'presupuestos',
  'metas',
  'instrumentos',
  'analisis',
])

export function parseWebNavView(value: string | undefined): NavId {
  if (!value || !WEB_NAV_IDS.has(value as NavId)) return 'inicio'
  return value as NavId
}

export function buildWebNavHref(
  view: NavId,
  context: { month: string; currency: 'ARS' | 'USD' },
): string {
  const params = new URLSearchParams({ month: context.month, currency: context.currency })
  if (view !== 'inicio') params.set('view', view)
  return `/web?${params.toString()}`
}

export function resolveWebPanelNav(href: string): NavId | null {
  const url = new URL(href, 'https://gota.local')

  if (url.pathname === '/movimientos' || url.pathname === '/expenses') return 'movimientos'
  if (url.pathname.startsWith('/tarjetas')) return 'tarjetas'
  if (url.pathname.startsWith('/instrumentos')) return 'instrumentos'

  if (url.pathname === '/analytics') {
    if (url.searchParams.get('view') === 'budget') return 'presupuestos'
    if (url.searchParams.get('view') === 'goals') return 'metas'
    return 'analisis'
  }

  return null
}
