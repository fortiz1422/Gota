'use client'

import type { HomeEmptyState } from '@/lib/home-empty-state'

type HomeActivationStateProps = {
  variant: HomeEmptyState['variant']
  showPrimaryActivation: HomeEmptyState['showPrimaryActivation']
  deemphasizeAnonymousBanner: HomeEmptyState['deemphasizeAnonymousBanner']
  title: HomeEmptyState['primaryTitle']
  body: HomeEmptyState['primaryBody']
  actionLabel: HomeEmptyState['primaryActionLabel']
  onPrimaryAction: () => void
}

export function HomeActivationState({
  variant,
  showPrimaryActivation,
  deemphasizeAnonymousBanner,
  title,
  body,
  actionLabel,
  onPrimaryAction,
}: HomeActivationStateProps) {
  if (!showPrimaryActivation || !title || !body || !actionLabel) return null

  const eyebrow = variant === 'monthly-empty' ? 'Este mes' : 'Primer movimiento'

  return (
    <section
      className="rounded-card border border-border-subtle bg-bg-secondary/60 px-4 py-5"
      data-anonymous-banner-tone={deemphasizeAnonymousBanner ? 'muted' : 'default'}
    >
      <p className="type-label text-text-secondary">{eyebrow}</p>
      <h2 className="mt-2 text-[20px] font-bold tracking-[-0.02em] text-text-primary">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-text-secondary">{body}</p>
      <button
        type="button"
        onClick={onPrimaryAction}
        className="mt-4 rounded-button border border-primary/30 bg-white px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/8"
      >
        {actionLabel}
      </button>
    </section>
  )
}