'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import { formatAmount } from '@/lib/format'
import type { Subscription, Card } from '@/types/database'

interface Props {
  subscriptions: Subscription[]
  currency: 'ARS' | 'USD'
  cards: Card[]
  onDone: () => void
}

export function SubscriptionReviewSheet({ subscriptions, currency, cards, onDone }: Props) {
  const router = useRouter()
  const [amounts, setAmounts] = useState<Record<string, string>>(
    Object.fromEntries(subscriptions.map((s) => [s.id, String(s.amount)])),
  )
  const [days, setDays] = useState<Record<string, string>>(
    Object.fromEntries(subscriptions.map((s) => [s.id, String(s.day_of_month)])),
  )
  const [isSaving, setIsSaving] = useState(false)
  const [archived, setArchived] = useState<Set<string>>(new Set())

  const cardName = (id: string | null) => cards.find((c) => c.id === id)?.name ?? id ?? '—'

  const handleArchive = async (id: string) => {
    const res = await fetch(`/api/subscriptions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: false }),
    })
    if (res.ok) setArchived((prev) => new Set([...prev, id]))
  }

  const handleDone = async () => {
    setIsSaving(true)
    try {
      const now = new Date().toISOString()
      const active = subscriptions.filter((s) => !archived.has(s.id))
      await Promise.all([
        ...active.map((s) => {
          const newAmount = Number(amounts[s.id])
          const patch: Record<string, unknown> = { last_reviewed_at: now }
          if (newAmount > 0 && newAmount !== s.amount) patch.amount = newAmount
          const newDay = Number(days[s.id])
          if (newDay >= 1 && newDay <= 31 && newDay !== s.day_of_month) patch.day_of_month = newDay
          return fetch(`/api/subscriptions/${s.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          })
        }),
      ])
      router.refresh()
      onDone()
    } finally {
      setIsSaving(false)
    }
  }

  const visible = subscriptions.filter((s) => !archived.has(s.id))

  return (
    <Modal open onClose={onDone}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />
      <h2 className="text-lg font-semibold text-text-primary">Revisá tus suscripciones</h2>
      <p className="mb-5 mt-1 text-xs text-text-tertiary">
        Confirmá que los montos están actualizados o archivá las que ya no uses.
      </p>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-tertiary">
          No quedan suscripciones activas.
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center gap-3 rounded-card bg-bg-tertiary px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-text-primary">{sub.description}</p>
                <p className="text-[10px] text-text-tertiary">
                  Día {sub.day_of_month}
                  {sub.payment_method === 'CREDIT' && ` · ${cardName(sub.card_id)}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] text-text-tertiary">Día</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  value={days[sub.id]}
                  onChange={(e) => setDays((prev) => ({ ...prev, [sub.id]: e.target.value }))}
                  className="w-10 rounded-input border border-transparent bg-bg-secondary px-2 py-2 text-center text-sm text-text-primary focus:border-primary focus:outline-none"
                />
              </div>
              <input
                type="number"
                inputMode="decimal"
                value={amounts[sub.id]}
                onChange={(e) => setAmounts((prev) => ({ ...prev, [sub.id]: e.target.value }))}
                className="w-20 rounded-input border border-transparent bg-bg-secondary px-3 py-2 text-right text-sm text-text-primary focus:border-primary focus:outline-none"
              />
              <span className="text-xs text-text-tertiary shrink-0">
                {sub.currency}
              </span>
              <button
                onClick={() => handleArchive(sub.id)}
                className="shrink-0 rounded-full p-1.5 text-text-disabled transition-colors hover:bg-danger/15 hover:text-danger"
              >
                <Trash weight="bold" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2">
        <button
          onClick={handleDone}
          disabled={isSaving}
          className="w-full rounded-button bg-success py-3 text-sm font-semibold text-bg-primary transition-transform active:scale-95 hover:scale-[1.02] disabled:opacity-50"
        >
          {isSaving ? 'Guardando...' : 'Todo está bien ✓'}
        </button>
        <button
          onClick={onDone}
          disabled={isSaving}
          className="w-full rounded-button py-3 text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          Revisar después
        </button>
      </div>
    </Modal>
  )
}
