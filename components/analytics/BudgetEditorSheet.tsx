'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
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
  onDelete?: () => Promise<void>
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
  onDelete,
}: Props) {
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

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
      if (mode === 'edit' && onDelete) {
        setError(null)
        setIsSaving(true)
        try {
          await onDelete()
          onClose()
        } catch (deleteError) {
          setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar el presupuesto.')
        } finally {
          setIsSaving(false)
        }
      } else {
        setError('El presupuesto no puede quedar vacío.')
      }
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

  return (
    <Modal open={open} onClose={onClose}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />
      <h2 className="text-lg font-semibold text-text-primary">
        {mode === 'create' ? 'Crear presupuesto' : 'Editar presupuesto'}
      </h2>
      <p className="mt-1 text-xs text-text-tertiary">
        {mode === 'create'
          ? `Definí montos mensuales en ${currency} por categoría.`
          : 'Podés ajustar montos, agregar categorías o sacar las que ya no quieras seguir.'}
      </p>

      <div className="mt-5 space-y-3">
        {draftItems.map((item, index) => (
          <div key={`${item.id ?? item.category}-${index}`} className="grid grid-cols-[1fr_132px_auto] gap-2">
            {mode === 'create' || !item.id ? (
              <select
                value={item.category}
                onChange={(event) =>
                  setDraftItems((prev) =>
                    prev.map((row, rowIndex) =>
                      rowIndex === index ? { ...row, category: event.target.value } : row,
                    ),
                  )
                }
                className="rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
              >
                {normalizedAvailable.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-input bg-bg-tertiary px-4 py-3 text-sm font-medium text-text-primary">
                {item.category}
              </div>
            )}

            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={item.amount}
              onChange={(event) =>
                setDraftItems((prev) =>
                  prev.map((row, rowIndex) =>
                    rowIndex === index ? { ...row, amount: event.target.value } : row,
                  ),
                )
              }
              className="rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
            />

            <button
              type="button"
              onClick={() => handleRemoveRow(index)}
              className="rounded-input border border-border-ocean px-3 text-sm font-semibold text-text-secondary"
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

      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-button border border-border-ocean px-4 py-3 text-sm font-semibold text-text-primary"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className={`flex-1 rounded-button px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 ${
            mode === 'edit' && draftItems.length === 0
              ? 'bg-danger'
              : 'bg-primary'
          }`}
        >
          {isSaving
            ? mode === 'edit' && draftItems.length === 0
              ? 'Eliminando...'
              : 'Guardando...'
            : mode === 'edit' && draftItems.length === 0
              ? 'Eliminar presupuesto'
              : 'Guardar'}
        </button>
      </div>
    </Modal>
  )
}
