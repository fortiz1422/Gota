'use client'

import { useId, type ReactNode, type RefObject } from 'react'
import { X } from '@phosphor-icons/react'
import { BlueHeaderZone } from './BlueHeaderZone'
import { FullScreenSheet } from './FullScreenSheet'

interface TaskSurfaceProps {
  open: boolean
  onClose: () => void
  eyebrow: string
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
  appearance?: 'brand' | 'compact'
  navigationTitle?: string
  initialFocusRef?: RefObject<HTMLElement | null>
  triggerRef?: RefObject<HTMLElement | null>
  triggerElement?: HTMLElement | null
}

export function TaskSurface({
  open,
  onClose,
  eyebrow,
  title,
  description,
  children,
  footer,
  appearance = 'brand',
  navigationTitle,
  initialFocusRef,
  triggerRef,
  triggerElement,
}: TaskSurfaceProps) {
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
      <div
        data-task-surface
        data-task-appearance={appearance}
        className={`flex h-full min-h-0 flex-col ${compact ? 'bg-bg-secondary' : 'bg-bg-primary'}`}
      >
        {compact ? (
          <>
            <header
              data-task-header="compact"
              className="grid shrink-0 grid-cols-[44px_1fr_44px] items-center border-b border-border-subtle bg-bg-primary/95 px-[14px] pb-2 backdrop-blur-xl"
              style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}
            >
              <button
                type="button"
                onClick={onClose}
                aria-label={`Cerrar ${navigationTitle ?? title}`}
                className="flex h-11 w-11 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-primary-soft active:bg-primary/10"
              >
                <X size={20} weight="light" />
              </button>
              <p className="truncate px-2 text-center text-[15px] font-semibold text-text-primary">
                {navigationTitle ?? title}
              </p>
              <div aria-hidden="true" />
            </header>
            <div data-task-intro className="shrink-0 px-[22px] pb-5 pt-5">
              <p className="type-micro text-primary">{eyebrow}</p>
              <h2 id={titleId} className="mt-1 type-title text-text-primary">{title}</h2>
              <p className="mt-2 type-body text-text-tertiary">{description}</p>
            </div>
          </>
        ) : (
          <BlueHeaderZone
            className="shrink-0 px-[14px] pb-8 text-white"
            style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
          >
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={onClose}
                aria-label={`Cerrar ${title}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 active:bg-white/15"
              >
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

        <div
          data-task-scroll
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-[22px] pb-8 ${compact ? 'pt-0' : 'relative -mt-4 pt-4'}`}
        >
          {children}
        </div>

        <div
          data-task-footer
          className={`shrink-0 border-t border-border-subtle bg-bg-primary/95 px-[22px] pt-3 shadow-[0_-4px_14px_rgba(13,24,41,0.05)] backdrop-blur-xl ${compact ? 'pb-[max(12px,env(safe-area-inset-bottom))]' : 'pb-5'}`}
        >
          {footer}
        </div>
      </div>
    </FullScreenSheet>
  )
}
