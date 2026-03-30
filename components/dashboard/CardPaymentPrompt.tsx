'use client'

import { useState } from 'react'
import { formatAmount } from '@/lib/format'
import type { Account, Card, Currency } from '@/types/database'

interface Props {
  card: Card
  amount: number
  currency: Currency
  periodoDesde: Date
  periodoHasta: Date
  accounts: Account[]
  onConfirm: (finalAmount: number) => Promise<void>
  onDismiss: () => void
}

function formatPeriodDate(d: Date): string {
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export function CardPaymentPrompt({
  card,
  amount,
  currency,
  periodoDesde,
  periodoHasta,
  onConfirm,
  onDismiss,
}: Props) {
  const [editMode, setEditMode] = useState(false)
  const [editValue, setEditValue] = useState(String(amount))
  const [isSaving, setIsSaving] = useState(false)

  const fmt = (n: number) => formatAmount(n, currency)

  const handleConfirm = async (finalAmount: number) => {
    setIsSaving(true)
    try {
      await onConfirm(finalAmount)
    } catch {
      alert('Error al registrar el pago. Intentá de nuevo.')
      setIsSaving(false)
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onDismiss}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-[28px] bg-bg-secondary border-t border-border-subtle px-5 pb-10 pt-5 slide-up">
        {/* Handle */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled" />

        <div className="mb-1 flex items-center gap-2">
          <span className="text-lg">💳</span>
          <h2 className="text-lg font-semibold text-text-primary">
            Pago de {card.name}
          </h2>
        </div>
        <p className="mb-5 text-xs text-text-tertiary">
          Período {formatPeriodDate(periodoDesde)} → {formatPeriodDate(periodoHasta)}
        </p>

        {editMode ? (
          <div className="mb-4">
            <p className="mb-2 text-xs text-text-tertiary">Monto a registrar</p>
            <div className="flex items-center rounded-full border border-primary/40 bg-bg-tertiary px-4 py-3 mb-3">
              <span className="mr-2 text-sm text-text-tertiary">$</span>
              <input
                type="number"
                inputMode="numeric"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
                className="flex-1 bg-transparent text-sm text-text-primary outline-none"
              />
            </div>
            <button
              onClick={() => handleConfirm(Math.max(1, Number(editValue) || 0))}
              disabled={isSaving}
              className="w-full rounded-full bg-primary py-3.5 text-sm font-semibold text-bg-primary transition-all active:scale-95 disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : 'Confirmar'}
            </button>
          </div>
        ) : (
          <>
            <div className="mb-5 rounded-card bg-bg-tertiary px-4 py-3">
              <p className="text-xs text-text-tertiary mb-1">Monto sugerido</p>
              <p className="text-2xl font-light text-primary">{fmt(amount)}</p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => handleConfirm(amount)}
                disabled={isSaving}
                className="w-full rounded-full bg-primary py-3.5 text-sm font-semibold text-bg-primary transition-all active:scale-95 disabled:opacity-50"
              >
                {isSaving ? 'Guardando...' : 'Confirmar pago'}
              </button>
              <button
                onClick={() => setEditMode(true)}
                disabled={isSaving}
                className="w-full rounded-full border border-primary/30 py-3.5 text-sm font-medium text-primary transition-all active:scale-95"
              >
                Editar monto
              </button>
              <button
                onClick={onDismiss}
                disabled={isSaving}
                className="w-full py-2.5 text-sm text-text-tertiary"
              >
                Ahora no
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
