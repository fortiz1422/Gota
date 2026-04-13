'use client'

import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { House, ChartBar, ListBullets } from '@phosphor-icons/react'

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
      isActive: pathname === '/',
    },
    {
      href: `/movimientos`,
      icon: ListBullets,
      label: 'Movimientos',
      isActive: pathname.startsWith('/movimientos') || pathname.startsWith('/expenses'),
    },
    {
      href: `/analytics${monthSuffix}`,
      icon: ChartBar,
      label: 'Análisis',
      isActive: pathname.startsWith('/analytics'),
    },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[color:var(--color-separator)]"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'var(--color-nav-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <div className="mx-auto flex w-full max-w-md items-center justify-around px-4 py-2 shadow-tab-bar">
        {tabs.map(({ href, icon: Icon, label, isActive }) => (
          <Link
            key={label}
            href={href}
            className="flex min-w-0 flex-col items-center gap-1 rounded-xl px-3 py-1.5 transition-colors duration-200"
          >
            <Icon
              size={18}
              weight={isActive ? 'bold' : 'regular'}
              className={`shrink-0 ${isActive ? 'text-primary' : 'text-text-dim'}`}
            />
            <span
              className={`whitespace-nowrap text-[12px] leading-none ${
                isActive ? 'font-semibold text-primary' : 'font-normal text-text-dim'
              }`}
            >
              {label}
            </span>
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
        <div className="fixed bottom-0 left-0 right-0 border-t border-[color:var(--color-separator)] bg-[color:var(--color-nav-bg)]">
          <div className="mx-auto h-14 max-w-md" />
        </div>
      }
    >
      <TabBarInner />
    </Suspense>
  )
}
