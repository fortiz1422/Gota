'use client'

import { Check } from 'lucide-react'

interface MonthOption {
  value: string  // YYYY-MM
  label: string  // «Marzo 2026»
}

interface Props {
  isOpen: boolean
  onClose: () => void
  selectedMonth: string
  onSelectMonth: (month: string) => void
  months: MonthOption[]
}

export function MonthSelectorSheet({
  isOpen,
  onClose,
  selectedMonth,
  onSelectMonth,
  months,
}: Props) {
  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(3,8,16,0.75)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* Sheet — constrained to app max-width */}
      <div
        className="slide-up"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 448,
          background: '#050A14',
          borderRadius: '2rem 2rem 0 0',
          borderTop: '1px solid rgba(148,210,255,0.15)',
          maxHeight: '70vh',
          overflowY: 'auto',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
        }}
      >
        {/* Handle */}
        <div
          style={{
            width: 48,
            height: 4,
            background: '#334155',
            borderRadius: 9999,
            margin: '16px auto 8px',
            flexShrink: 0,
          }}
        />

        {/* Month list */}
        {months.map(({ value, label }) => {
          const isSelected = value === selectedMonth
          return (
            <button
              key={value}
              onClick={() => {
                onSelectMonth(value)
                onClose()
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 24px',
                background: isSelected ? 'rgba(148,210,255,0.10)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  fontWeight: isSelected ? 600 : 400,
                  color: isSelected ? '#38bdf8' : '#ffffff',
                }}
              >
                {label}
              </span>
              {isSelected && (
                <Check size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
