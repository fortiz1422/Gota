'use client'

import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { House, ChartBar, ListBullets } from '@phosphor-icons/react'

function TabBarContent() {
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
      tourId: undefined as string | undefined,
    },
    {
      href: `/movimientos`,
      icon: ListBullets,
      label: 'Movimientos',
      isActive: pathname.startsWith('/movimientos') || pathname.startsWith('/expenses'),
      tourId: 'tab-movimientos',
    },
    {
      href: `/analytics${monthSuffix}`,
      icon: ChartBar,
      label: 'Análisis',
      isActive: pathname.startsWith('/analytics'),
      tourId: 'tab-analytics',
    },
  ]

  return (
    <div className="flex items-stretch">
      {tabs.map(({ href, icon: Icon, label, isActive, tourId }) => (
        <Link
          key={label}
          href={href}
          data-tour={tourId}
          className="relative flex flex-1 flex-col items-center gap-1 px-1.5 pb-2 pt-[10px] transition-colors duration-200"
        >
          {/* topbar indicator — 2px line above active tab */}
          <span
            aria-hidden
            className="absolute left-1/2 top-0 h-0.5 w-7 -translate-x-1/2 rounded-full transition-colors duration-200"
            style={{ background: isActive ? 'var(--color-primary)' : 'transparent' }}
          />
          <Icon
            size={20}
            weight={isActive ? 'fill' : 'regular'}
            className={`shrink-0 ${isActive ? 'text-primary' : 'text-text-dim'}`}
          />
          <span
            className={`whitespace-nowrap text-[11px] leading-none tracking-[-0.005em] ${
              isActive ? 'font-bold text-primary' : 'font-medium text-text-dim'
            }`}
          >
            {label}
          </span>
        </Link>
      ))}
    </div>
  )
}

function TabBarInner({ integrated = false }: { integrated?: boolean }) {
  const pathname = usePathname()

  if (!integrated && pathname === '/') return null

  if (integrated) {
    return (
      <div className="mx-auto w-full max-w-md pt-1">
        <TabBarContent />
      </div>
    )
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        paddingTop: '4px',
        paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: '1px solid rgba(33,120,168,0.08)',
        boxShadow: '0 -1px 0 rgba(255,255,255,0.6) inset, 0 -8px 24px rgba(13,24,41,0.04)',
      }}
    >
      <div className="mx-auto w-full max-w-md px-4">
        <TabBarContent />
      </div>
    </nav>
  )
}

export function TabBar({ integrated = false }: { integrated?: boolean }) {
  return (
    <Suspense
      fallback={
        integrated ? null : (
          <div
            className="fixed bottom-0 left-0 right-0"
            style={{
              paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
              background: 'rgba(255,255,255,0.92)',
              borderTop: '1px solid rgba(33,120,168,0.08)',
            }}
          >
            <div className="mx-auto h-[76px] max-w-md" />
          </div>
        )
      }
    >
      <TabBarInner integrated={integrated} />
    </Suspense>
  )
}
