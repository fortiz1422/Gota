'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CaretDown, CaretRight, CaretUp, ClockCounterClockwise } from '@phosphor-icons/react'
import { formatAmount, formatDate } from '@/lib/format'
import type { EnrichedCycle } from '@/lib/card-summaries'
import type { Account, Card, Currency, Expense } from '@/types/database'
import { CycleExpensesDetail } from './CycleExpensesDetail'
import { EditCycleModal } from './EditCycleModal'
import { LegacyCardPaymentModal } from './LegacyCardPaymentModal'
import { PagarResumenModal } from './PagarResumenModal'

interface Props {
  card: Card
  accounts: Account[]
  resumenesByCurrency: Record<'ARS' | 'USD', EnrichedCycle[]>
  upcomingClosingDate: string | null
  expenses: Expense[]
  initialCurrency: Currency
}

interface PayingTarget {
  cycle: EnrichedCycle
  currency: Currency
}

interface CycleGroup {
  key: string
  periodMonth: string
  closingDate: string
  dueDate: string
  isCurrent: boolean
  representativeCycle: EnrichedCycle
  blocks: Array<{
    currency: Currency
    cycle: EnrichedCycle
  }>
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

function formatDiff(diff: number, currency: Currency): string {
  if (diff === 0) return '$0'
  const sign = diff > 0 ? '+' : '-'
  return `${sign}${formatAmount(Math.abs(diff), currency)}`
}

function formatUpcomingShort(date: string): string {
  const d = new Date(`${date}T12:00:00`)
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export function CardDetailClient({
  card,
  accounts,
  resumenesByCurrency,
  upcomingClosingDate,
  expenses,
  initialCurrency,
}: Props) {
  const router = useRouter()
  const [currentCard, setCurrentCard] = useState<Card>(card)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeletingConfirm, setIsDeletingConfirm] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameInputValue, setNameInputValue] = useState(card.name)
  const [isEditingCycle, setIsEditingCycle] = useState(false)
  const [payingTarget, setPayingTarget] = useState<PayingTarget | null>(null)
  const [legacyPaymentCurrency, setLegacyPaymentCurrency] = useState<Currency | null>(null)
  const [revertingKey, setRevertingKey] = useState<string | null>(null)
  const [isReverting, setIsReverting] = useState(false)
  const [editingCycleId, setEditingCycleId] = useState<string | null>(null)
  const [editingClosingDate, setEditingClosingDate] = useState('')
  const [editingDueDate, setEditingDueDate] = useState('')
  const [isSavingCycleDates, setIsSavingCycleDates] = useState(false)
  const [saveCycleError, setSaveCycleError] = useState<string | null>(null)
  const [revertError, setRevertError] = useState<string | null>(null)
  const [detailKey, setDetailKey] = useState<string | null>(null)

  const currencyOrder = useMemo<Currency[]>(
    () => (initialCurrency === 'USD' ? ['USD', 'ARS'] : ['ARS', 'USD']),
    [initialCurrency],
  )

  const cycleExpensesMap = useMemo(() => {
    const next: Record<string, Expense[]> = {}

    for (const currency of ['ARS', 'USD'] as const) {
      for (const cycle of resumenesByCurrency[currency]) {
        next[`${cycle.id}:${currency}`] = expenses.filter(
          (expense) =>
            expense.currency === currency &&
            expense.payment_method === 'CREDIT' &&
            expense.category !== 'Pago de Tarjetas' &&
            expense.date >= cycle.period_from &&
            expense.date <= cycle.closing_date,
        )
      }
    }

    return next
  }, [expenses, resumenesByCurrency])

