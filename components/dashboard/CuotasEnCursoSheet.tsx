'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import { todayAR } from '@/lib/format'
import { CATEGORIES } from '@/lib/validation/schemas'
import type { Card } from '@/types/database'

interface Props {
  onClose: () => void
  currency: 'ARS' | 'USD'
  cards: Card[]
}

export function CuotasEnCursoSheet({ onClose, currency: defaultCurrency, cards }: Props) {
  const router = useRouter()
  const activeCards = cards.filter((c) => !c.archived)

  const [description, setDescription] = useState('')
  const [amountPerCuota, setAmountPerCuota] = useState('')
  const [currency, setCurrency] = useState<'ARS' | 'USD'>(defaultCurrency)
  const [cardId, setCardId] = useState<string>(activeCards[0]?.id ?? '')
  const [category, setCategory] = useState<string>('Otros')
  const [currentCuota, setCurrentCuota] = useState('')
  const [totalCuotas, setTotalCuotas] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const amount = Number(amountPerCuota)
  const current = parseInt(currentCuota)
  const total = parseInt(totalCuotas)
  const remaining = !isNaN(current) && !isNaN(total) && total >= current ? total - current + 1 : null

  const canSave =
    description.trim().length > 0 &&
    amount > 0 &&
    !!cardId &&
    !isNaN(current) && current >= 1 &&
    !isNaN(total) && total >= current

  const handleSave = async () => {
    if (!canSave) return
    setIsSaving(true)
    try {
      const today = todayAR()
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          amount,
          currency,
          category,
          is_want: false,
          payment_method: 'CREDIT',
          card_id: cardId,
          date: today,
          installments: remaining,
          installment_start: current,
          installment_grand_total: total,
        }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
      onClose()
    } catch {
      alert('Error al guardar. Intentá de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  const scrollOnFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => e.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 300)
  }

  const chipBase =
    'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors border'
  const chipActive = 'border-primary bg-primary/15 text-primary'
  const chipInactive = 'border-border-ocean bg-primary/[0.03] text-text-tertiary'

  return (
    <Modal open onClose={onClose}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />
      <h2 className="text-lg font-semibold text-text-primary">Cuotas en curso</h2>
      <p className="mb-5 mt-1 text-xs text-text-tertiary">
        Registrá una compra en cuotas que ya estás pagando.
      </p>

      <div className="space-y-5">
        {/* Descripción */}
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Descripción
          </label>
          <input
            type="text"
            placeholder="Ej. Heladera Samsung, Notebook..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onFocus={scrollOnFocus}
            autoFocus
            maxLength={100}
            className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-primary focus:outline-none"
          />
        </div>

        {/* Monto por cuota + Moneda */}
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Monto por cuota
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={amountPerCuota}
              onChange={(e) => setAmountPerCuota(e.target.value)}
              onFocus={scrollOnFocus}
              className="flex-1 rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
            />
            <div className="flex rounded-input bg-bg-tertiary p-1">
              {(['ARS', 'USD'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`rounded-button px-3 py-1.5 text-sm font-medium transition-colors ${
                    currency === c ? 'bg-primary text-bg-primary' : 'text-text-secondary'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Nro cuota actual / total */}
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Cuotas
          </label>
          <div className="flex items-center gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-input bg-bg-tertiary px-4 py-3">
              <span className="text-xs text-text-tertiary whitespace-nowrap">Cuota actual</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="3"
                value={currentCuota}
                onChange={(e) => setCurrentCuota(e.target.value)}
                onFocus={scrollOnFocus}
                className="min-w-0 flex-1 bg-transparent text-sm text-text-primary text-right focus:outline-none"
              />
            </div>
            <span className="text-text-disabled">/</span>
            <div className="flex flex-1 items-center gap-2 rounded-input bg-bg-tertiary px-4 py-3">
              <span className="text-xs text-text-tertiary whitespace-nowrap">Total</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="18"
                value={totalCuotas}
                onChange={(e) => setTotalCuotas(e.target.value)}
                onFocus={scrollOnFocus}
                className="min-w-0 flex-1 bg-transparent text-sm text-text-primary text-right focus:outline-none"
              />
            </div>
          </div>
          {remaining != null && remaining > 0 && (
            <p className="mt-1.5 text-[11px] text-text-tertiary">
              Se registrarán {remaining} cuota{remaining > 1 ? 's' : ''} desde este mes ({currentCuota} a {totalCuotas}).
            </p>
          )}
          {!isNaN(current) && !isNaN(total) && total < current && (
            <p className="mt-1.5 text-[11px] text-danger">El total debe ser mayor o igual a la cuota actual.</p>
          )}
        </div>

        {/* Tarjeta */}
        {activeCards.length > 0 ? (
          <div>
            <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
              Tarjeta
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {activeCards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => setCardId(card.id)}
                  className={`${chipBase} ${cardId === card.id ? chipActive : chipInactive}`}
                >
                  <CreditCard weight="duotone" size={13} />
                  <span>{card.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="rounded-input bg-warning/10 px-4 py-3 text-xs text-warning">
            Necesitás tener al menos una tarjeta configurada en Configuración.
          </p>
        )}

        {/* Categoría */}
        <div>
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
            Categoría
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CATEGORIES.filter((c) => c !== 'Pago de Tarjetas').map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`${chipBase} ${category === cat ? chipActive : chipInactive}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <button
          onClick={handleSave}
          disabled={!canSave || isSaving || activeCards.length === 0}
          className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-bg-primary transition-transform active:scale-95 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Guardando...' : `Registrar${remaining != null ? ` ${remaining} cuota${remaining > 1 ? 's' : ''}` : ''} ✓`}
        </button>
        <button
          onClick={onClose}
          disabled={isSaving}
          className="w-full rounded-button py-3 text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          Cancelar
        </button>
      </div>
    </Modal>
  )
}
