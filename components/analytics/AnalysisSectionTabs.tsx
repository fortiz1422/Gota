'use client'

import Link from 'next/link'
import {
  buildAnalyticsHref,
  type AnalyticsView,
} from '@/lib/analytics/analytics-route-state'
import { trackEvent } from '@/lib/product-analytics/client'

interface Props {
  active: AnalyticsView
  month: string
  budgetAlertCount?: number
}

const OPTIONS: Array<{ value: AnalyticsView; label: string; ariaLabel?: string }> = [
  { value: 'summary', label: 'Resumen' },
  { value: 'insights', label: 'Insights' },
  { value: 'budget', label: 'Presup.', ariaLabel: 'Presupuesto' },
  { value: 'goals', label: 'Metas' },
]

export function AnalysisSectionTabs({ active, month, budgetAlertCount = 0 }: Props) {
  return (
    <nav
      aria-label="Secciones de Análisis"
      className="sticky z-30 px-4 pb-4"
      style={{ top: 'env(safe-area-inset-top)' }}
    >
      <div className="flex rounded-[20px] border border-border-subtle bg-white/95 p-1 shadow-md backdrop-blur-xl">
        {OPTIONS.map((option) => {
          const isActive = option.value === active
          return (
            <Link
              key={option.value}
              href={buildAnalyticsHref({ month, view: option.value })}
              aria-label={option.ariaLabel}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => {
                if (!isActive) {
                  trackEvent('analysis_section_selected', {
                    section: option.value,
                    source: 'workspace_tabs',
                  })
                }
              }}
              className="relative flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-[16px] px-1 text-[11px] font-bold transition-colors sm:text-[12px]"
              style={{
                background: isActive ? 'var(--color-primary)' : 'transparent',
                color: isActive ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              <span className="whitespace-nowrap">{option.label}</span>
              {option.value === 'budget' && budgetAlertCount > 0 ? (
                <span
                  aria-label={`${budgetAlertCount} ${budgetAlertCount === 1 ? 'alerta' : 'alertas'}`}
                  className={`ml-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${isActive ? 'bg-white' : 'bg-warning'}`}
                />
              ) : null}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}