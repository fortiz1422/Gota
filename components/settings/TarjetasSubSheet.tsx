'use client'

import { useEffect, useState } from 'react'
import { CaretDown, Check, CreditCard, X } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import { formatDate } from '@/lib/format'
import type { Account, Card } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
}

interface ResolvedCardCycle {
  id: string
  user_id: string
  card_id: string
  period_month: string
  closing_date: string
  due_date: string
  status: 'open' | 'closed' | 'paid'
  created_at: string
  updated_at: string
  source: 'stored' | 'legacy'
}

interface CardCyclesResponse {
  cycles: ResolvedCardCycle[]
  upcomingCycle: ResolvedCardCycle | null
  usesLegacyFallback: boolean
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

function monthLabel(periodMonth: string): string {
  const label = new Date(`${periodMonth.substring(0, 7)}-15`).toLocaleDateString('es-AR', {
    month: 'short',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function FullDateField({
  value,
  onSave,
}: {
  value: string
  onSave: (value: string) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = e.target.value
    if (!nextValue) return

    setSaving(true)
    await onSave(nextValue)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="date"
        value={value.substring(0, 10)}
        onChange={handleChange}
        disabled={saving}
        className="rounded-input bg-bg-elevated px-1 py-0.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 [&::-webkit-calendar-picker-indicator]:opacity-60"
      />
      {saved && <Check size={10} weight="bold" className="shrink-0 text-success" />}
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
      {accounts.map((account) => (
        <option key={account.id} value={account.id}>
          {account.name}
        </option>
      ))}
    </select>
  )
}

export function TarjetasSubSheet({ open, onClose }: Props) {
  const [cards, setCards] = useState<Card[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [cyclesByCard, setCyclesByCard] = useState<Record<string, CardCyclesResponse>>({})
  const [loadingCycles, setLoadingCycles] = useState<Record<string, boolean>>({})
  const [isSavingMap, setIsSavingMap] = useState<Record<string, boolean>>({})
  const [newName, setNewName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    Promise.all([
      fetch('/api/cards').then((r) => r.json()),
      fetch('/api/accounts').then((r) => r.json()),
    ])
      .then(([cardsData, accountsData]) => {
        setCards(cardsData)
        setAccounts(
          Array.isArray(accountsData)
            ? accountsData.filter((account: Account) => !account.archived && account.type !== 'cash')
            : []
        )
      })
      .catch(() => {})
  }, [open])

  const loadCycles = async (cardId: string) => {
    setLoadingCycles((prev) => ({ ...prev, [cardId]: true }))
    try {
      const res = await fetch(`/api/card-cycles?card_id=${cardId}`)
      if (!res.ok) throw new Error()
      const data: CardCyclesResponse = await res.json()
      setCyclesByCard((prev) => ({ ...prev, [cardId]: data }))
    } catch {
      alert('Error al cargar ciclos de tarjeta.')
    } finally {
      setLoadingCycles((prev) => ({ ...prev, [cardId]: false }))
    }
  }

  const updateCard = async (id: string, patch: Partial<Pick<Card, 'account_id'>>) => {
    try {
      const res = await fetch(`/api/cards/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error()
      const updated: Card = await res.json()
      setCards((prev) => prev.map((card) => (card.id === id ? updated : card)))
    } catch {
      alert('Error al guardar cambios.')
    }
  }

  const saveUpcomingCycle = async (
    cardId: string,
    cycle: ResolvedCardCycle,
    patch: Partial<Pick<ResolvedCardCycle, 'closing_date' | 'due_date'>>
  ) => {
    const closingDate = patch.closing_date ?? cycle.closing_date
    const dueDate = patch.due_date ?? cycle.due_date
    const body = {
      card_id: cardId,
      period_month: closingDate.substring(0, 7),
      closing_date: closingDate,
      due_date: dueDate,
      status: cycle.status,
    }

    setIsSavingMap((prev) => ({ ...prev, [cardId]: true }))
    try {
      const endpoint = cycle.source === 'stored' ? `/api/card-cycles/${cycle.id}` : '/api/card-cycles'
      const method = cycle.source === 'stored' ? 'PATCH' : 'POST'
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      await loadCycles(cardId)
    } catch {
      alert('Error al guardar el ciclo.')
    } finally {
      setIsSavingMap((prev) => ({ ...prev, [cardId]: false }))
    }
  }

  const deleteCard = async (id: string) => {
    const card = cards.find((item) => item.id === id)
    if (!confirm(`¿Eliminar "${card?.name}"?`)) return

    setIsSaving(true)
    try {
      const res = await fetch(`/api/cards/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setCards((prev) => prev.filter((item) => item.id !== id))
      if (expandedId === id) setExpandedId(null)
    } catch {
      alert('Error al eliminar tarjeta.')
    } finally {
      setIsSaving(false)
    }
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
      setCards((prev) => [...prev, newCard])
      setExpandedId(newCard.id)
      setNewName('')
      await loadCycles(newCard.id)
    } catch {
      alert('Error al agregar tarjeta.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleExpanded = async (cardId: string, isExpanded: boolean) => {
    const nextExpandedId = isExpanded ? null : cardId
    setExpandedId(nextExpandedId)
    if (nextExpandedId && !cyclesByCard[nextExpandedId] && !loadingCycles[nextExpandedId]) {
      await loadCycles(nextExpandedId)
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
            {cards.map((card) => {
              const isExpanded = expandedId === card.id
              const cycleData = cyclesByCard[card.id]
              const upcomingCycle = cycleData?.upcomingCycle
              const isCycleLoading = !!loadingCycles[card.id]
              const collapsedLabel = upcomingCycle
                ? `Cierra ${formatDate(upcomingCycle.closing_date)} · vence ${formatDate(upcomingCycle.due_date)}`
                : closingDaysLabel(card.closing_day)

              return (
                <div key={card.id} className="border-b border-border-subtle">
                  <button
                    onClick={() => void handleToggleExpanded(card.id, isExpanded)}
                    className="flex w-full items-center gap-3 py-3 text-left"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-ocean bg-primary/8">
                      <CreditCard weight="duotone" size={14} className="text-text-label" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-text-primary">{card.name}</span>
                      <span className="text-[10px] text-text-tertiary">{collapsedLabel}</span>
                    </div>
                    <CaretDown
                      size={12}
                      weight="bold"
                      className={`shrink-0 text-text-tertiary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isExpanded && (
                    <div className="mb-3 space-y-3 rounded-input bg-bg-elevated p-3">
                      {isCycleLoading ? (
                        <p className="text-xs text-text-tertiary">Cargando ciclos…</p>
                      ) : upcomingCycle ? (
                        <>
                          <div>
                            <p className="text-xs font-medium text-text-primary">Próximo ciclo</p>
                            <p className="mt-0.5 text-[11px] text-text-tertiary">
                              {cycleData?.usesLegacyFallback
                                ? 'Usando fallback legacy hasta que confirmes fechas reales.'
                                : 'Fechas reales del próximo resumen.'}
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-text-secondary">Cierre</span>
                            <FullDateField
                              value={upcomingCycle.closing_date}
                              onSave={(value) => saveUpcomingCycle(card.id, upcomingCycle, { closing_date: value })}
                            />
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs text-text-secondary">Vencimiento</span>
                            <FullDateField
                              value={upcomingCycle.due_date}
                              onSave={(value) => saveUpcomingCycle(card.id, upcomingCycle, { due_date: value })}
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

                          <div className="space-y-1 rounded-card border border-border-subtle bg-bg-secondary px-3 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-label">
                              Ciclos
                            </p>
                            {cycleData?.cycles.map((cycle) => (
                              <div key={cycle.id} className="flex items-center justify-between gap-3 py-1">
                                <div className="min-w-0">
                                  <p className="text-xs text-text-primary">{monthLabel(cycle.period_month)}</p>
                                  <p className="text-[10px] text-text-tertiary">
                                    {formatDate(cycle.closing_date)} → {formatDate(cycle.due_date)}
                                  </p>
                                </div>
                                <span className="text-[10px] text-text-tertiary">
                                  {cycle.source === 'stored' ? 'real' : 'estimado'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-text-tertiary">No se pudo resolver el próximo ciclo.</p>
                      )}

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => deleteCard(card.id)}
                          disabled={isSaving || isSavingMap[card.id]}
                          className="text-xs text-text-tertiary transition-colors hover:text-danger disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex gap-2">
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

        <button
          onClick={onClose}
          className="w-full rounded-button border border-border-ocean py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-primary/5"
        >
          Listo
        </button>
      </div>
    </Modal>
  )
}
