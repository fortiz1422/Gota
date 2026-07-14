export interface TabItem {
  href: string
  label: 'Home' | 'Movimientos' | 'Análisis' | 'Perfil'
  isActive: boolean
  tourId?: string
}

interface GetTabItemsOptions {
  signalsCenterEnabled: boolean
  pathname: string
  month: string | null
}

export function getTabItems({
  signalsCenterEnabled,
  pathname,
  month,
}: GetTabItemsOptions): TabItem[] {
  const monthSuffix = month ? `?month=${encodeURIComponent(month)}` : ''
  const items: TabItem[] = [
    {
      href: `/${monthSuffix}`,
      label: 'Home',
      isActive: pathname === '/',
      tourId: undefined,
    },
    {
      href: `/movimientos${monthSuffix}`,
      label: 'Movimientos',
      isActive:
        pathname.startsWith('/movimientos') || pathname.startsWith('/expenses'),
      tourId: 'tab-movimientos',
    },
    {
      href: `/analytics${monthSuffix}`,
      label: 'Análisis',
      isActive: pathname.startsWith('/analytics'),
      tourId: 'tab-analytics',
    },
  ]

  if (signalsCenterEnabled) {
    items.push({
      href: '/settings',
      label: 'Perfil',
      isActive: pathname.startsWith('/settings'),
      tourId: undefined,
    })
  }

  return items
}
