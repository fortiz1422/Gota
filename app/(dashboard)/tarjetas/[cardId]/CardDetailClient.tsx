'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, ClockCounterClockwise, CaretRight } from '@phosphor-icons/react'
import { formatAmount, formatDate } from '@/lib/format'
import type { Account, Card, Expense } from '@/types/database'
import type { EnrichedCycle } from './page'
import { PagarResumenModal } from './PagarResumenModal'
import { LegacyCardPaymentModal } from './LegacyCardPaymentModal'

interface Props {
  card: Card
  accounts: Account[]
  resumenes: EnrichedCycle[]
  upcomingClosingDate: string | null
  expenses: Expense[]
}

function DayField({
  label,
  value,
  onSave,
}: {
  label: string
  value: number | null
  onSave: (day: number) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState(String(value ?? ''))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    const day = parseInt(input, 10)
    if (isNaN(day) || day < 1 || day > 31) return
    setSaving(true)
    try {
      await onSave(day)
      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 1500)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center justify-between border-b border-border-subtle py-3.5 last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={31}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleSave()}
            className="w-14 rounded-lg border border-border-strong bg-bg-primary px-2 py-1 text-center text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            autoFocus
            disabled={saving}
          />
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="text-xs font-semibold text-primary disabled:opacity-50"
          >
            Guardar
          </button>
          <button
            onClick={() => {
              setEditing(false)
              setInput(String(value ?? ''))
            }}
            className="text-xs text-text-tertiary"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">
            {value ? `Dia ${value}` : '—'}
          </span>
          {saved && <Check size={13} weight="bold" className="text-success" />}
          <button onClick={() => setEditing(true)} className="text-xs text-primary">
            Editar
          </button>
        </div>
      )}
    </div>
  )
}

function CycleStatusPill({ status }: { status: EnrichedCycle['cycleStatus'] }) {
  if (status === 'pagado') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-[10px] font-semibold text-success">
        ✓ Pagado
      </span>
    )
  }
  if (status === 'en_curso') {
    return (
      <span className="inline-flex items-center rounded-full bg-primary-soft px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
        En curso
      </span>
    )
  }
  if (status === 'cerrado') {
    return (
      <span className="inline-flex items-center rounded-full bg-bg-tertiary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
        Cerrado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-warning-soft px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
      Vencido
    </span>
  )
}

