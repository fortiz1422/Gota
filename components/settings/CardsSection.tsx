'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Check, CaretDown, CreditCard, Plus, X } from '@phosphor-icons/react'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { Modal } from '@/components/ui/Modal'
import { addMonths } from '@/lib/dates'
import { buildCardLastFourPayload, validateCardLastFour } from '@/lib/shared-receipts-ui'
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

function DateField({
  day,
  forMonth,
  onSave,
}: {
  day: number | null
  forMonth: string
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

function LastFourField({
  cardId,
  value,
  onSave,
}: {
  cardId: string
  value: string | null | undefined
  onSave: (lastFour: string | null) => Promise<boolean>
}) {
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    const validation = validateCardLastFour(draft)
    if (!validation.valid) {
      setError(validation.message)
      return
    }
    setSaving(true)
    setError(null)
    const didSave = await onSave(validation.value)
    setSaving(false)
    if (didSave) {
      setDraft(validation.value ?? '')
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={`card-last-four-${cardId}`} className="shrink-0 text-xs text-text-secondary">
          Últimos 4
        </label>
        <div className="flex items-center gap-1.5">
          <input
            id={`card-last-four-${cardId}`}
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              setError(null)
              setSaved(false)
            }}
            placeholder="1234"
            aria-invalid={Boolean(error)}
            className="w-20 rounded-input border border-border-ocean bg-bg-secondary px-2 py-1 text-center text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button type="button" onClick={() => void handleSave()} disabled={saving} className="rounded-button px-2 py-1 text-[11px] font-semibold text-primary disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          {saved && <Check size={11} weight="bold" className="shrink-0 text-success" />}
        </div>
      </div>
      {error && <p role="alert" className="mt-1 text-right text-[11px] text-danger">{error}</p>}
    </div>
  )
}

function CardEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="rounded-card border border-dashed border-primary/20 bg-bg-secondary p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
        Tarjetas de crédito
      </p>
      <h3 className="mt-2 text-[20px] font-bold text-text-primary">
        Tus cierres y pagos, en orden
      </h3>
      <p className="mt-2 text-[14px] leading-6 text-text-tertiary">
        Registrá tus tarjetas para saber cuándo cierra cada ciclo, cuándo vence el pago y qué tenés pendiente.
      </p>
      <ul className="mt-4 space-y-1.5">
        {[
          'Seguí el ciclo de cierre de cada tarjeta',
          'Visualizá montos pendientes de pago',
          'Vinculá con la cuenta bancaria asociada',
        ].map((bullet) => (
          <li key={bullet} className="flex items-center gap-2 text-[13px] text-text-tertiary">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
            {bullet}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onAdd}
        className="mt-5 rounded-button bg-primary px-4 py-3 text-[13px] font-semibold text-white"
      >
        Agregar primera tarjeta
      </button>
    </section>
  )
}

function AddCardModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (name: string, lastFour: string | null) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [lastFour, setLastFour] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setLastFour('')
      setError(null)
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [open])

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const lastFourResult = validateCardLastFour(lastFour)
    if (!lastFourResult.valid) {
      setError(lastFourResult.message)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onAdd(trimmed, buildCardLastFourPayload(lastFour).last_four)
      onClose()
    } catch {
      setError('Error al agregar tarjeta. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-text-primary">Nueva tarjeta</h2>
            <p className="mt-0.5 text-[12px] text-text-tertiary">
              Podés configurar cierre y vencimiento después.
            </p>
          </div>
          <button onClick={onClose} className="mt-0.5 text-text-tertiary hover:text-text-secondary">
            <X size={20} />
          </button>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void handleSubmit()}
          placeholder="Ej: Visa Galicia, Amex Gold…"
          className="w-full rounded-input border border-border-ocean bg-bg-tertiary px-3 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none"
        />

        <div>
          <label htmlFor="new-card-last-four" className="text-xs font-semibold text-text-secondary">
            Últimos 4 dígitos <span className="font-normal text-text-tertiary">(opcional)</span>
          </label>
          <input
            id="new-card-last-four"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={lastFour}
            onChange={(event) => setLastFour(event.target.value)}
            placeholder="1234"
            className="mt-1 w-full rounded-input border border-border-ocean bg-bg-tertiary px-3 py-3 text-sm text-text-primary"
          />
          <p className="mt-1 text-[11px] text-text-tertiary">Solo guardamos el sufijo para reconocerla: •••• 1234.</p>
        </div>

        {error && (
          <p className="text-xs text-danger">{error}</p>
        )}

        <button
          onClick={() => void handleSubmit()}
          disabled={!name.trim() || saving}
          className="w-full rounded-button bg-primary py-3 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Agregando…' : 'Agregar tarjeta'}
        </button>
      </div>
    </Modal>
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
  const [addOpen, setAddOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleAddCard = async (name: string, lastFour: string | null) => {
    const res = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, last_four: lastFour }),
    })
    if (!res.ok) throw new Error()
    const newCard: Card = await res.json()
    setCards((prev) => [...prev, newCard])
    router.refresh()
  }

  const updateCard = async (id: string, patch: Partial<Pick<Card, 'closing_day' | 'due_day' | 'account_id' | 'last_four'>>): Promise<boolean> => {
    try {
      const res = await fetch(`/api/cards/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error()
      const updated: Card = await res.json()
      setCards((prev) => prev.map((c) => (c.id === id ? updated : c)))
      return true
    } catch {
      alert('Error al guardar cambios.')
      return false
    }
  }

  const deleteCard = async (id: string) => {
    const card = cards.find((c) => c.id === id)
    if (!confirm(`¿Eliminar "${card?.name}"?`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/cards/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setCards((prev) => prev.filter((c) => c.id !== id))
      if (expandedId === id) setExpandedId(null)
      router.refresh()
    } catch {
      alert('Error al eliminar tarjeta.')
    } finally {
      setDeleting(false)
    }
  }

  const activeCount = cards.length
  const summary = activeCount === 0 ? 'Sin tarjetas' : `${activeCount} tarjeta${activeCount !== 1 ? 's' : ''}`

  return (
    <>
      <CollapsibleSection
        icon={<CreditCard weight="duotone" size={18} className="text-text-primary icon-duotone" />}
        title="Tarjetas"
        summary={summary}
      >
        {cards.length === 0 ? (
          <CardEmptyState onAdd={() => setAddOpen(true)} />
        ) : (
          <>
            <div className="-mx-4 -mt-3">
              {cards.map((card) => {
                const info = card.closing_day ? closingInfo(card.closing_day, month) : null
                const isExpanded = expandedId === card.id
                const accountName = accounts.find((a) => a.id === card.account_id)?.name

                return (
                  <div key={card.id} className="border-b border-border-subtle last:border-0">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : card.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-ocean bg-primary/8">
                        <CreditCard weight="duotone" size={14} className="text-text-label" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-text-primary">
                          {card.name}
                        </span>
                        <span className="text-[11px] text-text-tertiary">
                          {accountName ? `${accountName} · ` : ''}
                          {card.last_four ? `•••• ${card.last_four} · ` : ''}{info ? info.label : 'Sin ciclo configurado'}
                        </span>
                      </div>

                      {info !== null && (
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            info.diff === 0 || (info.diff > 0 && info.diff <= 5)
                              ? 'bg-warning/10 text-warning'
                              : info.diff < 0
                                ? 'bg-bg-tertiary text-text-disabled'
                                : 'bg-bg-tertiary text-text-tertiary'
                          }`}
                        >
                          {info.label}
                        </span>
                      )}

                      <CaretDown
                        size={12}
                        weight="bold"
                        className={`shrink-0 text-text-tertiary transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {isExpanded && (
                      <div className="mx-4 mb-3 space-y-2 rounded-input bg-bg-elevated p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-text-secondary">Cierre</span>
                          <DateField
                            day={card.closing_day}
                            forMonth={month}
                            onSave={async (day) => { await updateCard(card.id, { closing_day: day }) }}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs text-text-secondary">Vencimiento</span>
                          <DateField
                            day={card.due_day}
                            forMonth={addMonths(month, 1)}
                            onSave={async (day) => { await updateCard(card.id, { due_day: day ?? 10 }) }}
                          />
                        </div>
                        {accounts.length > 0 && (
                          <div className="flex items-center justify-between gap-3">
                            <span className="shrink-0 text-xs text-text-secondary">Cuenta</span>
                            <AccountSelect
                              value={card.account_id}
                              accounts={accounts}
                              onChange={(accountId) => { void updateCard(card.id, { account_id: accountId }) }}
                            />
                          </div>
                        )}
                        <LastFourField
                          key={`${card.id}-${card.last_four ?? ''}`}
                          cardId={card.id}
                          value={card.last_four}
                          onSave={(lastFour) => updateCard(card.id, buildCardLastFourPayload(lastFour ?? ''))}
                        />
                        <div className="border-t border-border-subtle pt-2">
                          <button
                            onClick={() => deleteCard(card.id)}
                            disabled={deleting}
                            className="text-[11px] text-text-tertiary transition-colors hover:text-danger disabled:opacity-50"
                          >
                            Eliminar tarjeta
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <button
              onClick={() => setAddOpen(true)}
              className="mt-2 flex w-full items-center gap-2 rounded-input border border-dashed border-border-strong/40 px-3 py-2.5 transition-colors hover:bg-primary/5 active:opacity-70"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/8">
                <Plus size={12} className="text-primary" />
              </div>
              <span className="text-[13px] font-medium text-text-secondary">Agregar tarjeta</span>
            </button>
          </>
        )}
      </CollapsibleSection>

      <AddCardModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={handleAddCard}
      />
    </>
  )
}
