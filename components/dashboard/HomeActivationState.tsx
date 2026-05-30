'use client'

import type { HomeEmptyState } from '@/lib/home-empty-state'

type HomeActivationStateProps = {
  state: HomeEmptyState
  onPrimaryAction: () => void
}

export function HomeActivationState({ state, onPrimaryAction }: HomeActivationStateProps) {
  const { variant, showPrimaryActivation, primaryTitle, primaryBody, primaryActionLabel } = state

  if (!showPrimaryActivation || !primaryTitle || !primaryBody || !primaryActionLabel) return null

  const eyebrow = variant === 'monthly-empty' ? 'Este mes' : 'Primer movimiento'

  return (
    <section className="rounded-card border border-border-subtle bg-bg-secondary/60 px-4 py-5">
      <p className="type-label text-text-secondary">{eyebrow}</p>
      <h2 className="mt-2 text-[20px] font-bold tracking-[-0.02em] text-text-primary">{primaryTitle}</h2>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{primaryBody}</p>
      <button
        type="button"
        onClick={onPrimaryAction}
        className="mt-4 rounded-button border border-primary/30 bg-white px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/8"
      >
        {primaryActionLabel}
      </button>
    </section>
  )
}