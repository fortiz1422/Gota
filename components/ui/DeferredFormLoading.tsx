'use client'

import { Modal } from '@/components/ui/Modal'

/** A cold form download stays visible and can be cancelled without losing the page. */
export function DeferredFormLoading({
  onCancel,
  embedded = false,
}: {
  onCancel: () => void
  embedded?: boolean
}) {
  const content = (
    <div className="space-y-4 py-4">
      <p role="status" className="text-sm text-text-secondary">Cargando formulario…</p>
      <button type="button" onClick={onCancel} className="min-h-11 rounded-button border border-border-subtle px-4 text-sm font-semibold text-primary">
        Cancelar
      </button>
    </div>
  )

  return embedded ? content : <Modal open onClose={onCancel} manageFocus>{content}</Modal>
}
