'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { CATEGORIES } from '@/lib/validation/schemas'
import { formatDate } from '@/lib/format'
import type { Card } from '@/types/database'

type Duplicate = { id: string; description: string; created_at: string }

interface ParsedData {
  amount: number
  currency: 'ARS' | 'USD'
  category: string
  description: string
  is_want: boolean | null
  payment_method: 'CASH' | 'DEBIT' | 'TRANSFER' | 'CREDIT'
  card_id: string | null
  date: string
}

interface ParsePreviewProps {
  data: ParsedData
  cards: Card[]
  onSave: () => void
  onCancel: () => void
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  DEBIT: 'Débito',
  TRANSFER: 'Transferencia',
  CREDIT: 'Crédito',
}

function toDateInput(isoString: string): string {
  try {
    return isoString.split('T')[0]
  } catch {
    return new Date().toISOString().split('T')[0]
  }
}

function fromDateInput(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toISOString()
}

export function ParsePreview({
  data,
  cards,
  onSave,
  onCancel,
}: ParsePreviewProps) {
  const [form, setForm] = useState<ParsedData>({
    ...data,
    date: toDateInput(data.date),
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [cardError, setCardError] = useState(false)
  const [duplicatesChecked, setDuplicatesChecked] = useState(false)
  const [foundDuplicates, setFoundDuplicates] = useState<Duplicate[]>([])

  const isPagoTarjetas = form.category === 'Pago de Tarjetas'
  const needsCard =
    form.payment_method === 'CREDIT' || isPagoTarjetas

  const set = <K extends keyof ParsedData>(key: K, value: ParsedData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key === 'card_id') setCardError(false)
    if (key === 'amount' || key === 'category' || key === 'date') {
      setDuplicatesChecked(false)
      setFoundDuplicates([])
    }
  }

  const handleSave = async () => {
    if (needsCard && !form.card_id) {
      setCardError(true)
      return
    }

    if (!duplicatesChecked) {
      setIsChecking(true)
      try {
        const params = new URLSearchParams({
          amount: String(form.amount),
          category: form.category,
          date: form.date,
        })
        const res = await fetch(`/api/expenses/duplicates?${params}`)
        const data = await res.json()
        const dupes: Duplicate[] = data.duplicates ?? []
        setFoundDuplicates(dupes)
        setDuplicatesChecked(true)
        if (dupes.length > 0) return
      } catch {
        // on network error, skip duplicate check and proceed
        setDuplicatesChecked(true)
      } finally {
        setIsChecking(false)
      }
    }

    setIsSaving(true)
    try {
      const payload = {
        ...form,
        date: fromDateInput(form.date),
        is_want: isPagoTarjetas ? null : form.is_want,
      }

      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error('Error al guardar')
      onSave()
    } catch {
      alert('No se pudo guardar el gasto. Intentá de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal open onClose={onCancel}>
      {/* Handle bar */}
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />

      <h2 className="text-lg font-semibold text-text-primary">
        Confirmar gasto
      </h2>
      <p className="mb-5 mt-1 text-xs text-text-tertiary">
        Revisá los datos antes de guardar
      </p>

      <div className="space-y-5">
        {/* Monto + Moneda */}
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Monto
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => set('amount', Number(e.target.value))}
              className="flex-1 rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
            />
            <div className="flex rounded-input bg-bg-tertiary p-1">
              {(['ARS', 'USD'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => set('currency', c)}
                  className={`rounded-button px-3 py-1.5 text-sm font-medium transition-colors ${
                    form.currency === c
                      ? 'bg-primary text-bg-primary'
                      : 'text-text-secondary'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Categoría */}
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Categoría
          </label>
          <select
            value={form.category}
            onChange={(e) => {
              set('category', e.target.value)
              if (e.target.value !== 'Pago de Tarjetas' && form.is_want === null) {
                set('is_want', false)
              }
            }}
            className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Medio de pago */}
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Medio de pago
          </label>
          <select
            value={form.payment_method}
            onChange={(e) => {
              set(
                'payment_method',
                e.target.value as ParsedData['payment_method']
              )
              if (e.target.value !== 'CREDIT') set('card_id', null)
            }}
            className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
          >
            {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Tarjeta (condicional) */}
        {needsCard && (
          <div>
            <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
              Tarjeta{' '}
              <span className="text-danger">*</span>
            </label>
            <select
              value={form.card_id ?? ''}
              onChange={(e) =>
                set('card_id', e.target.value || null)
              }
              className={`w-full rounded-input border bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:outline-none ${
                cardError
                  ? 'border-danger bg-danger/5 focus:border-danger'
                  : 'border-transparent focus:border-primary'
              }`}
            >
              <option value="">— Seleccioná una tarjeta —</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
            {cardError && (
              <p className="mt-1 text-[11px] text-danger">
                ⚠️ Seleccioná una tarjeta
              </p>
            )}
          </div>
        )}

        {/* Fecha */}
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Fecha
          </label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
          />
        </div>

        {/* Need / Want (oculto para Pago de Tarjetas) */}
        {!isPagoTarjetas && (
          <div>
            <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
              ¿Necesidad o deseo?
            </label>
            <div className="flex rounded-input bg-bg-tertiary p-1">
              <button
                onClick={() => set('is_want', false)}
                className={`flex-1 rounded-button py-2 text-sm font-medium transition-colors ${
                  form.is_want === false
                    ? 'bg-success text-bg-primary'
                    : 'text-text-secondary'
                }`}
              >
                Necesidad
              </button>
              <button
                onClick={() => set('is_want', true)}
                className={`flex-1 rounded-button py-2 text-sm font-medium transition-colors ${
                  form.is_want === true
                    ? 'bg-want text-bg-primary'
                    : 'text-text-secondary'
                }`}
              >
                Deseo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Duplicate warning */}
      {duplicatesChecked && foundDuplicates.length > 0 && (
        <div className="mt-5 rounded-input bg-warning/10 p-3">
          <p className="mb-2 text-xs font-medium text-warning">
            Posible gasto duplicado:
          </p>
          <ul className="mb-2 space-y-1">
            {foundDuplicates.map((d) => (
              <li key={d.id} className="text-xs text-text-secondary">
                · {d.description}{' '}
                <span className="text-text-tertiary">({formatDate(d.created_at)})</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-text-tertiary">
            Si es un gasto distinto, guardalo de todas formas.
          </p>
        </div>
      )}

      {/* Botones */}
      <div className="mt-6 flex flex-col gap-2">
        <button
          onClick={handleSave}
          disabled={isSaving || isChecking}
          className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-bg-primary transition-transform active:scale-95 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isChecking
            ? 'Verificando...'
            : isSaving
              ? 'Guardando...'
              : duplicatesChecked && foundDuplicates.length > 0
                ? 'Guardar de todas formas'
                : 'Guardar gasto ✓'}
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="w-full rounded-button py-3 text-sm text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
        >
          Cancelar
        </button>
      </div>
    </Modal>
  )
}
