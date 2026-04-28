'use client'

import type { AnalyticsMode } from '@/lib/analytics/analytics-overview'

interface Props {
  mode: AnalyticsMode
  onChange: (mode: AnalyticsMode) => void
}

const OPTIONS: Array<{ value: AnalyticsMode; label: string }> = [
  { value: 'percibido', label: 'Percibidos' },
  { value: 'percibido_devengado', label: 'Todo el gasto' },
]

export function AnalyticsModeToggle({ mode, onChange }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        background: '#E6ECF2',
        borderRadius: 20,
        padding: 3,
        margin: '0 22px 18px',
      }}
    >
      {OPTIONS.map((option) => {
        const active = option.value === mode
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            style={{
              flex: 1,
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              padding: '6px 16px',
              borderRadius: 16,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              color: active ? '#fff' : 'var(--color-text-secondary)',
              background: active ? 'var(--color-primary)' : 'transparent',
              boxShadow: 'none',
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
