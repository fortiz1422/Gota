'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CaretRight, CreditCard, Plus, X } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import { formatCompact } from '@/lib/format'
import type { CardSummary } from '@/app/api/cards/summary/route'
import type { Currency } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
}

function closingDaysLabel(closingDay: number | null): string {
  if (!closingDay) return 'Sin ciclo'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m] = [today.getFullYear(), today.getMonth()]
  const closing = new Date(y, m, closingDay)
  if (closing < today) closing.setMonth(closing.getMonth() + 1)
  const diff = Math.round((closing.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return 'Cierra hoy'
  if (diff > 0) return `Cierra en ${diff}d`
  return `Cerró hace ${Math.abs(diff)}d`
}

function pendingLabel(card: CardSummary): string | null {
  const chunks: string[] = []
  if (card.pending_ars > 0) chunks.push(formatCompact(card.pending_ars, 'ARS'))
  if (card.pending_usd > 0) chunks.push(formatCompact(card.pending_usd, 'USD'))
  return chunks.length > 0 ? chunks.join(' · ') : null
}

function buildHeaderTotals(cards: CardSummary[]) {
  if (cards.length === 0) return null

  const defaultCurrency = (cards[0]?.default_currency ?? 'ARS') as Currency
  const primaryTotal = cards.reduce(
    (sum, card) => sum + (defaultCurrency === 'ARS' ? card.pending_ars : card.pending_usd),
    0,
  )
  const secondaryCurrency: Currency = defaultCurrency === 'ARS' ? 'USD' : 'ARS'
  const secondaryTotal = cards.reduce(
    (sum, card) => sum + (secondaryCurrency === 'ARS' ? card.pending_ars : card.pending_usd),
    0,
  )

  return { defaultCurrency, primaryTotal, secondaryCurrency, secondaryTotal }
}

export function TarjetasSubSheet({ open, onClose }: Props) {
  const router = useRouter()
  const [cards, setCards] = useState<CardSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [newName, setNewName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [addingCard, setAddingCard] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/cards/summary')
      .then((r) => r.json())
      .then((data) => setCards(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  const handleCardTap = (cardId: string) => {
    onClose()
    router.push(`/tarjetas/${cardId}`)
  }

  const addCard = async () => {
    const name = newName.trim()
    if (!name) return
    setIsSaving(true)
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error()
      const newCard: { id: string } = await res.json()
      onClose()
      router.push(`/tarjetas/${newCard.id}`)
    } catch {
      alert('Error al agregar tarjeta.')
    } finally {
      setIsSaving(false)
    }
  }

  const headerTotals = buildHeaderTotals(cards)

  return (
    <Modal open={open} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-text-primary">
              Tarjetas{cards.length > 0 ? ` (${cards.length})` : ''}
            </h2>
            {headerTotals && headerTotals.primaryTotal > 0 && (
              <>
                <p className="mt-0.5 text-[11px] text-text-tertiary">
                  {formatCompact(headerTotals.primaryTotal, headerTotals.defaultCurrency)} pendiente de pago
                </p>
                {headerTotals.secondaryTotal > 0 && (
                  <p className="mt-0.5 text-[10px] text-text-dim">
                    {formatCompact(headerTotals.secondaryTotal, headerTotals.secondaryCurrency)} en {headerTotals.secondaryCurrency}
                  </p>
                )}
              </>
            )}
          </div>
          <button onClick={onClose} className="mt-0.5 text-text-tertiary hover:text-text-secondary">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <p className="py-2 text-sm text-text-tertiary">Cargando...</p>
        ) : cards.length === 0 ? (
          <p className="py-2 text-sm text-text-tertiary">Sin tarjetas configuradas.</p>
        ) : (
          <div>
            {cards.map((card, i) => (
              <button
                key={card.id}
                onClick={() => handleCardTap(card.id)}
                className={`flex w-full items-center gap-3 rounded-sm px-4 py-3 text-left transition-colors hover:bg-primary/5 active:opacity-60 ${
                  i < cards.length - 1 ? 'border-b border-border-subtle' : ''
                }`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-ocean bg-primary/8">
                  <CreditCard weight="duotone" size={14} className="text-text-label" />
                </div>

                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-text-primary">{card.name}</span>
                  <span className="text-[10px] text-text-tertiary">
                    {card.account_name ? `${card.account_name} · ` : ''}
                    {closingDaysLabel(card.closing_day)}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {card.pending_amount > 0 ? (
                    <span className="text-xs font-semibold tabular-nums text-text-primary">
                      {pendingLabel(card)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-text-dim">sin gastos</span>
                  )}
                  <CaretRight size={12} weight="bold" className="text-text-tertiary" />
                </div>
              </button>
            ))}
          </div>
        )}

        {addingCard ? (
          <div className="flex items-center gap-3 rounded-sm border border-border-subtle px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-ocean bg-primary/8">
              <Plus size={14} className="text-primary" />
            </div>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void addCard()
                if (e.key === 'Escape') {
                  setAddingCard(false)
                  setNewName('')
                }
              }}
              placeholder="Nombre de la tarjeta"
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
              autoFocus
            />
            <button
              onClick={() => void addCard()}
              disabled={!newName.trim() || isSaving}
              className="text-xs font-semibold text-primary disabled:opacity-40"
            >
              {isSaving ? '...' : 'Agregar'}
            </button>
            <button
              onClick={() => {
                setAddingCard(false)
                setNewName('')
              }}
              className="text-xs text-text-tertiary"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddingCard(true)}
            className="flex w-full items-center gap-3 rounded-sm border border-border-subtle px-4 py-3 text-left transition-colors hover:bg-primary/5 active:opacity-70"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-ocean bg-primary/8">
              <Plus size={14} className="text-primary" />
            </div>
            <span className="text-sm font-medium text-text-secondary">Nueva tarjeta</span>
          </button>
        )}
      </div>
    </Modal>
  )
}
