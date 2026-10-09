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
  appearance?: 'brand' | 'compact' | 'minimal'
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
  const minimal = appearance === 'minimal'
  const compact = appearance !== 'brand'

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
      <div
        data-confirmation-surface
        data-confirmation-appearance={appearance}
        className={`flex h-full min-h-0 flex-col ${compact ? 'bg-bg-secondary' : ''}`}
      >
        {compact ? (
          <>
            <header
              className="border-border-subtle bg-bg-primary/95 grid shrink-0 grid-cols-[44px_1fr_44px] items-center border-b px-[14px] pb-2 backdrop-blur-xl"
              style={{ paddingTop: 'max(8px, env(safe-area-inset-top))' }}
            >
              <button
                ref={cancelRef}
                type="button"
                onClick={onClose}
                disabled={busy}
                aria-label={`Cerrar ${title}`}
                className="text-text-secondary hover:bg-primary-soft flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-50"
              >
                <X size={20} weight="light" />
              </button>
              {minimal ? (
                <h2
                  id={titleId}
                  className="text-text-primary px-2 text-center text-[15px] font-semibold"
                >
                  {title}
                </h2>
              ) : (
                <p className="text-text-primary truncate px-2 text-center text-[15px] font-semibold">
                  Confirmar
                </p>
              )}
              <div aria-hidden="true" />
            </header>
            <div className="shrink-0 px-[22px] pt-5 pb-5">
              {!minimal && (
                <>
                  <p
                    className={`type-micro ${destructive ? 'text-danger' : 'text-primary'}`}
                  >
                    {eyebrow}
                  </p>
                  <h2
                    id={titleId}
                    className="type-title text-text-primary mt-1"
                  >
                    {title}
                  </h2>
                </>
              )}
              <p className="type-body text-text-tertiary mt-2">{description}</p>
            </div>
          </>
        ) : (
          <BlueHeaderZone className="relative shrink-0 rounded-b-[30px] px-5 pt-4 pb-6 text-white">
            <button
              ref={cancelRef}
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label={`Cerrar ${title}`}
              className="absolute top-4 left-4 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white disabled:opacity-50"
            >
              <X size={20} weight="light" />
            </button>
            <div className="pl-14">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-white/70 uppercase">
                {eyebrow}
              </p>
              <h2
                id={titleId}
                className="mt-1 text-2xl leading-none font-semibold"
              >
                {title}
              </h2>
              <p className="mt-2 max-w-[31rem] text-base leading-6 text-white/80">
                {description}
              </p>
            </div>
          </BlueHeaderZone>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {minimal ? (
            children
          ) : (
            <div
              className={`rounded-card border px-4 py-4 ${destructive ? 'border-danger/25 bg-danger/8' : 'border-warning/25 bg-warning/8'}`}
            >
              <Warning
                size={22}
                weight="duotone"
                className={destructive ? 'text-danger' : 'text-warning'}
              />
              {children ? (
                <div className="text-text-secondary mt-3 text-sm leading-6">
                  {children}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <footer
          className={`border-border-subtle bg-bg-primary shrink-0 border-t px-5 pt-3 ${compact ? 'pb-[max(12px,env(safe-area-inset-bottom))]' : 'pb-[calc(env(safe-area-inset-bottom)+16px)]'}`}
        >
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-button min-h-12 w-full text-sm font-semibold text-white disabled:opacity-50 ${destructive ? 'bg-danger' : 'bg-primary'}`}
          >
            {busy ? 'Procesando…' : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-button text-text-secondary mt-2 min-h-11 w-full text-sm font-semibold disabled:opacity-50"
          >
            Cancelar
          </button>
        </footer>
      </div>
    </FullScreenSheet>
  )
}
