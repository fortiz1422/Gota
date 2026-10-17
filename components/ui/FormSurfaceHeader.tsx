'use client'

import type { ReactNode, RefObject } from 'react'
import { X } from '@phosphor-icons/react'

export type FormSurfaceVariant = 'r' | 'blue-hero'

/** Opt-in visual header. Sheet geometry, focus and dismissal remain owned by the caller. */
export function FormSurfaceHeader({
  variant,
  titleId,
  title,
  navigationTitle,
  closeTitle,
  eyebrow,
  description,
  showIntro = true,
  showNavigationTitle = true,
  hero,
  onClose,
  closeRef,
  busy = false,
}: {
  variant: FormSurfaceVariant
  titleId: string
  title: string
  navigationTitle?: string
  closeTitle?: string
  eyebrow: string
  description: string
  showIntro?: boolean
  showNavigationTitle?: boolean
  hero?: ReactNode
  onClose: () => void
  closeRef?: RefObject<HTMLButtonElement | null>
  busy?: boolean
}) {
  return (
    <header
      data-form-header
      className={variant === 'r' ? 'form-r-header' : 'blue-zone-form'}
    >
      <div className="form-navigation">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label={`Cerrar ${closeTitle ?? navigationTitle ?? title}`}
          className="form-close"
        >
          <X size={22} weight="duotone" />
        </button>
        {showNavigationTitle ? (
          <p id={!showIntro ? titleId : undefined}>
            {navigationTitle ?? title}
          </p>
        ) : (
          <span aria-hidden="true" />
        )}
        <span aria-hidden="true" />
      </div>
      {showIntro && (
        <div className="form-intro">
          <p className="form-eyebrow">{eyebrow}</p>
          <h2 id={titleId}>{title}</h2>
          <p className="form-description">{description}</p>
        </div>
      )}
      {hero != null && <div data-form-hero>{hero}</div>}
    </header>
  )
}
