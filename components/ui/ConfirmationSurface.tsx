'use client'

import { useId, useRef, type ReactNode } from 'react'
import { Warning, X } from '@phosphor-icons/react'
import { BlueHeaderZone } from './BlueHeaderZone'
import { FullScreenSheet } from './FullScreenSheet'

interface ConfirmationSurfaceProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  triggerElement?: HTMLElement | null
  eyebrow?: string
  title: string
  description: string
  confirmLabel: string
  busy?: boolean
  destructive?: boolean
  children?: ReactNode
  appearance?: 'brand' | 'compact'
}

export function ConfirmationSurface({
  open,
  onClose,
  onConfirm,
  triggerElement,
  eyebrow = 'CONFIRMACIÓN',
  title,
  description,
  confirmLabel,
  busy = false,
  destructive = false,
  children,
  appearance = 'brand',
}: ConfirmationSurfaceProps) {
  const id = useId()
  const titleId = `${id}-title`
  const cancelRef = useRef<HTMLButtonElement>(null)
  const compact = appearance === 'compact'

  return (
    <FullScreenSheet
      open={open}
      onClose={busy ? () => undefined : onClose}
      labelledBy={titleId}
      initialFocusRef={cancelRef}
      triggerElement={triggerElement}
      extendIntoTopSafeArea
      extendIntoBottomSafeArea={compact}
      fillAvailableHeight={compact}
    >
      <div data-confirmation-surface data-confirmation-appearance={appearance} className={`flex h-full min-h-0 flex-col ${compact ? 'bg-bg-secondary' : ''}`}>
        {compact ? (
          <>
            <header className="grid shrink-0 grid-cols-[44px_1fr_44px] items-center border-b border-border-subtle bg-bg-primary/95 px-[14px] pb-2 backdrop-blur-xl" style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
              <button ref={cancelRef} type="button" onClick={onClose} disabled={busy} aria-label={`Cerrar ${title}`} className="flex h-11 w-11 items-center justify-center rounded-full text-text-secondary hover:bg-primary-soft disabled:opacity-50">
                <X size={20} weight="light" />
              </button>
              <p className="truncate px-2 text-center text-[15px] font-semibold text-text-primary">Confirmar</p>
              <div aria-hidden="true" />
            </header>
            <div className="shrink-0 px-[22px] pb-5 pt-5">
              <p className={`type-micro ${destructive ? 'text-danger' : 'text-primary'}`}>{eyebrow}</p>
              <h2 id={titleId} className="mt-1 type-title text-text-primary">{title}</h2>
              <p className="mt-2 type-body text-text-tertiary">{description}</p>
            </div>
          </>
        ) : (
        <BlueHeaderZone className="relative shrink-0 rounded-b-[30px] px-5 pb-6 pt-4 text-white">
          <button ref={cancelRef} type="button" onClick={onClose} disabled={busy} aria-label={`Cerrar ${title}`} className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white disabled:opacity-50">
            <X size={20} weight="light" />
          </button>
          <div className="pl-14">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">{eyebrow}</p>
            <h2 id={titleId} className="mt-1 text-2xl font-semibold leading-none">{title}</h2>
            <p className="mt-2 max-w-[31rem] text-base leading-6 text-white/80">{description}</p>
          </div>
        </BlueHeaderZone>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <div className={`rounded-card border px-4 py-4 ${destructive ? 'border-danger/25 bg-danger/8' : 'border-warning/25 bg-warning/8'}`}>
            <Warning size={22} weight="duotone" className={destructive ? 'text-danger' : 'text-warning'} />
            {children ? <div className="mt-3 text-sm leading-6 text-text-secondary">{children}</div> : null}
          </div>
        </div>

        <footer className={`shrink-0 border-t border-border-subtle bg-bg-primary px-5 pt-3 ${compact ? 'pb-[max(12px,env(safe-area-inset-bottom))]' : 'pb-[calc(env(safe-area-inset-bottom)+16px)]'}`}>
          <button type="button" onClick={onConfirm} disabled={busy} className={`min-h-12 w-full rounded-button text-sm font-semibold text-white disabled:opacity-50 ${destructive ? 'bg-danger' : 'bg-primary'}`}>
            {busy ? 'Procesando…' : confirmLabel}
          </button>
          <button type="button" onClick={onClose} disabled={busy} className="mt-2 min-h-11 w-full rounded-button text-sm font-semibold text-text-secondary disabled:opacity-50">Cancelar</button>
        </footer>
      </div>
    </FullScreenSheet>
  )
}
