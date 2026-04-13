'use client'

import type { Chip } from '@/lib/heroEngine/types'

interface Props {
  chips: Chip[]
}

const EMPHASIS_CLASS: Record<NonNullable<Chip['emphasis']>, string> = {
  neutral: 'border border-primary/35 bg-primary/10 text-primary',
  warning: 'bg-warning/8 border-warning/30 text-warning',
  positive: 'bg-success/8 border-success/30 text-success',
}

export function InsightChips({ chips }: Props) {
  if (chips.length === 0) return null

  return (
    <div className="w-full flex gap-2 overflow-x-auto px-5 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {chips.map((chip) => (
        <span
          key={chip.label}
          className={`shrink-0 whitespace-nowrap rounded-pill px-2.5 py-1 text-[12px] font-medium ${
            EMPHASIS_CLASS[chip.emphasis ?? 'neutral']
          }`}
        >
          {chip.label}
        </span>
      ))}
    </div>
  )
}
