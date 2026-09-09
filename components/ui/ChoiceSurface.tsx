'use client'

import { useId, type ReactNode, type RefObject } from 'react'
import { X } from '@phosphor-icons/react'
import { BlueHeaderZone } from './BlueHeaderZone'
import { FullScreenSheet } from './FullScreenSheet'

interface ChoiceSurfaceProps {
  open: boolean
  onClose: () => void
  eyebrow: string
  title: string
  description: string
  children: ReactNode
  appearance?: 'brand' | 'compact'
  initialFocusRef?: RefObject<HTMLElement | null>
  triggerRef?: RefObject<HTMLElement | null>
  triggerElement?: HTMLElement | null
}

export function ChoiceSurface({
  open,
  onClose,
  eyebrow,
  title,
  description,
  children,
  appearance = 'brand',
  initialFocusRef,
  triggerRef,
  triggerElement,
}: ChoiceSurfaceProps) {
  const titleId = useId()
  const compact = appearance === 'compact'

  return (
    <FullScreenSheet
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      extendIntoTopSafeArea
      extendIntoBottomSafeArea={compact}
      fillAvailableHeight={compact}
      initialFocusRef={initialFocusRef}
      triggerRef={triggerRef}
      triggerElement={triggerElement}
    >
      <div data-choice-surface data-choice-appearance={appearance} className={`flex h-full min-h-0 flex-col ${compact ? 'bg-bg-secondary' : 'bg-bg-primary'}`}>
        {compact ? (
          <>
            <header className="grid shrink-0 grid-cols-[44px_1fr_44px] items-center border-b border-border-subtle bg-bg-primary/95 px-[14px] pb-2 backdrop-blur-xl" style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
              <button type="button" onClick={onClose} aria-label={`Cerrar ${title}`} className="flex h-11 w-11 items-center justify-center rounded-full text-text-secondary hover:bg-primary-soft">
                <X size={20} weight="light" />
              </button>
              <p className="truncate px-2 text-center text-[15px] font-semibold text-text-primary">{title}</p>
              <div aria-hidden="true" />
            </header>
            <div className="shrink-0 px-[22px] pb-5 pt-5">
              <p className="type-micro text-primary">{eyebrow}</p>
              <h2 id={titleId} className="mt-1 type-title text-text-primary">{title}</h2>
              <p className="mt-2 type-body text-text-tertiary">{description}</p>
            </div>
          </>
        ) : (
        <BlueHeaderZone className="shrink-0 px-[14px] pb-8 text-white" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
          <div className="flex items-start gap-2">
            <button type="button" onClick={onClose} aria-label={`Cerrar ${title}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/10">
              <X size={20} weight="light" />
            </button>
            <div className="min-w-0 flex-1 px-1 pt-1.5">
              <p className="type-micro text-white/65">{eyebrow}</p>
              <h2 id={titleId} className="mt-1 type-title text-white">{title}</h2>
              <p className="mt-2 type-body text-white/75">{description}</p>
            </div>
            <div className="h-11 w-5 shrink-0" aria-hidden="true" />
          </div>
        </BlueHeaderZone>
        )}
        <div data-choice-scroll className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-[22px] pb-8 ${compact ? 'pt-0' : 'relative -mt-4 pt-4'}`}>
          {children}
        </div>
      </div>
    </FullScreenSheet>
  )
}
