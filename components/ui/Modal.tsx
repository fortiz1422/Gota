'use client'

import { useContext, useEffect, useId, useRef } from 'react'
import { FullScreenSheet } from './FullScreenSheet'
import { NestedSettingsModalContext } from './NestedSettingsModalContext'
import { createPortal } from 'react-dom'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export function Modal(props: ModalProps) {
  const nested = useContext(NestedSettingsModalContext)
  const id = useId()
  const initialFocusRef = useRef<HTMLInputElement | null>(null)
  if (!nested) return <LegacyModal {...props} />
  return <FullScreenSheet open={props.open} onClose={props.onClose} labelledBy={id} initialFocusRef={initialFocusRef}>
    <div className="p-6" ref={(node) => { initialFocusRef.current = node?.querySelector<HTMLInputElement>('input:not([disabled]):not([type="hidden"])') ?? null }}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id={id} className="text-base font-semibold">Editar datos</h2>
        <button type="button" onClick={props.onClose} className="min-h-11 px-3 text-sm text-primary">Volver</button>
      </div>
      {props.children}
    </div>
  </FullScreenSheet>
}

function LegacyModal({ open, onClose, children }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Cerrar con Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

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
        className="slide-up relative w-full max-w-md max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-3xl sm:rounded-card-lg bg-bg-secondary border border-border-ocean p-6"
        style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
