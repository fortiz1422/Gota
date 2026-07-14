'use client'

import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import {
  isTopExternalOverlay,
  setExternalOverlayOpen,
} from '@/lib/ui/overlay-events'
import { acquireScrollLock, releaseScrollLock } from '@/lib/ui/scroll-lock'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const subscribeToHydration = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

interface FullScreenSheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  labelledBy: string
  triggerRef?: RefObject<HTMLElement | null>
  triggerElement?: HTMLElement | null
  initialFocusRef?: RefObject<HTMLElement | null>
}

function getFocusableElements(panel: HTMLElement): HTMLElement[] {
  return Array.from(
    panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter((element) => {
    if (element.getClientRects().length === 0) return false

    let current: HTMLElement | null = element
    while (current) {
      if (
        current.getAttribute('aria-hidden') === 'true' ||
        current.hasAttribute('inert')
      ) {
        return false
      }

      const style = window.getComputedStyle(current)
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.visibility === 'collapse'
      ) {
        return false
      }

      if (current === panel) break
      current = current.parentElement
    }

    return true
  })
}

export function FullScreenSheet({
  open,
  onClose,
  children,
  labelledBy,
  triggerRef,
  triggerElement,
  initialFocusRef,
}: FullScreenSheetProps) {
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot
  )
  const overlayRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const overlayId = useId()
  // La asignación en render elimina la ventana stale antes de que corra un effect.
  // eslint-disable-next-line react-hooks/refs
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open || !mounted) return

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const returnTarget =
      triggerRef?.current ?? triggerElement ?? previouslyFocused
    const layer = setExternalOverlayOpen(overlayId, true)
    if (overlayRef.current && layer !== null) {
      overlayRef.current.style.zIndex = String(70 + layer * 2)
    }
    acquireScrollLock(overlayId)

    const focusFrame = window.requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel || !isTopExternalOverlay(overlayId)) return

      const requestedFocus = initialFocusRef?.current
      const focusable = getFocusableElements(panel)
      const focusTarget =
        requestedFocus && focusable.includes(requestedFocus)
          ? requestedFocus
          : (focusable[0] ?? panel)
      focusTarget.focus({ preventScroll: true })
    })

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (!isTopExternalOverlay(overlayId)) return

      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return

      const focusable = getFocusableElements(panel)
      if (focusable.length === 0) {
        event.preventDefault()
        panel.focus({ preventScroll: true })
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeElement = document.activeElement

      if (
        event.shiftKey &&
        (activeElement === first || !panel.contains(activeElement))
      ) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey &&
        (activeElement === last || !panel.contains(activeElement))
      ) {
        event.preventDefault()
        first.focus()
      }
    }

    function handleFocusIn(event: FocusEvent) {
      if (!isTopExternalOverlay(overlayId)) return

      const panel = panelRef.current
      const target = event.target
      if (!panel || !(target instanceof Node) || panel.contains(target)) return

      const focusTarget = getFocusableElements(panel)[0] ?? panel
      focusTarget.focus({ preventScroll: true })
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', handleFocusIn)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', handleFocusIn)
      const shouldRestoreFocus = isTopExternalOverlay(overlayId)
      setExternalOverlayOpen(overlayId, false)
      releaseScrollLock(overlayId)

      if (shouldRestoreFocus && returnTarget?.isConnected) {
        returnTarget.focus({ preventScroll: true })
      }
    }
  }, [initialFocusRef, mounted, open, overlayId, triggerElement, triggerRef])

  if (!mounted || !open) return null

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[70] flex items-stretch justify-center sm:items-center sm:px-4 sm:py-[4dvh]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[color:var(--color-backdrop)]"
        onClick={() => {
          if (isTopExternalOverlay(overlayId)) onCloseRef.current()
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="slide-up relative z-[71] box-border h-[100dvh] w-full overflow-y-auto overscroll-contain bg-[color:var(--color-bg-secondary)] shadow-lg sm:h-[92dvh] sm:max-h-[92dvh] sm:max-w-md sm:rounded-[22px] sm:border sm:border-[color:var(--color-border-ocean)]"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
