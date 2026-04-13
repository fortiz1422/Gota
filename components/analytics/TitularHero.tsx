'use client'

import type { ReactNode } from 'react'
import { colors } from '@/lib/colors'

interface Props {
  titular: string
  sentiment: 'positive' | 'alert' | 'neutral'
}

const SENTIMENT_COLOR = {
  positive: colors.success,
  alert:    colors.danger,
  neutral:  colors.primary,
} as const

// Matches: percentages (30%), $ amounts ($ 1.234), USD amounts (USD 1.234)
const HIGHLIGHT_REGEX = /(\d+(?:[,.]\d+)?%|\$\s?\d[\d.,]*(?:\s*[kM])?|USD\s?\d[\d.,]*)/g

function renderWithHighlights(text: string, color: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  HIGHLIGHT_REGEX.lastIndex = 0
  while ((match = HIGHLIGHT_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    nodes.push(
      <span key={match.index} style={{ color }}>
        {match[0]}
      </span>,
    )
    lastIndex = HIGHLIGHT_REGEX.lastIndex
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }
  return nodes
}

export function TitularHero({ titular, sentiment }: Props) {
  const color = SENTIMENT_COLOR[sentiment]
  return (
    <div className="px-5 pt-4 pb-2 slide-up">
      <p className="type-title text-text-primary">
        {renderWithHighlights(titular, color)}
      </p>
    </div>
  )
}
