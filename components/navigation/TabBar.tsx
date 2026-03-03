'use client'

import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Home, BarChart2, Settings } from 'lucide-react'

function TabBarInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const month = searchParams.get('month')
  const monthSuffix = month ? `?month=${month}` : ''

  const tabs = [
    {
      href: `/${monthSuffix}`,
      icon: Home,
      label: 'Home',
      isActive: pathname === '/' || pathname.startsWith('/expenses'),
    },
    {
      href: `/analytics${monthSuffix}`,
      icon: BarChart2,
      label: 'Análisis',
      isActive: pathname.startsWith('/analytics'),
    },
    {
      href: '/settings',
      icon: Settings,
      label: 'Config',
      isActive: pathname.startsWith('/settings'),
    },
  ]

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
        paddingTop: 8,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '6px 8px',
          borderRadius: 9999,
          width: 'fit-content',
          background: 'rgba(5,12,28,0.92)',
          border: '1px solid rgba(148,210,255,0.15)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(148,210,255,0.06)',
        }}
      >
        {tabs.map(({ href, icon: Icon, label, isActive }) => (
          <Link
            key={label}
            href={href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: isActive ? 8 : 0,
              padding: isActive ? '8px 18px' : '8px 14px',
              borderRadius: 9999,
              background: isActive ? 'rgba(148,210,255,0.13)' : 'transparent',
              transition: 'all 200ms',
              overflow: 'hidden',
              textDecoration: 'none',
            }}
          >
            <Icon
              size={18}
              style={{
                color: isActive ? '#fff' : '#7B98B8',
                strokeWidth: isActive ? 2.2 : 1.7,
                flexShrink: 0,
              }}
            />
            {isActive && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#fff',
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.01em',
                }}
              >
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
        <div className="fixed bottom-0 left-0 right-0 flex justify-center" style={{ paddingBottom: 20 }}>
          <div style={{ width: 160, height: 48, borderRadius: 9999, background: 'rgba(5,12,28,0.92)', border: '1px solid rgba(148,210,255,0.15)' }} />
        </div>
      }
    >
      <TabBarInner />
    </Suspense>
  )
}
