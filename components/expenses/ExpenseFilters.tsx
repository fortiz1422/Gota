'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { CATEGORIES } from '@/lib/validation/schemas'
import { getCurrentMonth, addMonths } from '@/lib/dates'

const PAYMENT_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'CASH', label: 'Efectivo' },
  { value: 'DEBIT', label: 'Débito' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'CREDIT', label: 'Crédito' },
]

interface Props {
  month: string
  category: string
  paymentMethod: string
  recurring: string
  extraordinary: string
}

export function ExpenseFilters({ month, category, paymentMethod, recurring, extraordinary }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const current = getCurrentMonth()
  const min = addMonths(current, -12)

  const update = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page') // reset page on filter change
    router.push(`${pathname}?${params.toString()}`)
  }

  const monthLabel = new Date(month + '-15').toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })
  const monthLabelCap = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)

  return (
    <div className="space-y-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => update('month', addMonths(month, -1))}
          disabled={month <= min}
          aria-label="Mes anterior"
          className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-primary/5 disabled:opacity-30"
        >
          <CaretLeft size={18} />
        </button>
        <span className="text-sm font-semibold text-text-primary">{monthLabelCap}</span>
        <button
          onClick={() => update('month', addMonths(month, 1))}
          disabled={month >= current}
          aria-label="Mes siguiente"
          className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-primary/5 disabled:opacity-30"
        >
          <CaretRight size={18} />
        </button>
      </div>

      {/* Category filter */}
      <div>
        <label className="mb-1 block type-label text-text-label">
          Categoría
        </label>
        <select
          value={category}
          onChange={(e) => update('category', e.target.value)}
          className="w-full rounded-input border border-transparent bg-bg-tertiary px-3 py-2 text-sm text-text-primary focus:border-primary focus:outline-none"
        >
          <option value="">Todas</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Payment method filter */}
      <div>
        <label className="mb-1 block type-label text-text-label">
          Medio de pago
        </label>
        <div className="flex flex-wrap gap-1.5">
          {PAYMENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update('payment_method', opt.value)}
              className={`rounded-button px-3 py-1.5 text-xs font-medium transition-colors ${
                paymentMethod === opt.value
                  ? 'bg-primary text-bg-primary'
                  : 'bg-bg-tertiary text-text-secondary hover:bg-primary/5'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block type-label text-text-label">Recurrencia</label>
        <div className="flex flex-wrap gap-1.5">
          {[{ value: '', label: 'Todos' }, { value: 'true', label: 'Recurrentes' }, { value: 'false', label: 'No recurrentes' }].map((opt) => (
            <button key={opt.value} onClick={() => update('is_recurring', opt.value)} className={`rounded-button px-3 py-1.5 text-xs font-medium transition-colors ${recurring === opt.value ? 'bg-primary text-bg-primary' : 'bg-bg-tertiary text-text-secondary hover:bg-primary/5'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block type-label text-text-label">Tipo</label>
        <div className="flex flex-wrap gap-1.5">
          {[{ value: '', label: 'Todos' }, { value: 'true', label: 'Extraordinarios' }, { value: 'false', label: 'Ordinarios' }].map((opt) => (
            <button key={opt.value} onClick={() => update('is_extraordinary', opt.value)} className={`rounded-button px-3 py-1.5 text-xs font-medium transition-colors ${extraordinary === opt.value ? 'bg-primary text-bg-primary' : 'bg-bg-tertiary text-text-secondary hover:bg-primary/5'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
