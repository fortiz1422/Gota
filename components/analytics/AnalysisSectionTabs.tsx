'use client'

type Section = 'resumen' | 'control'

interface Props {
  active: Section
  onChange: (section: Section) => void
}

const OPTIONS: Array<{ value: Section; label: string }> = [
  { value: 'resumen', label: 'Resumen' },
  { value: 'control', label: 'Control' },
]

export function AnalysisSectionTabs({ active, onChange }: Props) {
  return (
    <div className="mx-5 mb-4 flex gap-2 rounded-[20px] p-1" style={{ background: '#E6ECF2' }}>
      {OPTIONS.map((option) => {
        const isActive = option.value === active
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className="flex-1 rounded-[16px] px-4 py-2 text-[12px] font-semibold transition-colors"
            style={{
              background: isActive ? 'var(--color-primary)' : 'transparent',
              color: isActive ? '#fff' : 'var(--color-text-secondary)',
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