function periodMonthLabel(periodMonth: string): string {
  const label = new Date(`${periodMonth.substring(0, 7)}-15`).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function CardDetailClient({ card, accounts, resumenes, upcomingClosingDate, expenses }: Props) {
  const router = useRouter()
  const [currentCard, setCurrentCard] = useState<Card>(card)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(currentCard.name)
  const [savingName, setSavingName] = useState(false)
  const [payingCycle, setPayingCycle] = useState<EnrichedCycle | null>(null)
  const [isLegacyPaymentOpen, setIsLegacyPaymentOpen] = useState(false)
  const [revertingCycleId, setRevertingCycleId] = useState<string | null>(null)
  const [isReverting, setIsReverting] = useState(false)
  const [editingCycleId, setEditingCycleId] = useState<string | null>(null)
  const [editingClosingDate, setEditingClosingDate] = useState('')
  const [editingDueDate, setEditingDueDate] = useState('')
  const [isSavingCycleDates, setIsSavingCycleDates] = useState(false)

  const handleSaveName = async () => {
    const trimmed = nameInput.trim()
    if (!trimmed || trimmed === currentCard.name) { setEditingName(false); return }
    setSavingName(true)
    try {
      await patchCard({ name: trimmed })
      setEditingName(false)
    } finally {
      setSavingName(false)
    }
  }

  const patchCard = async (patch: Partial<Pick<Card, 'closing_day' | 'due_day' | 'account_id' | 'name'>>) => {
    const res = await fetch(`/api/cards/${currentCard.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error('Error al guardar')
    const updated: Card = await res.json()
    setCurrentCard(updated)
  }

  const revertPayment = async (cycleId: string) => {
    setIsReverting(true)
    try {
      const res = await fetch(`/api/card-cycles/${cycleId}/revert`, { method: 'POST' })
      if (!res.ok) throw new Error()
      setRevertingCycleId(null)
      router.refresh()
    } catch {
      alert('Error al revertir el pago.')
    } finally {
      setIsReverting(false)
    }
  }

  const deleteCard = async () => {
    if (!confirm(`¿Eliminar "${currentCard.name}"?`)) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/cards/${currentCard.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      router.back()
    } catch {
      alert('Error al eliminar la tarjeta.')
      setIsDeleting(false)
    }
  }

  const startCycleDateEdit = (cycle: EnrichedCycle) => {
    setEditingCycleId(cycle.id)
    setEditingClosingDate(cycle.closing_date)
    setEditingDueDate(cycle.due_date)
  }

  const cancelCycleDateEdit = () => {
    setEditingCycleId(null)
    setEditingClosingDate('')
    setEditingDueDate('')
  }

  const saveCycleDates = async () => {
    if (!editingCycleId || !editingClosingDate || !editingDueDate) return
    if (editingDueDate < editingClosingDate) {
      alert('La fecha de vencimiento no puede ser anterior al cierre.')
      return
    }
    setIsSavingCycleDates(true)
    try {
      const res = await fetch(`/api/card-cycles/${editingCycleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          closing_date: editingClosingDate,
          due_date: editingDueDate,
          amount_draft: null,
        }),
      })
      if (!res.ok) throw new Error()
      cancelCycleDateEdit()
      router.refresh()
    } catch {
      alert('No se pudieron actualizar las fechas del resumen.')
    } finally {
      setIsSavingCycleDates(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border-subtle bg-bg-primary/95 px-4 pb-3 pt-safe backdrop-blur-sm">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-bg-secondary"
          aria-label="Volver"
        >
          <ArrowLeft size={18} weight="light" className="text-text-secondary" />
        </button>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">Tarjeta</p>
          <h1 className="truncate text-base font-bold leading-tight text-text-primary">{currentCard.name}</h1>
        </div>
      </header>

      <div className="space-y-6 px-4 py-5">
        {/* Configuración */}
        <section>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
            Configuracion
          </p>
          <div className="rounded-[20px] bg-bg-secondary px-4">
            {/* Nombre editable */}
            <div className="flex items-center justify-between border-b border-border-subtle py-3.5">
              <span className="text-sm text-text-secondary">Nombre</span>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSaveName()
                      if (e.key === 'Escape') { setEditingName(false); setNameInput(currentCard.name) }
                    }}
                    className="w-36 rounded-lg border border-border-strong bg-bg-primary px-2 py-1 text-right text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    autoFocus
                    disabled={savingName}
                  />
                  <button onClick={() => void handleSaveName()} disabled={savingName} className="text-xs font-semibold text-primary disabled:opacity-50">
                    Guardar
                  </button>
                  <button onClick={() => { setEditingName(false); setNameInput(currentCard.name) }} className="text-xs text-text-tertiary">
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">{currentCard.name}</span>
                  <button onClick={() => { setNameInput(currentCard.name); setEditingName(true) }} className="text-xs text-primary">
                    Editar
                  </button>
                </div>
              )}
            </div>

            <DayField
              label="Cierre"
              value={currentCard.closing_day}
              onSave={(day) => patchCard({ closing_day: day })}
            />
            <DayField
              label="Vencimiento"
              value={currentCard.due_day}
              onSave={(day) => patchCard({ due_day: day })}
            />

            {accounts.length > 0 && (
              <div className="border-b border-border-subtle py-3.5 last:border-0">
                <span className="mb-2 block text-sm text-text-secondary">Cuenta</span>
                <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <button
                    onClick={() => void patchCard({ account_id: null })}
                    className={`flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      !currentCard.account_id
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border-ocean bg-primary/[0.03] text-text-tertiary'
                    }`}
                  >
                    Sin cuenta
                  </button>
                  {[...accounts].sort((a) => a.id === currentCard.account_id ? -1 : 1).map((a) => (
                    <button
                      key={a.id}
                      onClick={() => void patchCard({ account_id: a.id })}
                      className={`flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        currentCard.account_id === a.id
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-border-ocean bg-primary/[0.03] text-text-tertiary'
                      }`}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between py-3.5">
              <span className="text-sm text-text-secondary">Proximo cierre</span>
              <span className="text-sm text-text-tertiary">
                {upcomingClosingDate ? formatDate(upcomingClosingDate) : '—'}
              </span>
            </div>
          </div>
        </section>

        {/* Resúmenes */}
        <section>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
            Resumenes
          </p>
          {resumenes.length === 0 ? (
            <p className="px-1 text-sm text-text-tertiary">Sin gastos registrados en los ultimos meses.</p>
          ) : (
            <div className="divide-y divide-border-subtle overflow-hidden rounded-[20px] bg-bg-secondary">
              {resumenes.map((cycle) => (
                <div key={cycle.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary">
                        {periodMonthLabel(cycle.period_month)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-text-tertiary">
                        {formatDate(cycle.closing_date)} → {formatDate(cycle.due_date)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-sm font-bold tabular-nums text-text-primary">
                        {formatAmount(cycle.amount, 'ARS')}
                      </span>
                      <CycleStatusPill status={cycle.cycleStatus} />
                    </div>
                  </div>

                  {cycle.source === 'stored' && (cycle.cycleStatus === 'cerrado' || cycle.cycleStatus === 'vencido') && (
                    <>
                      {editingCycleId === cycle.id ? (
                        <div className="mt-3 space-y-2 rounded-[14px] border border-border-subtle bg-bg-primary px-3 py-2.5">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="space-y-1">
                              <span className="block text-[11px] text-text-secondary">Cierre</span>
                              <input
                                type="date"
                                value={editingClosingDate}
                                onChange={(e) => setEditingClosingDate(e.target.value)}
                                disabled={isSavingCycleDates}
                                className="w-full rounded-lg border border-border-strong bg-bg-secondary px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                              />
                            </label>
                            <label className="space-y-1">
                              <span className="block text-[11px] text-text-secondary">Vencimiento</span>
                              <input
                                type="date"
                                value={editingDueDate}
                                onChange={(e) => setEditingDueDate(e.target.value)}
                                disabled={isSavingCycleDates}
                                className="w-full rounded-lg border border-border-strong bg-bg-secondary px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                              />
                            </label>
                          </div>
                          <p className="text-[11px] text-text-tertiary">
                            Al guardar, se recalcula el monto segun los gastos del nuevo periodo.
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={cancelCycleDateEdit}
                              disabled={isSavingCycleDates}
                              className="flex-1 rounded-full py-1.5 text-xs text-text-secondary hover:bg-bg-secondary disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => void saveCycleDates()}
                              disabled={isSavingCycleDates}
                              className="flex-1 rounded-full bg-primary py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {isSavingCycleDates ? 'Guardando…' : 'Guardar fechas'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => startCycleDateEdit(cycle)}
                          className="mt-2 text-[11px] text-primary underline-offset-2 hover:underline"
                        >
                          Editar fechas
                        </button>
                      )}
                    </>
                  )}

                  {cycle.cycleStatus !== 'pagado' && (
                    <button
                      onClick={() => setPayingCycle(cycle)}
                      className={`mt-3 w-full rounded-full py-2 text-[13px] font-semibold transition-opacity active:opacity-70 ${
                        cycle.cycleStatus === 'en_curso'
                          ? 'bg-primary text-white'
                          : 'border border-primary text-primary'
                      }`}
                    >
                      Pagar resumen
                    </button>
                  )}

                  {cycle.cycleStatus === 'pagado' && (
                    <>
                      {revertingCycleId === cycle.id ? (
                        <div className="mt-3 space-y-2 rounded-[14px] bg-danger/10 px-3 py-2.5">
                          <p className="text-xs font-medium text-danger">
                            ¿Revertir el pago? Se eliminara el movimiento registrado.
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setRevertingCycleId(null)}
                              disabled={isReverting}
                              className="flex-1 rounded-full py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-primary disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => void revertPayment(cycle.id)}
                              disabled={isReverting}
                              className="flex-1 rounded-full bg-danger py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {isReverting ? 'Revirtiendo…' : 'Confirmar'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRevertingCycleId(cycle.id)}
                          className="mt-2 text-[11px] text-text-tertiary underline-offset-2 hover:underline"
                        >
                          Revertir pago
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pago anterior a Gota */}
        <section>
          <div className="overflow-hidden rounded-[20px] bg-bg-secondary">
            <button
              onClick={() => setIsLegacyPaymentOpen(true)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:opacity-60"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-tertiary">
                <ClockCounterClockwise size={15} weight="duotone" className="text-text-label" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary">Pago anterior a Gota</p>
                <p className="text-[11px] text-text-tertiary">Deuda existente antes de usar la app</p>
              </div>
              <CaretRight size={14} weight="bold" className="shrink-0 text-text-tertiary" />
            </button>
          </div>
        </section>

        {/* Eliminar tarjeta */}
        <section className="pb-8 pt-2 text-center">
          <button
            onClick={() => void deleteCard()}
            disabled={isDeleting}
            className="text-xs text-text-dim underline-offset-2 hover:underline disabled:opacity-50"
          >
            {isDeleting ? 'Eliminando…' : 'Eliminar tarjeta'}
          </button>
        </section>
      </div>

      {payingCycle && (
        <PagarResumenModal
          open={!!payingCycle}
          onClose={() => setPayingCycle(null)}
          onSuccess={() => {
            setPayingCycle(null)
            router.refresh()
          }}
          cycle={payingCycle}
          card={currentCard}
          accounts={accounts}
          expenses={expenses}
        />
      )}

      <LegacyCardPaymentModal
        open={isLegacyPaymentOpen}
        onClose={() => setIsLegacyPaymentOpen(false)}
        onSuccess={() => {
          setIsLegacyPaymentOpen(false)
          router.refresh()
        }}
        card={currentCard}
        accounts={accounts}
      />
    </div>
  )
}
