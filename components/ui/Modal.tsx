'use client'

import { createContext, useContext, useEffect, useId, useRef } from 'react'
import { useSurfaceChrome } from './useSurfaceChrome'
import { FullScreenSheet } from './FullScreenSheet'
import { NestedSettingsModalContext } from './NestedSettingsModalContext'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import {
  isTopExternalOverlay,
  setExternalOverlayOpen,
} from '@/lib/ui/overlay-events'

interface ModalProps {
  busy?: boolean
  open: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  closeLabel?: string
  manageFocus?: boolean
  returnFocus?: () => HTMLElement | null
}

const ModalContext = createContext<{
  onClose: () => void
  titleId: string
} | null>(null)

export function ModalHeading({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const context = useContext(ModalContext)
  return (
    <h2 id={context?.titleId} className={className}>
      {children}
    </h2>
  )
}

export function ModalCloseButton({
  label,
  disabled,
}: {
  label: string
  disabled?: boolean
}) {
  const context = useContext(ModalContext)
  return (
    <button
      type="button"
      onClick={context?.onClose}
      disabled={disabled}
      aria-label={label}
      className="form-close form-legacy-close"
    >
      <X size={22} weight="duotone" />
    </button>
  )
}

export function Modal({
  title = 'Editar datos',
  closeLabel = 'Volver',
  ...props
}: ModalProps) {
  const requestClose = () => { if (!props.busy) props.onClose() }
  const nested = useContext(NestedSettingsModalContext)
  const id = useId()
  const initialFocusRef = useRef<HTMLInputElement | null>(null)
  if (!nested)
    return (
      <ModalContext.Provider value={{ onClose: requestClose, titleId: id }}>
        <LegacyModal {...props} onClose={requestClose} titleId={id} />
      </ModalContext.Provider>
    )
  return (
    <FullScreenSheet
      open={props.open}
      onClose={requestClose}
      labelledBy={id}
      initialFocusRef={initialFocusRef}
    >
      <div
        className="p-6"
        ref={(node) => {
          initialFocusRef.current =
            node?.querySelector<HTMLInputElement>(
              'input:not([disabled]):not([type="hidden"])'
            ) ?? null
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id={id} className="text-base font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={requestClose}
            className="text-primary min-h-11 px-3 text-sm"
          >
            {closeLabel}
          </button>
        </div>
        {props.children}
      </div>
    </FullScreenSheet>
  )
}

function LegacyModal({
  open,
  onClose,
  children,
  manageFocus = false,
  returnFocus,
  titleId,
}: ModalProps & { titleId: string }) {
  useSurfaceChrome(open && manageFocus, manageFocus ? 'blue-hero' : undefined)
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const closeRef = useRef(onClose)
  const returnRef = useRef(returnFocus)
  useEffect(() => {
    closeRef.current = onClose
    returnRef.current = returnFocus
  }, [onClose, returnFocus])

  useEffect(() => {
    if (!open || !manageFocus) return
    const panel = contentRef.current
    if (!panel) return
    const before =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    setExternalOverlayOpen(titleId, true)
    const controls = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter(
        (node) =>
          node.getClientRects().length > 0 &&
          getComputedStyle(node).visibility !== 'hidden'
      )
    const frame = requestAnimationFrame(() => {
      const input = panel.querySelector<HTMLElement>('input:not([disabled])')
      ;(input ?? controls()[0] ?? panel).focus({ preventScroll: true })
    })
    const key = (event: KeyboardEvent) => {
      if (!isTopExternalOverlay(titleId)) return
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const nodes = controls(),
        first = nodes[0],
        last = nodes.at(-1)
      if (!first) {
        event.preventDefault()
        panel.focus()
        return
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !panel.contains(document.activeElement))
      ) {
        event.preventDefault()
        last?.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !panel.contains(document.activeElement))
      ) {
        event.preventDefault()
        first.focus()
      }
    }
    const focus = (event: FocusEvent) => {
      if (
        isTopExternalOverlay(titleId) &&
        event.target instanceof Node &&
        !panel.contains(event.target)
      )
        (controls()[0] ?? panel).focus({ preventScroll: true })
    }
    document.addEventListener('keydown', key)
    document.addEventListener('focusin', focus)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', key)
      document.removeEventListener('focusin', focus)
      const restore = isTopExternalOverlay(titleId)
      setExternalOverlayOpen(titleId, false)
      const target = returnRef.current?.() ?? before
      if (restore && target?.isConnected) target.focus({ preventScroll: true })
    }
  }, [open, manageFocus, titleId])

  // Cerrar con Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!manageFocus && e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose, manageFocus])

  // Bloquear scroll del body cuando está abierto
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // Reset scroll al top al abrir (evita jump en iOS al reabrir modal)
  useEffect(() => {
    const t = setTimeout(() => contentRef.current?.scrollTo({ top: 0 }), 50)
    return () => clearTimeout(t)
  }, [])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      {/* Modal */}
      <div
        ref={contentRef}
        data-managed-modal={manageFocus || undefined}
        role={manageFocus ? 'dialog' : undefined}
        aria-modal={manageFocus ? true : undefined}
        aria-labelledby={manageFocus ? titleId : undefined}
        tabIndex={manageFocus ? -1 : undefined}
        className="slide-up sm:rounded-card-lg bg-bg-secondary border-border-ocean relative max-h-[85dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl border p-6"
        style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