  const combinedCycles = useMemo(() => {
    const grouped = new Map<string, CycleGroup>()

    for (const currency of currencyOrder) {
      for (const cycle of resumenesByCurrency[currency]) {
        const key = cycle.period_month
        const existing = grouped.get(key)

        if (existing) {
          existing.blocks.push({ currency, cycle })
          continue
        }

        grouped.set(key, {
          key,
          periodMonth: cycle.period_month,
          closingDate: cycle.closing_date,
          dueDate: cycle.due_date,
          isCurrent: cycle.cycleStatus === 'en_curso',
          representativeCycle: cycle,
          blocks: [{ currency, cycle }],
        })
      }
    }

    return [...grouped.values()]
      .map((group) => ({
        ...group,
        blocks: currencyOrder
          .map((currency) => group.blocks.find((block) => block.currency === currency))
          .filter((block): block is CycleGroup['blocks'][number] => block != null),
      }))
      .sort((a, b) => b.periodMonth.localeCompare(a.periodMonth))
  }, [currencyOrder, resumenesByCurrency])

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

  const revertPayment = async (cycleId: string, currency: Currency) => {
    setIsReverting(true)
    setRevertError(null)
    try {
      const res = await fetch(`/api/card-cycles/${cycleId}/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Error al revertir el pago.')
      }
      setRevertingKey(null)
      router.refresh()
    } catch (error) {
      setRevertError(error instanceof Error ? error.message : 'Error al revertir el pago.')
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

  const renderCurrencyBlock = (
    group: CycleGroup,
    block: CycleGroup['blocks'][number],
    isPrimaryBlock: boolean,
  ) => {
    const { cycle, currency } = block
    const actionKey = `${cycle.id}:${currency}`
    const hasRecordedPayment = (cycle.amount_paid ?? 0) > 0
    const paymentDiff = cycle.amount - (cycle.amount_paid ?? 0)
    const showPaymentDiff = cycle.cycleStatus === 'pagado' && Math.abs(paymentDiff) >= 1
    const canEditDates =
      cycle.source === 'stored' && (cycle.cycleStatus === 'cerrado' || cycle.cycleStatus === 'vencido')

    const payLabel = group.isCurrent
      ? cycle.has_partial_payment
        ? 'Registrar otro pago'
        : 'Registrar pago'
      : cycle.has_partial_payment
        ? 'Registrar otro pago'
        : 'Pagar resumen'

    return (
      <div
        key={actionKey}
        className={`rounded-input border px-3 py-3 ${
          isPrimaryBlock
            ? 'border-primary/15 bg-primary/[0.04]'
            : 'border-border-subtle bg-bg-primary'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="type-label text-text-tertiary">{currency}</span>
              <CycleStatusPill status={cycle.cycleStatus} />
              {cycle.has_partial_payment && (
                <span className="inline-flex items-center rounded-full bg-warning/10 px-2.5 py-0.5 text-[10px] font-semibold text-warning">
                  Pago parcial
                </span>
              )}
              {cycle.cycleStatus === 'pagado' && cycle.changed_after_payment && (
                <span className="inline-flex items-center rounded-full bg-warning/10 px-2.5 py-0.5 text-[10px] font-semibold text-warning">
                  Modificado
                </span>
              )}
            </div>

            {hasRecordedPayment && (
              <div className="mt-2 space-y-0.5">
                <p className="type-meta text-text-tertiary">
                  Pago registrado: {formatAmount(cycle.amount_paid ?? 0, currency)}
                </p>
                {cycle.has_partial_payment ? (
                  <p className="type-meta font-medium text-warning">
                    Resta: {formatAmount(cycle.remaining_amount, currency)}
                  </p>
                ) : showPaymentDiff ? (
                  <p
                    className={`type-meta font-medium ${
                      paymentDiff > 0 ? 'text-warning' : 'text-text-tertiary'
                    }`}
                  >
                    Diferencia: {formatDiff(paymentDiff, currency)}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <div className="shrink-0 text-right">
            <p className="type-body font-bold tabular-nums text-text-primary">
              {formatAmount(cycle.amount, currency)}
            </p>
            {cycle.remaining_amount > 0 && cycle.cycleStatus !== 'pagado' && (
              <p className="mt-1 type-meta text-text-tertiary">
                Pendiente: {formatAmount(cycle.remaining_amount, currency)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-input bg-bg-secondary">
          <button
            onClick={() => setDetailKey((current) => (current === actionKey ? null : actionKey))}
            className="flex w-full items-center justify-between px-3 py-2.5"
          >
            <span className="type-meta font-medium text-text-secondary">Detalle de gastos</span>
            <div className="flex items-center gap-2">
              <span className="type-meta text-text-tertiary">
                {cycleExpensesMap[actionKey]?.length ?? 0} items
              </span>
              {detailKey === actionKey ? (
                <CaretUp size={12} className="text-text-tertiary" />
              ) : (
                <CaretDown size={12} className="text-text-tertiary" />
              )}
            </div>
          </button>
          {detailKey === actionKey && (
            <CycleExpensesDetail
              expenses={cycleExpensesMap[actionKey] ?? []}
              paidAt={cycle.cycleStatus === 'pagado' ? cycle.paid_at : null}
            />
          )}
        </div>

        {canEditDates && (
          <>
            {editingCycleId === cycle.id ? (
              <div className="mt-3 space-y-2 rounded-input border border-border-subtle bg-bg-primary px-3 py-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1">
                    <span className="block type-meta text-text-secondary">Cierre</span>
                    <input
                      type="date"
                      value={editingClosingDate}
                      onChange={(event) => setEditingClosingDate(event.target.value)}
                      disabled={isSavingCycleDates}
                      className="w-full rounded-lg border border-border-strong bg-bg-secondary px-2 py-1.5 type-meta text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block type-meta text-text-secondary">Vencimiento</span>
                    <input
                      type="date"
                      value={editingDueDate}
                      onChange={(event) => setEditingDueDate(event.target.value)}
                      disabled={isSavingCycleDates}
                      className="w-full rounded-lg border border-border-strong bg-bg-secondary px-2 py-1.5 type-meta text-text-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    />
                  </label>
                </div>
                <p className="type-meta text-text-tertiary">
                  Al guardar, se recalcula el monto segun los gastos del nuevo periodo.
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

        {cycle.cycleStatus !== 'pagado' && (
          <button
            onClick={() => setPayingTarget({ cycle, currency })}
            className="mt-3 w-full rounded-button border border-primary py-2 text-[13px] font-semibold text-primary transition-opacity active:opacity-70"
          >
            {payLabel}
            {group.isCurrent && (
              <>
                {' - '}
                {formatAmount(
                  cycle.remaining_amount > 0 ? cycle.remaining_amount : cycle.amount,
                  currency,
                )}
              </>
            )}
          </button>
        )}

        {cycle.cycleStatus === 'pagado' && (
          <>
            {revertingKey === actionKey ? (
              <div className="mt-3 space-y-2 rounded-input bg-danger/10 px-3 py-2.5">
                <p className="type-meta font-medium text-danger">
                  Queres revertir este pago? Se eliminara el movimiento registrado.
                </p>
                {revertError && <p className="type-meta text-danger">{revertError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setRevertingKey(null)
                      setRevertError(null)
                    }}
                    disabled={isReverting}
                    className="flex-1 rounded-full py-1.5 type-meta text-text-secondary transition-colors hover:bg-bg-primary disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => void revertPayment(cycle.id, currency)}
                    disabled={isReverting}
                    className="flex-1 rounded-full bg-danger py-1.5 type-meta font-semibold text-white disabled:opacity-50"
                  >
                    {isReverting ? 'Revirtiendo...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setRevertingKey(actionKey)}
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
              onChange={(event) => setNameInputValue(event.target.value)}
              onBlur={() => void handleSaveNameInline()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleSaveNameInline()
                if (event.key === 'Escape') {
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
        <section>
          <p className="mb-2 type-label text-text-tertiary">Configuracion</p>
          <div className="surface-module rounded-card px-4">
            <button
              onClick={() => setIsEditingCycle(true)}
              className={`flex w-full items-center justify-between py-3.5 ${accounts.length > 0 ? 'border-b border-border-subtle' : ''}`}
            >
              <span className="type-meta text-text-secondary">Ciclo</span>
              <div className="flex items-center gap-2">
                <span className="type-meta font-semibold text-text-primary">
                  {currentCard.closing_day && currentCard.due_day
                    ? `Cierre dia ${currentCard.closing_day} - Vence dia ${currentCard.due_day}`
                    : currentCard.closing_day
                      ? `Cierre dia ${currentCard.closing_day}`
                      : 'Sin configurar'}
                </span>
                <span className="type-meta font-medium text-primary">Editar</span>
              </div>
            </button>

            {accounts.length > 0 && (
              <div className="py-3.5">
                <span className="mb-2 block type-meta text-text-secondary">Cuenta de debito</span>
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
                    Proximo cierre: {formatUpcomingShort(upcomingClosingDate)}
                  </p>
                )}
              </div>
            )}

            {accounts.length === 0 && upcomingClosingDate && (
              <div className="flex items-center justify-between py-3.5">
                <span className="type-meta text-text-secondary">Proximo cierre</span>
                <span className="text-[12px] text-text-dim">{formatUpcomingShort(upcomingClosingDate)}</span>
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="type-label text-text-tertiary">Resumenes</p>
            <div className="flex items-center gap-1">
              {currencyOrder.map((currency) => (
                <span
                  key={currency}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide ${
                    currency === initialCurrency
                      ? 'bg-primary/10 text-primary'
                      : 'bg-bg-secondary text-text-tertiary'
                  }`}
                >
                  {currency}
                </span>
              ))}
            </div>
          </div>

          {combinedCycles.length === 0 ? (
            <p className="px-1 type-meta text-text-tertiary">
              Sin gastos registrados en los ultimos meses.
            </p>
          ) : (
            <div className="space-y-3">
              {combinedCycles.map((group) => (
                <div key={group.key} className="surface-module rounded-card px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="type-body font-semibold text-text-primary">
                        {periodMonthLabel(group.periodMonth)}
                      </p>
                      <p className="mt-0.5 type-meta text-text-tertiary">
                        {formatDate(group.closingDate)} - {formatDate(group.dueDate)}
                      </p>
                    </div>
                    {group.isCurrent && (
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                        Resumen actual
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-3">
                    {group.blocks.map((block, index) =>
                      renderCurrencyBlock(group, block, index === 0),
                    )}
                  </div>

                  {group.representativeCycle.source === 'legacy' && (
                    <p className="mt-3 type-meta text-text-tertiary">
                      Este resumen todavia viene del historial calculado por Gota.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="overflow-hidden rounded-card bg-bg-secondary">
            <div className="px-4 py-3.5">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-tertiary">
                  <ClockCounterClockwise size={15} weight="duotone" className="text-text-label" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="type-body font-medium text-text-primary">Pago anterior a Gota</p>
                  <p className="type-meta text-text-tertiary">Elegi la moneda de la deuda que queres registrar</p>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                {currencyOrder.map((currency) => (
                  <button
                    key={currency}
                    onClick={() => setLegacyPaymentCurrency(currency)}
                    className="flex-1 rounded-button border border-primary py-2 text-[13px] font-semibold text-primary transition-opacity active:opacity-70"
                  >
                    Registrar {currency}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pb-8 pt-2 text-center">
            {isDeletingConfirm ? (
              <div className="space-y-2 rounded-card bg-danger/5 px-4 py-3 text-left">
                <p className="type-meta font-medium text-danger">Eliminar "{currentCard.name}"?</p>
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

      {payingTarget && (
        <PagarResumenModal
          open={!!payingTarget}
          onClose={() => setPayingTarget(null)}
          onSuccess={() => {
            setPayingTarget(null)
            router.refresh()
          }}
          cycle={payingTarget.cycle}
          card={currentCard}
          accounts={accounts}
          expenses={expenses}
          currency={payingTarget.currency}
        />
      )}

      <LegacyCardPaymentModal
        open={legacyPaymentCurrency != null}
        onClose={() => setLegacyPaymentCurrency(null)}
        onSuccess={() => {
          setLegacyPaymentCurrency(null)
          router.refresh()
        }}
        card={currentCard}
        accounts={accounts}
        currency={legacyPaymentCurrency ?? initialCurrency}
      />
    </div>
  )
}
