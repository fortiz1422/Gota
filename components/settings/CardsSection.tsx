'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, CaretDown, CreditCard } from '@phosphor-icons/react'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { addMonths } from '@/lib/dates'
import type { Account, Card } from '@/types/database'

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

// DateField: date picker restringido al mes indicado. Guarda solo el día (number).
function DateField({
  day,
  forMonth,
  onSave,
}: {
  day: number | null
  forMonth: string // YYYY-MM
  onSave: (day: number | null) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [y, mo] = forMonth.split('-').map(Number)
  const lastDay = new Date(y, mo, 0).getDate()
  const clampedDay = day !== null ? Math.min(day, lastDay) : null
  const dateValue = clampedDay !== null
    ? `${forMonth}-${String(clampedDay).padStart(2, '0')}`
    : ''

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value
    if (!newVal) return
    const newDay = parseInt(newVal.split('-')[2], 10)
    setSaving(true)
    await onSave(newDay)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="date"
        value={dateValue}
        min={`${forMonth}-01`}
        max={`${forMonth}-${String(lastDay).padStart(2, '0')}`}
        onChange={handleChange}
        disabled={saving}
        className="rounded-input bg-bg-elevated px-1 py-0.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 [&::-webkit-calendar-picker-indicator]:opacity-60"
      />
      {saved && <Check size={10} weight="bold" className="text-success shrink-0" />}
    </div>
  )
}

function AccountSelect({
  value,
  accounts,
  onChange,
}: {
  value: string | null
  accounts: Account[]
  onChange: (accountId: string | null) => void
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={`flex-1 rounded-input bg-bg-elevated px-2 py-0.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary ${
        !value ? 'border border-danger/50' : 'border border-transparent'
      }`}
    >
      <option value="">Sin cuenta</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  )
}

export function CardsSection({
  cards: initialCards,
  month,
  accounts,
}: {
  cards: Card[]
  month: string
  accounts: Account[]
}) {
  const router = useRouter()
  const [cards, setCards] = useState<Card[]>(initialCards)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

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
      setCards([...cards, newCard])
      setNewName('')
      router.refresh()
    } catch {
      alert('Error al agregar tarjeta.')
    } finally {
      setIsSaving(false)
    }
  }

  const updateCard = async (id: string, patch: Partial<Pick<Card, 'closing_day' | 'due_day' | 'account_id'>>) => {
    try {
      const res = await fetch(`/api/cards/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error()
      const updated: Card = await res.json()
      setCards((prev) => prev.map((c) => (c.id === id ? updated : c)))
    } catch {
      alert('Error al guardar cambios.')
    }
  }

  const deleteCard = async (id: string) => {
    const card = cards.find((c) => c.id === id)
    if (!confirm(`¿Eliminar "${card?.name}"?`)) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/cards/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setCards((prev) => prev.filter((c) => c.id !== id))
      if (expandedId === id) setExpandedId(null)
      router.refresh()
    } catch {
      alert('Error al eliminar tarjeta.')
    } finally {
      setIsSaving(false)
    }
  }

  const activeCount = cards.length
  const summary = activeCount === 0 ? 'Sin tarjetas' : `${activeCount} tarjeta${activeCount !== 1 ? 's' : ''}`

  return (
    <CollapsibleSection
      icon={<CreditCard weight="duotone" size={18} className="text-text-primary icon-duotone" />}
      title="Tarjetas"
      summary={summary}
    >
      {cards.map((card) => {
        const info = card.closing_day ? closingInfo(card.closing_day, month) : null
        const isExpanded = expandedId === card.id

        return (
          <div key={card.id} className="border-b border-border-subtle">
            {/* Header — always visible */}
            <div className="flex items-center justify-between py-2.5">
              <button
                onClick={() => setExpandedId(isExpanded ? null : card.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <CaretDown
                  size={12}
                  weight="bold"
                  className={`shrink-0 text-text-tertiary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
                <span className="truncate text-sm text-text-primary">{card.name}</span>
                {info !== null && (
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      info.diff === 0
                        ? 'bg-warning/10 text-warning'
                        : info.diff > 0 && info.diff <= 5
                          ? 'bg-warning/10 text-warning'
                          : info.diff < 0
                            ? 'bg-bg-tertiary text-text-disabled'
                            : 'bg-bg-tertiary text-text-tertiary'
                    }`}
                  >
                    {info.label}
                  </span>
                )}
              </button>
              <button
                onClick={() => deleteCard(card.id)}
                disabled={isSaving}
                className="ml-3 shrink-0 text-[10px] text-text-tertiary hover:text-danger disabled:opacity-50"
              >
                Eliminar
              </button>
            </div>

            {/* Expanded panel */}
            {isExpanded && (
              <div className="mb-3 space-y-2 rounded-input bg-bg-elevated p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-text-secondary">Cierre</span>
                  <DateField
                    day={card.closing_day}
                    forMonth={month}
                    onSave={(day) => updateCard(card.id, { closing_day: day })}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-text-secondary">Vencimiento</span>
                  <DateField
                    day={card.due_day}
                    forMonth={addMonths(month, 1)}
                    onSave={(day) => updateCard(card.id, { due_day: day ?? 10 })}
                  />
                </div>
                {accounts.length > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="shrink-0 text-xs text-text-secondary">Cuenta</span>
                    <AccountSelect
                      value={card.account_id}
                      accounts={accounts}
                      onChange={(accountId) => updateCard(card.id, { account_id: accountId })}
                    />
                  </div>
                )}
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
          className="rounded-button bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          +
        </button>
      </div>
    </CollapsibleSection>
  )
}
