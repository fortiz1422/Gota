'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CaretRight, CreditCard, X } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import type { Card } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
}

function closingDaysLabel(closingDay: number | null): string {
  if (!closingDay) return 'Sin ciclo definido'
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

export function TarjetasSubSheet({ open, onClose }: Props) {
  const router = useRouter()
  const [cards, setCards] = useState<Card[]>([])
  const [newName, setNewName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch('/api/cards')
      .then((r) => r.json())
      .then((data) => setCards(Array.isArray(data) ? data : []))
      .catch(() => {})
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
      const newCard: Card = await res.json()
      onClose()
      router.push(`/tarjetas/${newCard.id}`)
    } catch {
      alert('Error al agregar tarjeta.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-text-primary">
            Tarjetas{cards.length > 0 ? ` (${cards.length})` : ''}
          </h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-secondary">
            <X size={20} />
          </button>
        </div>

        {cards.length === 0 ? (
          <p className="py-2 text-sm text-text-tertiary">Sin tarjetas configuradas.</p>
        ) : (
          <div>
            {cards.map((card) => (
              <button
                key={card.id}
                onClick={() => handleCardTap(card.id)}
                className="flex w-full items-center gap-3 border-b border-border-subtle py-3 text-left last:border-0 active:opacity-60"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-ocean bg-primary/8">
                  <CreditCard weight="duotone" size={14} className="text-text-label" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-text-primary">{card.name}</span>
                  <span className="text-[10px] text-text-tertiary">
                    {closingDaysLabel(card.closing_day)}
                  </span>
                </div>
                <CaretRight size={12} weight="bold" className="shrink-0 text-text-tertiary" />
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void addCard()}
            placeholder="Nueva tarjeta"
            className="flex-1 rounded-input border border-transparent bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none"
          />
          <button
            onClick={() => void addCard()}
            disabled={!newName.trim() || isSaving}
            className="rounded-button bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            +
          </button>
        </div>
      </div>
    </Modal>
  )
}
