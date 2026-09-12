'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { TaskSurface } from '@/components/ui/TaskSurface'
import { InlineError } from '@/components/ui/InlineError'
import { formatArDecimal, parseArDecimalInput } from '@/lib/ar-input'
import type { BudgetItemMetrics } from '@/lib/budgets/types'

type DraftItem = {
  id?: string
  category: string
  amount: string
}

interface Props {
  open: boolean
  mode: 'create' | 'edit'
  currency: 'ARS' | 'USD'
  initialItems: BudgetItemMetrics[]
  availableCategories: string[]
  planId?: string
  onClose: () => void
  onCreate: (items: Array<{ category: string; amount: number }>) => Promise<void>
  onSync: (items: Array<{ id?: string; category: string; amount: number }>) => Promise<void>
  onRequestDelete?: (trigger: HTMLElement) => void
}

export function BudgetEditorSheet({
  open,
  mode,
  currency,
  initialItems,
  availableCategories,
  onClose,
  onCreate,
  onSync,
  onRequestDelete,
}: Props) {
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const categoryRef = useRef<HTMLSelectElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  const normalizedAvailable = useMemo(
    () => availableCategories.filter((category) => category !== 'Pago de Tarjetas'),
    [availableCategories],
  )

  useEffect(() => {
    if (!open) return
    setDraftItems(
      initialItems.length > 0
        ? initialItems.map((item) => ({
            id: item.id,
            category: item.category,
            amount: String(item.amount),
          }))
        : [{ category: normalizedAvailable[0] ?? '', amount: '' }],
    )
    setError(null)
  }, [open, initialItems, normalizedAvailable])

  if (!open) return null

  const handleAddRow = () => {
    setDraftItems((prev) => [...prev, { category: normalizedAvailable[0] ?? '', amount: '' }])
  }

  const handleRemoveRow = (index: number) => {
    setDraftItems((prev) => prev.filter((_, rowIndex) => rowIndex !== index))
  }

  const handleSave = async () => {
    const cleaned = draftItems.map((item) => ({
      id: item.id,
      category: item.category.trim(),
      amount: Number(item.amount),
    }))

    if (cleaned.length === 0) {
      setError('El presupuesto no puede quedar vacío.')
      return
    }

    if (cleaned.some((item) => !item.category || !item.amount || item.amount <= 0)) {
      setError('Completá categoría y monto mayor a cero en todas las filas.')
      return
    }

    const dedupe = new Set<string>()
    for (const item of cleaned) {
      const key = item.category.toLocaleLowerCase('es-AR')
      if (dedupe.has(key)) {
        setError('No puede haber categorías duplicadas en el presupuesto.')
        return
      }
      dedupe.add(key)
    }

    setError(null)
    setIsSaving(true)

    try {
      if (mode === 'create') {
        await onCreate(cleaned.map(({ category, amount }) => ({ category, amount })))
      } else {
        await onSync(cleaned)
      }
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el presupuesto.')
    } finally {
      setIsSaving(false)
    }
  }

  const firstItem = draftItems[0]
  const initialFocusRef = mode === 'create' || !firstItem?.id ? categoryRef : amountRef

  return (
    <TaskSurface open={open} onClose={onClose} eyebrow="PLANIFICAR" title={mode === 'create' ? 'Crear presupuesto' : 'Editar presupuesto'} description={mode === 'create' ? `Definí montos mensuales en ${currency} por categoría.` : 'Ajustá montos, agregá categorías o sacá las que ya no quieras seguir.'} appearance="compact" canvasTone="standard" initialFocusRef={initialFocusRef} footer={(
      <>
        <InlineError message={error} className="mb-3" />
        <button type="button" onClick={() => { void handleSave() }} disabled={isSaving} className="min-h-12 w-full rounded-button bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {isSaving ? 'Guardando...' : 'Guardar presupuesto'}
        </button>
      </>
    )}>
      <h2 className="sr-only">
        {mode === 'create' ? 'Crear presupuesto' : 'Editar presupuesto'}
      </h2>
      <p className="mt-1 text-xs text-text-tertiary">
        {mode === 'create'
          ? `Definí montos mensuales en ${currency} por categoría.`
          : 'Podés ajustar montos, agregar categorías o sacar las que ya no quieras seguir.'}
      </p>

      <div className="mt-5 space-y-3">
        {draftItems.map((item, index) => (
          <div key={`${item.id ?? item.category}-${index}`} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_132px_auto]">
            {mode === 'create' || !item.id ? (
              <select
                ref={index === 0 ? categoryRef : undefined}
                value={item.category}
                onChange={(event) =>
                  setDraftItems((prev) =>
                    prev.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, category: event.target.value } : row,
                    ),
                  )
                }
                className="min-h-11 rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
              >
                {normalizedAvailable.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex min-h-11 items-center rounded-input bg-bg-tertiary px-4 py-3 text-sm font-medium text-text-primary">
                {item.category}
              </div>
            )}

            <input
              ref={index === 0 ? amountRef : undefined}
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={formatArDecimal(item.amount)}
              onChange={(event) =>
                setDraftItems((prev) =>
                  prev.map((row, rowIndex) =>
                    rowIndex === index ? { ...row, amount: parseArDecimalInput(event.target.value, row.amount) } : row,
                  ),
                )
              }
              className="min-h-11 min-w-0 rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
            />

            <button
              type="button"
              onClick={() => handleRemoveRow(index)}
              className="min-h-11 rounded-input border border-border-ocean px-3 text-sm font-semibold text-text-secondary"
            >
              Quitar
            </button>
          </div>
        ))}
      </div>

      {normalizedAvailable.length > draftItems.length ? (
        <button type="button" onClick={handleAddRow} className="mt-4 text-sm font-semibold text-primary">
          Agregar categoría
        </button>
      ) : null}

      {mode === 'edit' && onRequestDelete ? (
        <button type="button" onClick={(event) => onRequestDelete(event.currentTarget)} className="mt-6 w-full rounded-button border border-danger/30 px-4 py-3 text-sm font-semibold text-danger">
          Eliminar presupuesto
        </button>
      ) : null}

    </TaskSurface>
  )
}
