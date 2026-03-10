'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, X } from '@phosphor-icons/react'
import { formatAmount } from '@/lib/format'

interface Props {
  amount: number
  currency: 'ARS' | 'USD'
}

export function RolloverBanner({ amount, currency }: Props) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 5000)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null

  return (
    <div className="flex items-center gap-3 rounded-card border border-primary/15 bg-primary/8 px-4 py-3 slide-up">
      <CheckCircle size={16} weight="duotone" className="shrink-0 text-primary" />
      <p className="flex-1 text-xs text-primary">
        Rollover aplicado: <span className="font-semibold">+{formatAmount(amount, currency)}</span>{' '}
        del mes anterior.
      </p>
      <button onClick={() => setVisible(false)} className="shrink-0 text-primary/60">
        <X size={14} weight="bold" />
      </button>
    </div>
  )
}
