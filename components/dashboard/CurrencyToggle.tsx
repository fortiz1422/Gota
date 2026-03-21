'use client'

import { useRouter } from 'next/navigation'

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

interface Props {
  viewCurrency: 'ARS' | 'USD'
  selectedMonth: string
}

export function CurrencyToggle({ viewCurrency, selectedMonth }: Props) {
  const router = useRouter()
  const currentMonth = getCurrentMonth()

  const handleToggle = (next: 'ARS' | 'USD') => {
    if (next === viewCurrency) return
    const params = new URLSearchParams()
    if (selectedMonth !== currentMonth) params.set('month', selectedMonth)
    if (next !== 'ARS') params.set('currency', next)
    const query = params.toString()
    router.push(query ? `/?${query}` : '/')
  }

  const pillBase =
    'px-2.5 py-1 rounded-button text-[11px] font-semibold transition-colors duration-150'

  return (
    <div
      className="inline-flex items-center rounded-full border border-border-ocean p-0.5"
      style={{ background: 'rgba(255,255,255,0.38)' }}
    >
      <button
        onClick={() => handleToggle('ARS')}
        className={`${pillBase} ${
          viewCurrency === 'ARS'
            ? 'bg-primary text-white'
            : 'text-text-tertiary hover:text-text-secondary'
        }`}
      >
        ARS
      </button>
      <button
        onClick={() => handleToggle('USD')}
        className={`${pillBase} ${
          viewCurrency === 'USD'
            ? 'bg-primary text-white'
            : 'text-text-tertiary hover:text-text-secondary'
        }`}
      >
        USD
      </button>
    </div>
  )
}
