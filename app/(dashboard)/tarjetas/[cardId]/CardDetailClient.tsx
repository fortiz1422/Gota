'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ClockCounterClockwise, CaretRight, CaretDown, CaretUp } from '@phosphor-icons/react'
import { formatAmount, formatDate } from '@/lib/format'
import type { EnrichedCycle } from '@/lib/card-summaries'
import type { Account, Card, Expense } from '@/types/database'
import { PagarResumenModal } from './PagarResumenModal'
import { LegacyCardPaymentModal } from './LegacyCardPaymentModal'
import { CycleExpensesDetail } from './CycleExpensesDetail'
import { EditCycleModal } from './EditCycleModal'

interface Props {
  card: Card
  accounts: Account[]
  resumenes: EnrichedCycle[]
  upcomingClosingDate: string | null
  expenses: Expense[]
}

function CycleStatusPill({ status }: { status: EnrichedCycle['cycleStatus'] }) {
  if (status === 'pagado') {
    return (
      <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-0.5 text-[10px] font-semibold text-success">
        Pagado
      </span>
    )
  }
  if (status === 'en_curso') {
    return (
      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
        En curso
      </span>
    )
  }
  if (status === 'cerrado') {
    return (
      <span className="inline-flex items-center rounded-full bg-warning/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">
        Cerrado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-danger/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger">
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

function formatDiff(diff: number): string {
  if (diff === 0) return '$0'
  const sign = diff > 0 ? '+' : '-'
  return `${sign}${formatAmount(Math.abs(diff), 'ARS')}`
}

function formatUpcomingShort(date: string): string {
  const d = new Date(`${date}T12:00:00`)
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export function CardDetailClient({ card, accounts, resumenes, upcomingClosingDate, expenses }: Props) {
  const router = useRouter()
  const [currentCard, setCurrentCard] = useState<Card>(card)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeletingConfirm, setIsDeletingConfirm] = useState(false)

  // Inline name editing
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInputValue, setNameInputValue] = useState(card.name)

  // Combined cycle edit modal
  const [isEditingCycle, setIsEditingCycle] = useState(false)

  const [payingCycle, setPayingCycle] = useState<EnrichedCycle | null>(null)
  const [isLegacyPaymentOpen, setIsLegacyPaymentOpen] = useState(false)
  const [revertingCycleId, setRevertingCycleId] = useState<string | null>(null)
  const [isReverting, setIsReverting] = useState(false)
  const [editingCycleId, setEditingCycleId] = useState<string | null>(null)
  const [editingClosingDate, setEditingClosingDate] = useState('')
  const [editingDueDate, setEditingDueDate] = useState('')
  const [isSavingCycleDates, setIsSavingCycleDates] = useState(false)
  const [saveCycleError, setSaveCycleError] = useState<string | null>(null)
  const [revertError, setRevertError] = useState<string | null>(null)
  const [detailCycleId, setDetailCycleId] = useState<string | null>(null)

  const cycleExpensesMap = useMemo(
    () =>
      Object.fromEntries(
        resumenes.map((cycle) => [
          cycle.id,
          expenses.filter(
            (expense) =>
              expense.payment_method === 'CREDIT' &&
              expense.category !== 'Pago de Tarjetas' &&
              expense.date >= cycle.period_from &&
              expense.date <= cycle.closing_date,
          ),
        ]),
      ) as Record<string, Expense[]>,
    [resumenes, expenses],
  )

  const enCursoCycle = resumenes.find((c) => c.cycleStatus === 'en_curso') ?? null
  const otherCycles = resumenes.filter((c) => c.cycleStatus !== 'en_curso')

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

  const handleSaveNameInline = async () => {
    const trimmed = nameInputValue.trim()
    setIsEditingName(false)
    if (!trimmed || trimmed === currentCard.name) return
    try {
      await patchCard({ name: trimmed })
    } catch {
      setNameInputValue(currentCard.name)
    }
  }

  const revertPayment = async (cycleId: string) => {
    setIsReverting(true)
    setRevertError(null)
    try {
      const res = await fetch(`/api/card-cycles/${cycleId}/revert`, { method: 'POST' })
      if (!res.ok) throw new Error()
      setRevertingCycleId(null)
      router.refresh()
    } catch {
      setRevertError('Error al revertir el pago.')
    } finally {
      setIsReverting(false)
    }
  }

  const deleteCard = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/cards/${currentCard.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      router.back()
    } catch {
      setIsDeleting(false)
      setIsDeletingConfirm(false)
    }
  }

  const startCycleDateEdit = (cycle: EnrichedCycle) => {
    setEditingCycleId(cycle.id)
    setEditingClosingDate(cycle.closing_date)
    setEditingDueDate(cycle.due_date)
    setSaveCycleError(null)
  }

  const cancelCycleDateEdit = () => {
    setEditingCycleId(null)
    setEditingClosingDate('')
    setEditingDueDate('')
    setSaveCycleError(null)
  }

  const saveCycleDates = async () => {
    if (!editingCycleId || !editingClosingDate || !editingDueDate) return
    if (editingDueDate < editingClosingDate) {
      setSaveCycleError('La fecha de vencimiento no puede ser anterior al cierre.')
      return
    }
    setIsSavingCycleDates(true)
    setSaveCycleError(null)
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
      setSaveCycleError('No se pudieron actualizar las fechas del resumen.')
    } finally {
      setIsSavingCycleDates(false)
    }
  }

  const renderCycleCard = (cycle: EnrichedCycle, isEnCurso: boolean) => {
    const hasRecordedPayment = cycle.cycleStatus === 'pagado' && cycle.amount_paid != null
    const paymentDiff = hasRecordedPayment ? cycle.amount - (cycle.amount_paid ?? 0) : 0
    const showPaymentDiff = hasRecordedPayment && Math.abs(paymentDiff) >= 1

    return (
      <div key={cycle.id} className="surface-module rounded-card px-4 py-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="type-body font-semibold text-text-primary">
              {periodMonthLabel(cycle.period_month)}
            </p>
            <p className="mt-0.5 type-meta text-text-tertiary">
              {formatDate(cycle.closing_date)} → {formatDate(cycle.due_date)}
            </p>
            {hasRecordedPayment && (
              <div className="mt-1 space-y-0.5">
                <p className="type-meta text-text-tertiary">
                  Pago registrado: {formatAmount(cycle.amount_paid ?? 0, 'ARS')}
                </p>
                {showPaymentDiff && (
                  <p className={`type-meta font-medium ${paymentDiff > 0 ? 'text-warning' : 'text-text-tertiary'}`}>
                    Diferencia: {formatDiff(paymentDiff)}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className="type-body font-bold tabular-nums text-text-primary">
              {formatAmount(cycle.amount, 'ARS')}
            </span>
            <CycleStatusPill status={cycle.cycleStatus} />
            {cycle.cycleStatus === 'pagado' && cycle.changed_after_payment && (
              <span className="inline-flex items-center rounded-full bg-warning/10 px-2.5 py-0.5 text-[10px] font-semibold text-warning">
                Modificado
              </span>
            )}
          </div>
        </div>

        {/* Detalle de gastos collapsible */}
        <div className="mt-3 overflow-hidden rounded-input bg-bg-primary">
          <button
            onClick={() => setDetailCycleId((current) => (current === cycle.id ? null : cycle.id))}
            className="flex w-full items-center justify-between px-3 py-2.5"
          >
            <span className="type-meta font-medium text-text-secondary">Detalle de gastos</span>
            <div className="flex items-center gap-2">
              <span className="type-meta text-text-tertiary">
                {cycleExpensesMap[cycle.id]?.length ?? 0} items
              </span>
              {detailCycleId === cycle.id ? (
                <CaretUp size={12} className="text-text-tertiary" />
              ) : (
                <CaretDown size={12} className="text-text-tertiary" />
              )}
            </div>
          </button>
          {detailCycleId === cycle.id && (
            <CycleExpensesDetail
              expenses={cycleExpensesMap[cycle.id] ?? []}
              paidAt={cycle.cycleStatus === 'pagado' ? cycle.paid_at : null}
            />
          )}
        </div>

        {/* Editar fechas del resumen */}
        {cycle.source === 'stored' && (cycle.cycleStatus === 'cerrado' || cycle.cycleStatus === 'vencido') && (
          <>
            {editingCycleId === cycle.id ? (
              <div className="mt-3 space-y-2 rounded-input border border-border-subtle bg-bg-primary px-3 py-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="block type-meta text-text-secondary">Cierre</span>
                    <input
                      type="date"
                      value={editingClosingDate}
                      onChange={(e) => setEditingClosingDate(e.target.value)}
                      disabled={isSavingCycleDates}
                      className="w-full rounded-lg border border-border-strong bg-bg-secondary px-2 py-1.5 type-meta text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block type-meta text-text-secondary">Vencimiento</span>
                    <input
                      type="date"
                      value={editingDueDate}
                      onChange={(e) => setEditingDueDate(e.target.value)}
                      disabled={isSavingCycleDates}
                      className="w-full rounded-lg border border-border-strong bg-bg-secondary px-2 py-1.5 type-meta text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    />
                  </label>
                </div>
                <p className="type-meta text-text-tertiary">
                  Al guardar, se recalcula el monto según los gastos del nuevo periodo.
                </p>
                {saveCycleError && (
                  <p className="rounded-card bg-danger-soft px-3 py-2 type-meta text-danger">
                    {saveCycleError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={cancelCycleDateEdit}
                    disabled={isSavingCycleDates}
                    className="flex-1 rounded-full py-1.5 type-meta text-text-secondary hover:bg-bg-secondary disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => void saveCycleDates()}
                    disabled={isSavingCycleDates}
                    className="flex-1 rounded-full bg-primary py-1.5 type-meta font-semibold text-white disabled:opacity-50"
                  >
                    {isSavingCycleDates ? 'Guardando...' : 'Guardar fechas'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => startCycleDateEdit(cycle)}
                className="mt-2 type-meta text-primary underline-offset-2 hover:underline"
              >
                Editar fechas
              </button>
            )}
          </>
        )}

        {/* CTA Pagar — solo para ciclos históricos (cerrado/vencido), no en_curso */}
        {!isEnCurso && cycle.cycleStatus !== 'pagado' && (
          <button
            onClick={() => setPayingCycle(cycle)}
            className="mt-3 w-full rounded-button border border-primary py-2 text-[13px] font-semibold text-primary transition-opacity active:opacity-70"
          >
            Pagar resumen
          </button>
        )}

        {/* Revertir pago */}
        {cycle.cycleStatus === 'pagado' && (
          <>
            {revertingCycleId === cycle.id ? (
              <div className="mt-3 space-y-2 rounded-input bg-danger/10 px-3 py-2.5">
                <p className="type-meta font-medium text-danger">
                  ¿Revertir el pago? Se eliminará el movimiento registrado.
                </p>
                {revertError && <p className="type-meta text-danger">{revertError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setRevertingCycleId(null)
                      setRevertError(null)
                    }}
                    disabled={isReverting}
                    className="flex-1 rounded-full py-1.5 type-meta text-text-secondary transition-colors hover:bg-bg-primary disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => void revertPayment(cycle.id)}
                    disabled={isReverting}
                    className="flex-1 rounded-full bg-danger py-1.5 type-meta font-semibold text-white disabled:opacity-50"
                  >
                    {isReverting ? 'Revirtiendo...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setRevertingCycleId(cycle.id)}
                className="mt-2 type-meta text-text-tertiary underline-offset-2 hover:underline"
              >
                Revertir pago
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header con nombre editable inline */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border-subtle bg-bg-primary/95 px-4 pb-3 pt-safe backdrop-blur-sm">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-bg-secondary"
          aria-label="Volver"
        >
          <ArrowLeft size={18} weight="light" className="text-text-secondary" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="type-label text-text-tertiary">Tarjeta</p>
          {isEditingName ? (
            <input
              autoFocus
              value={nameInputValue}
              onChange={(e) => setNameInputValue(e.target.value)}
              onBlur={() => void handleSaveNameInline()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveNameInline()
                if (e.key === 'Escape') {
                  setIsEditingName(false)
                  setNameInputValue(currentCard.name)
                }
              }}
              className="w-full border-0 border-b border-primary bg-transparent text-base font-bold text-text-primary focus:outline-none"
            />
          ) : (
            <h1
              onClick={() => {
                setIsEditingName(true)
                setNameInputValue(currentCard.name)
              }}
              className="cursor-text truncate text-base font-bold leading-tight text-text-primary"
            >
              {currentCard.name}
            </h1>
          )}
        </div>
      </header>

      <div className="space-y-6 px-4 py-5">
        {/* Zona 1: Configuración — compacta */}
        <section>
          <p className="mb-2 type-label text-text-tertiary">Configuración</p>
          <div className="surface-module rounded-card px-4">
            {/* Fila Ciclo: cierre + vencimiento colapsados */}
            <button
              onClick={() => setIsEditingCycle(true)}
              className={`flex w-full items-center justify-between py-3.5 ${accounts.length > 0 ? 'border-b border-border-subtle' : ''}`}
            >
              <span className="type-meta text-text-secondary">Ciclo</span>
              <div className="flex items-center gap-2">
                <span className="type-meta font-semibold text-text-primary">
                  {currentCard.closing_day && currentCard.due_day
                    ? `Cierre día ${currentCard.closing_day} · Vence día ${currentCard.due_day}`
                    : currentCard.closing_day
                      ? `Cierre día ${currentCard.closing_day}`
                      : 'Sin configurar'}
                </span>
                <span className="type-meta font-medium text-primary">Editar</span>
              </div>
            </button>

            {/* Fila Cuenta + próximo cierre contextual */}
            {accounts.length > 0 && (
              <div className="py-3.5">
                <span className="mb-2 block type-meta text-text-secondary">Cuenta de débito</span>
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
                  {[...accounts].sort((a) => (a.id === currentCard.account_id ? -1 : 1)).map((account) => (
                    <button
                      key={account.id}
                      onClick={() => void patchCard({ account_id: account.id })}
                      className={`flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        currentCard.account_id === account.id
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-border-ocean bg-primary/[0.03] text-text-tertiary'
                      }`}
                    >
                      {account.name}
                    </button>
                  ))}
                </div>
                {upcomingClosingDate && (
                  <p className="mt-2 text-[12px] text-text-dim">
                    Próximo cierre: {formatUpcomingShort(upcomingClosingDate)}
                  </p>
                )}
              </div>
            )}

            {/* Fallback próximo cierre si no hay cuentas */}
            {accounts.length === 0 && upcomingClosingDate && (
              <div className="flex items-center justify-between py-3.5">
                <span className="type-meta text-text-secondary">Próximo cierre</span>
                <span className="text-[12px] text-text-dim">{formatUpcomingShort(upcomingClosingDate)}</span>
              </div>
            )}
          </div>
        </section>

        {/* Zona 2: Resúmenes — protagonista */}
        <section>
          <p className="mb-2 type-label text-text-tertiary">Resúmenes</p>
          {resumenes.length === 0 ? (
            <p className="px-1 type-meta text-text-tertiary">Sin gastos registrados en los últimos meses.</p>
          ) : (
            <div className="space-y-3">
              {/* Resumen en curso */}
              {enCursoCycle && renderCycleCard(enCursoCycle, true)}

              {/* CTA Pagar — elemento propio, entre en_curso e histórico */}
              {enCursoCycle && (
                <button
                  onClick={() => setPayingCycle(enCursoCycle)}
                  className="w-full rounded-button bg-primary py-3 text-[13px] font-semibold text-white transition-opacity active:opacity-70"
                >
                  Pagar resumen — {formatAmount(enCursoCycle.amount, 'ARS')}
                </button>
              )}

              {/* Resúmenes históricos */}
              {otherCycles.map((cycle) => renderCycleCard(cycle, false))}
            </div>
          )}
        </section>

        {/* Zona 3: Acciones secundarias — bajo peso visual */}
        <section className="space-y-4">
          <div className="overflow-hidden rounded-card bg-bg-secondary">
            <button
              onClick={() => setIsLegacyPaymentOpen(true)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:opacity-60"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-tertiary">
                <ClockCounterClockwise size={15} weight="duotone" className="text-text-label" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="type-body font-medium text-text-primary">Pago anterior a Gota</p>
                <p className="type-meta text-text-tertiary">Deuda existente antes de usar la app</p>
              </div>
              <CaretRight size={14} weight="bold" className="shrink-0 text-text-tertiary" />
            </button>
          </div>

          <div className="pb-8 pt-2 text-center">
            {isDeletingConfirm ? (
              <div className="space-y-2 rounded-card bg-danger/5 px-4 py-3 text-left">
                <p className="type-meta font-medium text-danger">¿Eliminar "{currentCard.name}"?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsDeletingConfirm(false)}
                    disabled={isDeleting}
                    className="flex-1 rounded-button border border-border-strong py-2 type-meta text-text-secondary disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => void deleteCard()}
                    disabled={isDeleting}
                    className="flex-1 rounded-button bg-danger py-2 type-meta font-semibold text-white disabled:opacity-50"
                  >
                    {isDeleting ? 'Eliminando...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsDeletingConfirm(true)}
                className="type-meta text-text-dim underline-offset-2 hover:underline"
              >
                Eliminar tarjeta
              </button>
            )}
          </div>
        </section>
      </div>

      {isEditingCycle && (
        <EditCycleModal
          open={isEditingCycle}
          onClose={() => setIsEditingCycle(false)}
          closingDay={currentCard.closing_day}
          dueDay={currentCard.due_day}
          onSave={async (closingDay, dueDay) => {
            await patchCard({ closing_day: closingDay, due_day: dueDay })
          }}
        />
      )}

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
