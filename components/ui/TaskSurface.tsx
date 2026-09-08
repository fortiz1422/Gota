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
  initialFocusRef?: RefObject<HTMLElement | null>
  triggerRef?: RefObject<HTMLElement | null>
}

export function TaskSurface({
  open,
  onClose,
  eyebrow,
  title,
  description,
  children,
  footer,
  initialFocusRef,
  triggerRef,
}: TaskSurfaceProps) {
  const titleId = useId()

  return (
    <FullScreenSheet
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      extendIntoTopSafeArea
      initialFocusRef={initialFocusRef}
      triggerRef={triggerRef}
    >
      <div data-task-surface className="flex h-full min-h-0 flex-col bg-bg-primary">
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

        <div data-task-scroll className="relative -mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-[22px] pb-8 pt-4">
          {children}
        </div>

        <div data-task-footer className="shrink-0 border-t border-border-subtle bg-bg-primary px-[22px] pb-5 pt-3 shadow-[0_-4px_14px_rgba(13,24,41,0.05)]">
          {footer}
        </div>
      </div>
    </FullScreenSheet>
  )
}