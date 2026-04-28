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
              fontWeight: active ? 600 : 500,
              padding: '6px 16px',
              borderRadius: 16,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              color: active ? '#0D1829' : '#90A4B0',
              background: active ? '#fff' : 'transparent',
              boxShadow: active ? '0 1px 3px rgba(13,24,41,0.10)' : 'none',
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
