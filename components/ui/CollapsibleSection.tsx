'use client'

import { useState } from 'react'
import { CaretDown } from '@phosphor-icons/react'

interface Props {
  icon: React.ReactNode
  title: string
  summary?: string
  defaultExpanded?: boolean
  children: React.ReactNode
}

export function CollapsibleSection({ icon, title, summary, defaultExpanded = false, children }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="rounded-card bg-bg-secondary border border-border-subtle overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-base leading-none">{icon}</span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-text-primary">{title}</span>
          {summary && !expanded && (
            <span className="ml-2 text-xs text-text-tertiary truncate">{summary}</span>
          )}
        </div>
        <CaretDown
          weight="duotone"
          size={14}
          className={`shrink-0 text-text-tertiary transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-border-subtle px-4 pb-4 pt-3">
          {children}
        </div>
      )}
    </div>
  )
}
