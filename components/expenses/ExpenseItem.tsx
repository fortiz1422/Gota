'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { CATEGORIES } from '@/lib/validation/schemas'
import { formatAmount, formatDate, dateInputToISO } from '@/lib/format'
import type { Expense, Card } from '@/types/database'

interface Props {
  expense: Expense
  cards: Card[]
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  DEBIT: 'Débito',
  TRANSFER: 'Transferencia',
  CREDIT: 'Crédito',
}

export function ExpenseItem({ expense, cards }: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [description, setDescription] = useState(expense.description)
  const [amount, setAmount] = useState(String(expense.amount))
  const [currency, setCurrency] = useState(expense.currency)
  const [category, setCategory] = useState(expense.category)
  const [paymentMethod, setPaymentMethod] = useState(expense.payment_method)
  const [cardId, setCardId] = useState(expense.card_id ?? '')
  const [date, setDate] = useState(expense.date.substring(0, 10))
  const [isWant, setIsWant] = useState(expense.is_want)

  const containerRef = useRef<HTMLDivElement>(null)

  const isDirty =
    description !== expense.description ||
    Number(amount) !== expense.amount ||
    currency !== expense.currency ||
    category !== expense.category ||
    paymentMethod !== expense.payment_method ||
    (cardId || null) !== expense.card_id ||
    date !== expense.date.substring(0, 10) ||
    isWant !== expense.is_want

  const handleSave = useCallback(async () => {
    if (isSaving) return
    if (!isDirty) {
      setExpanded(false)
      setError(null)
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          amount: Number(amount),
          currency,
          category,
          payment_method: paymentMethod,
          card_id: cardId || null,
          date: dateInputToISO(date),
          is_want: isWant,
        }),
      })
      if (!res.ok) throw new Error()
      setExpanded(false)
      setIsSaving(false)
      router.refresh()
    } catch {
      setError('Error al guardar. Intentá de nuevo.')
      setIsSaving(false)
    }
  }, [isSaving, isDirty, expense.id, description, amount, currency, category, paymentMethod, cardId, date, isWant, router])

  const saveRef = useRef(handleSave)
  useEffect(() => { saveRef.current = handleSave }, [handleSave])

  useEffect(() => {
    if (!expanded) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        saveRef.current()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [expanded])

  const handleDelete = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      setError('Error al eliminar.')
      setIsSaving(false)
      setConfirmDelete(false)
    }
  }

  const isPagoTarjetas = expense.category === 'Pago de Tarjetas'

  return (
    <div ref={containerRef}>
      {/* Collapsed row — cardless */}
      <div
        onClick={() => {
          if (expanded) {
            handleSave()
          } else {
            setExpanded(true)
            setError(null)
          }
        }}
        className="flex cursor-pointer items-center gap-3 py-[13px] border-b border-border-subtle transition-colors"
      >
        <CategoryIcon category={expense.category} size={16} container />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-text-primary">
            {expense.description || expense.category}
          </p>
          <p className="text-xs text-text-tertiary">
            {expense.category} · {formatDate(expense.date)}
            {expense.installment_number != null && expense.installment_total != null && (
              <span className="ml-1 text-[10px] text-text-disabled">
                · Cuota {expense.installment_number}/{expense.installment_total}
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-medium ${isPagoTarjetas ? 'text-primary' : 'text-text-primary'}`}>
            {formatAmount(expense.amount, expense.currency)}
          </p>
          {expense.currency === 'USD' && (
            <span className="text-[10px] text-warning">USD</span>
          )}
        </div>
      </div>

      {/* Expanded edit form */}
      {expanded && (
        <div className="space-y-3 border-b border-border-subtle bg-bg-secondary p-3">
          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                Descripción
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-input border border-transparent bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                Monto
              </label>
              <div className="flex gap-1">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="min-w-0 flex-1 rounded-input border border-transparent bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
                />
                <button
                  onClick={() => setCurrency((c) => (c === 'ARS' ? 'USD' : 'ARS'))}
                  className="rounded-input bg-bg-tertiary px-2 py-2 text-[10px] font-semibold text-text-secondary"
                >
                  {currency}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-input border border-transparent bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                Medio de pago
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as 'CASH' | 'DEBIT' | 'TRANSFER' | 'CREDIT')}
                className="w-full rounded-input border border-transparent bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
              >
                {Object.entries(PAYMENT_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {(paymentMethod === 'CREDIT' || category === 'Pago de Tarjetas') && (
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                Tarjeta
              </label>
              <select
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                className="w-full rounded-input border border-transparent bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
              >
                <option value="">— seleccioná —</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                Fecha
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-input border border-transparent bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                Tipo
              </label>
              <div className="flex h-[38px] items-center gap-2">
                <button
                  onClick={() => setIsWant(false)}
                  className={`rounded-button px-3 py-1.5 text-xs font-medium transition-colors ${
                    isWant === false ? 'bg-success/20 text-success' : 'bg-bg-tertiary text-text-secondary'
                  }`}
                >
                  Necesidad
                </button>
                <button
                  onClick={() => setIsWant(true)}
                  className={`rounded-button px-3 py-1.5 text-xs font-medium transition-colors ${
                    isWant === true ? 'bg-want/20 text-want' : 'bg-bg-tertiary text-text-secondary'
                  }`}
                >
                  Deseo
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {confirmDelete ? (
              <>
                <p className="flex-1 text-xs text-text-secondary">
                  {expense.installment_group_id
                    ? `¿Eliminar las ${expense.installment_total} cuotas?`
                    : '¿Eliminar este gasto?'}
                </p>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-button px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-primary/5"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="rounded-button bg-danger/20 px-3 py-1.5 text-xs font-medium text-danger disabled:opacity-50"
                >
                  {isSaving ? '...' : 'Eliminar'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs text-danger hover:underline"
                >
                  Eliminar
                </button>
                <div className="flex-1" />
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="rounded-button bg-primary px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {isSaving ? <span className="spinner" /> : 'Guardar'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
