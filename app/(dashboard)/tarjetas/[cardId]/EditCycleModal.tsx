'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'

interface Props {
  open: boolean
  onClose: () => void
  closingDay: number | null
  dueDay: number | null
  onSave: (closingDay: number, dueDay: number) => Promise<void>
}

export function EditCycleModal({ open, onClose, closingDay, dueDay, onSave }: Props) {
  const [closingValue, setClosingValue] = useState(String(closingDay ?? ''))
  const [dueValue, setDueValue] = useState(String(dueDay ?? ''))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parseDay = (v: string) => {
    const n = parseInt(v, 10)
    return !isNaN(n) && n >= 1 && n <= 31 ? n : null
  }

  const closingN = parseDay(closingValue)
  const dueN = parseDay(dueValue)
  const isValid = closingN !== null && dueN !== null

  const handleSave = async () => {
    if (!isValid || isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      await onSave(closingN!, dueN!)
      onClose()
    } catch {
      setError('No se pudo guardar. Intentá de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />

      <div className="mb-5">
        <p className="type-label text-text-tertiary">Ciclo de facturación</p>
      </div>

      <div className="space-y-3 pb-24">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="block type-meta text-text-secondary">Día de cierre</span>
            <div className="rounded-[18px] bg-bg-tertiary px-4 py-3.5 focus-within:ring-2 focus-within:ring-primary">
              <input
                type="number"
                min={1}
                max={31}
                value={closingValue}
                onChange={(e) => setClosingValue(e.target.value)}
                placeholder="1–31"
                autoFocus
                disabled={isSaving}
                className="w-full border-0 bg-transparent text-[16px] font-semibold text-text-primary placeholder:text-text-disabled focus:outline-none disabled:opacity-50"
              />
            </div>
          </label>
          <label className="space-y-1.5">
            <span className="block type-meta text-text-secondary">Día de vencimiento</span>
            <div className="rounded-[18px] bg-bg-tertiary px-4 py-3.5 focus-within:ring-2 focus-within:ring-primary">
              <input
                type="number"
                min={1}
                max={31}
                value={dueValue}
                onChange={(e) => setDueValue(e.target.value)}
                placeholder="1–31"
                disabled={isSaving}
                className="w-full border-0 bg-transparent text-[16px] font-semibold text-text-primary placeholder:text-text-disabled focus:outline-none disabled:opacity-50"
              />
            </div>
          </label>
        </div>

        {error && (
          <div className="rounded-card bg-danger-soft px-4 py-3 type-meta text-danger">
            {error}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 -mx-6 -mb-6 bg-bg-secondary px-6 pb-6 pt-4">
        <button
          onClick={() => void handleSave()}
          disabled={!isValid || isSaving}
          className="w-full rounded-button bg-primary py-3 text-[14px] font-semibold text-white disabled:opacity-40"
        >
          {isSaving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </Modal>
  )
}
