'use client'

import { CaretRight } from '@phosphor-icons/react'
import type { AmbientModifier, AmbientStatus } from '@/lib/intelligence/home-model'

const STATUS_TEXT: Record<AmbientStatus, string> = {
  neutral: 'text-text-secondary',
  positive: 'text-success',
  watch: 'text-warning',
  risk: 'text-danger',
}

const STATUS_DOT: Record<AmbientStatus, string | null> = {
  neutral: null,
  positive: null,
  watch: 'bg-warning',
  risk: 'bg-danger',
}

/**
 * Línea ambiental de un módulo del Home: una sola historia, un solo
 * affordance (chevron a la explicación cuando existe). Reemplaza el copy
 * secundario del módulo; nunca se apila con badges ni CTAs extra.
 */
export function HomeAmbientLine({
  modifier,
  onExplain,
  compact = false,
}: {
  modifier: AmbientModifier
  onExplain?: (explanationId: string) => void
  /** Densidad de los módulos del Home real (11px, punto más chico). */
  compact?: boolean
}) {
  const dot = STATUS_DOT[modifier.status]
  const interactive = Boolean(modifier.explanationId && onExplain)
  const textSize = compact ? 'text-[11px]' : 'text-[13px]'
  const content = (
    <>
      {dot && (
        <span
          aria-hidden
          className={`${compact ? 'h-1 w-1' : 'h-1.5 w-1.5'} shrink-0 rounded-full ${dot}`}
        />
      )}
      <span className={`break-words ${textSize} font-medium leading-tight ${STATUS_TEXT[modifier.status]}`}>
        {modifier.label}
      </span>
      {interactive && <CaretRight size={12} weight="regular" className="shrink-0 text-text-tertiary" />}
    </>
  )

  if (!interactive) {
    return <div className="flex min-w-0 items-center gap-1.5">{content}</div>
  }
  return (
    <button
      type="button"
      onClick={() => onExplain?.(modifier.explanationId!)}
      className="flex min-w-0 items-center gap-1.5 text-left"
    >
      {content}
    </button>
  )
}
