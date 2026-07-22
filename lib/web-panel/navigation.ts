import type { NavId } from '@/components/dashboard/desktop/desktop-chrome'

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
