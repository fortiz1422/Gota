'use client'

interface Props {
  value: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  ariaLabel?: string
}

export function Toggle({ value, onChange, disabled = false, ariaLabel }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={ariaLabel}
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-40 ${
        value ? 'bg-primary' : 'bg-bg-elevated'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          value ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
