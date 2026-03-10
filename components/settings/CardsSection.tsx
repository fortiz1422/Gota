'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, CreditCard } from '@phosphor-icons/react'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import type { Card } from '@/types/database'

function closingInfo(closingDay: number, month: string): { diff: number; label: string } {
  const [y, m] = month.split('-').map(Number)
  const closing = new Date(y, m - 1, closingDay)
  const today = new Date()
  closing.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((closing.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return { diff, label: 'Cierra hoy' }
  if (diff > 0) return { diff, label: `Cierra en ${diff}d` }
  return { diff, label: `Cerró hace ${Math.abs(diff)}d` }
}

// Input controlado para el día de cierre, con feedback visual al guardar
function ClosingDayInput({
  card,
  onUpdate,
  disabled,
}: {
  card: Card
  onUpdate: (id: string, day: number | undefined) => Promise<void>
  disabled: boolean
}) {
  const [val, setVal] = useState(card.closing_day ? String(card.closing_day) : '')
  const [saved, setSaved] = useState(false)

  const handleBlur = async () => {
    const num = val ? Math.min(31, Math.max(1, Number(val))) : undefined
    const normalized = num ? String(num) : ''
    setVal(normalized)
    if (num !== card.closing_day) {
      await onUpdate(card.id, num)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-text-tertiary">día</span>
      <input
        type="number"
        min={1}
        max={31}
        value={val}
        placeholder="—"
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        disabled={disabled}
        className="w-10 rounded-input bg-bg-elevated px-1 py-0.5 text-center text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {saved && <Check size={10} weight="bold" className="text-success shrink-0" />}
    </div>
  )
}

export function CardsSection({ cards: initialCards, month }: { cards: Card[]; month: string }) {
  const router = useRouter()
  const [cards, setCards] = useState<Card[]>(initialCards)
  const [newName, setNewName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const saveCards = async (updated: Card[]) => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/user-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: updated }),
      })
      if (!res.ok) throw new Error()
      setCards(updated)
      router.refresh()
    } catch {
      alert('Error al guardar tarjetas.')
    } finally {
      setIsSaving(false)
    }
  }

  const addCard = () => {
    const name = newName.trim()
    if (!name) return
    const newCard: Card = { id: crypto.randomUUID(), name }
    setNewName('')
    saveCards([...cards, newCard])
  }

  const deleteCard = (id: string) => {
    saveCards(cards.filter((c) => c.id !== id))
  }

  const updateClosingDay = async (id: string, day: number | undefined) => {
    const updated = cards.map((c) => (c.id === id ? { ...c, closing_day: day } : c))
    await saveCards(updated)
  }

  const activeCount = cards.length
  const summary = activeCount === 0 ? 'Sin tarjetas' : `${activeCount} tarjeta${activeCount !== 1 ? 's' : ''}`

  return (
    <CollapsibleSection icon={<CreditCard weight="duotone" size={18} className="icon-duotone" />} title="Tarjetas" summary={summary}>
      <div className="space-y-1.5">
        {cards.map((card) => {
          const info = card.closing_day ? closingInfo(card.closing_day, month) : null

          return (
            <div
              key={card.id}
              className="rounded-card bg-bg-tertiary border border-border-ocean"
            >
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm text-text-primary">{card.name}</span>
                <div className="flex items-center gap-3">
                  <ClosingDayInput card={card} onUpdate={updateClosingDay} disabled={isSaving} />
                  <button
                    onClick={() => deleteCard(card.id)}
                    disabled={isSaving}
                    className="text-[10px] text-text-tertiary hover:text-danger disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              {info !== null && (
                <div className="px-3 pb-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      info.diff === 0
                        ? 'bg-warning/10 text-warning'
                        : info.diff > 0 && info.diff <= 5
                          ? 'bg-warning/10 text-warning'
                          : info.diff < 0
                            ? 'bg-bg-elevated text-text-disabled'
                            : 'bg-bg-elevated text-text-tertiary'
                    }`}
                  >
                    {info.label}
                  </span>
                </div>
              )}
            </div>
          )
        })}

        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCard()}
            placeholder="Nueva tarjeta"
            className="flex-1 rounded-input border border-transparent bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none"
          />
          <button
            onClick={addCard}
            disabled={!newName.trim() || isSaving}
            className="rounded-button bg-primary px-3 py-2 text-sm font-semibold text-bg-primary disabled:opacity-50"
          >
            +
          </button>
        </div>
      </div>
    </CollapsibleSection>
  )
}
