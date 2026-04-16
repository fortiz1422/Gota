'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'

type FieldType = 'name' | 'closing_day' | 'due_day'

interface Props {
  open: boolean
  onClose: () => void
  fieldType: FieldType
  currentValue: string | number | null
  onSave: (value: string | number) => Promise<void>
}

const fieldMeta: Record<FieldType, { label: string; inputType: 'text' | 'number'; placeholder: string }> = {
  name: { label: 'Nombre', inputType: 'text', placeholder: 'Nombre de la tarjeta' },
  closing_day: { label: 'Día de cierre', inputType: 'number', placeholder: '1-31' },
  due_day: { label: 'Día de vencimiento', inputType: 'number', placeholder: '1-31' },
}

export function EditCardFieldModal({ open, onClose, fieldType, currentValue, onSave }: Props) {
  const meta = fieldMeta[fieldType]
  const [value, setValue] = useState(String(currentValue ?? ''))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = (() => {
    if (fieldType === 'name') return value.trim().length > 0
    const n = parseInt(value, 10)
    return !isNaN(n) && n >= 1 && n <= 31
  })()

  const handleSave = async () => {
    if (!isValid || isSaving) return
    setIsSaving(true)
    setError(null)
    try {
      const parsed = fieldType === 'name' ? value.trim() : parseInt(value, 10)
      await onSave(parsed)
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
        <p className="type-label text-text-tertiary">{meta.label}</p>
      </div>

      <div className="space-y-4 pb-24">
        <div className="rounded-[18px] bg-bg-tertiary px-4 py-3.5 focus-within:ring-2 focus-within:ring-primary">
          <input
            type={meta.inputType}
            min={meta.inputType === 'number' ? 1 : undefined}
            max={meta.inputType === 'number' ? 31 : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleSave()}
            placeholder={meta.placeholder}
            autoFocus
            disabled={isSaving}
            className="w-full border-0 bg-transparent text-[16px] font-semibold text-text-primary placeholder:text-text-disabled focus:outline-none disabled:opacity-50"
          />
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
