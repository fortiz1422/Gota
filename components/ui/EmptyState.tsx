import type { Icon } from '@phosphor-icons/react'

interface Props {
  icon: Icon
  iconColor?: string
  iconBgColor?: string
  title: string
  subtitle: string
  ctaLabel?: string
  onCta?: () => void
}

export function EmptyState({
  icon: IconComponent,
  iconColor = 'var(--color-text-tertiary)',
  iconBgColor = 'rgba(33,120,168,0.12)',
  title,
  subtitle,
  ctaLabel,
  onCta,
}: Props) {
  return (
    <div className="rounded-card bg-bg-secondary px-4 py-12 text-center">
      <div
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: iconBgColor }}
      >
        <IconComponent size={28} weight="duotone" style={{ color: iconColor }} />
      </div>
      <p className="mt-3 text-sm font-semibold text-text-primary">{title}</p>
      <p className="mt-1 text-xs text-text-tertiary">{subtitle}</p>
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="mt-4 rounded-button bg-primary px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  )
}
