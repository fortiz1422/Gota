'use client'

import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { House, ChartBar, Gear } from '@phosphor-icons/react'

function TabBarInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const month = searchParams.get('month')
  const monthSuffix = month ? `?month=${month}` : ''

  const tabs = [
    {
      href: `/${monthSuffix}`,
      icon: House,
      label: 'Home',
      isActive: pathname === '/' || pathname.startsWith('/expenses'),
    },
    {
      href: `/analytics${monthSuffix}`,
      icon: ChartBar,
      label: 'Análisis',
      isActive: pathname.startsWith('/analytics'),
    },
    {
      href: '/settings',
      icon: Gear,
      label: 'Config',
      isActive: pathname.startsWith('/settings'),
    },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pt-2"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
    >
      <div
        className="flex items-center gap-1 px-2 py-1.5 rounded-full w-fit bg-nav-bg border border-border-ocean backdrop-blur-2xl"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(148,210,255,0.06)' }}
      >
        {tabs.map(({ href, icon: Icon, label, isActive }) => (
          <Link
            key={label}
            href={href}
            className={`flex items-center rounded-full overflow-hidden transition-all duration-200 ${
              isActive
                ? 'gap-2 px-[18px] py-2 bg-primary/[0.13]'
                : 'gap-0 px-[14px] py-2 bg-transparent'
            }`}
          >
            <Icon
              size={18}
              weight={isActive ? 'duotone' : 'regular'}
              className={`shrink-0 ${isActive ? 'text-text-primary icon-duotone' : 'text-text-label'}`}
            />
            {isActive && (
              <span className="text-[12px] font-semibold text-text-primary whitespace-nowrap tracking-[-0.01em]">
                {label}
              </span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  )
}

export function TabBar() {
  return (
    <Suspense
      fallback={
        <div className="fixed bottom-0 left-0 right-0 flex justify-center pb-5">
          <div className="w-40 h-12 rounded-full bg-nav-bg border border-border-ocean" />
        </div>
      }
    >
      <TabBarInner />
    </Suspense>
  )
}
