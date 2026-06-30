'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CaretDown, CaretUp, CheckCircle, ClockCounterClockwise } from '@phosphor-icons/react'
import { formatAmount } from '@/lib/format'
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
  upcomingCycle: EnrichedCycle | null
  expenses: Expense[]
  initialCurrency: Currency
}

interface PayingTarget {
  cycleGroup: CycleGroup
}

export interface CycleGroup {
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

function getGroupStatus(group: CycleGroup): EnrichedCycle['cycleStatus'] {
  const statuses = group.blocks.map((b) => b.cycle.cycleStatus)
  if (statuses.some((s) => s === 'vencido')) return 'vencido'
  if (statuses.some((s) => s === 'en_curso')) return 'en_curso'
  if (statuses.every((s) => s === 'pagado')) return 'pagado'
  return 'cerrado'
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
      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
        Actual
      </span>
    )
  }
  if (status === 'cerrado') {
    return (
      <span className="inline-flex items-center rounded-full border border-border-strong bg-bg-tertiary px-2.5 py-0.5 text-[10px] font-semibold text-text-secondary">
        Cerrado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-warning/10 px-2.5 py-0.5 text-[10px] font-semibold text-warning">
      Pendiente
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

function formatUpcomingShort(date: string): string {
  const d = new Date(`${date}T12:00:00`)
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export function CardDetailClient({
  card,
  accounts,
  resumenesByCurrency,
  upcomingCycle,
  expenses,
  initialCurrency,
}: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
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
  const [expandedStatementKey, setExpandedStatementKey] = useState<string | null>(null)
  const [isEditingAccountConfig, setIsEditingAccountConfig] = useState(false)

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

    for (const currency of ['ARS', 'USD'] as const) {
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
        blocks: (['ARS', 'USD'] as const)
          .map((currency) => group.blocks.find((block) => block.currency === currency))
          .filter((block): block is CycleGroup['blocks'][number] => block != null),
      }))
      .sort((a, b) => b.periodMonth.localeCompare(a.periodMonth))
  }, [resumenesByCurrency])

  const heroGroup = useMemo(
    () =>
      combinedCycles.find((g) => getGroupStatus(g) === 'vencido') ??
      combinedCycles.find((g) => getGroupStatus(g) === 'cerrado') ??
      combinedCycles.find((g) => g.isCurrent) ??
      combinedCycles[0] ??
      null,
    [combinedCycles],
  )

  const expandedKey = expandedStatementKey

  function toggleStatement(key: string) {
    setExpandedStatementKey((prev) => (prev === key ? null : key))
  }

  const selectedAccount = accounts.find((a) => a.id === currentCard.account_id)
  const editableCycles = useMemo(() => {
    const byId = new Map<string, EnrichedCycle>()
    for (const group of combinedCycles) {
      byId.set(group.representativeCycle.id, group.representativeCycle)
      for (const block of group.blocks) byId.set(block.cycle.id, block.cycle)
    }
    if (upcomingCycle) byId.set(upcomingCycle.id, upcomingCycle)
    return [...byId.values()]
  }, [combinedCycles, upcomingCycle])

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
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['account-breakdown'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
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
    const editingCycle = editableCycles.find((cycle) => cycle.id === editingCycleId)
    if (!editingCycle) return

    setIsSavingCycleDates(true)
    setSaveCycleError(null)
    try {
      const datesConfirmedAt = new Date().toISOString()
      const isLegacyCycle = editingCycle.source === 'legacy'
      const res = await fetch(isLegacyCycle ? '/api/card-cycles' : `/api/card-cycles/${editingCycle.id}`, {
        method: isLegacyCycle ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isLegacyCycle
            ? {
                card_id: currentCard.id,
                period_month: editingCycle.period_month.substring(0, 7),
                closing_date: editingClosingDate,
                due_date: editingDueDate,
                dates_confirmed_at: datesConfirmedAt,
              }
            : {
                closing_date: editingClosingDate,
                due_date: editingDueDate,
                amount_draft: null,
                dates_confirmed_at: datesConfirmedAt,
              },
        ),
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

  const renderCycleDateEditPanel = (description: string) => (
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
      <p className="type-meta text-text-tertiary">{description}</p>
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
  )

  const renderHero = () => {
    if (!heroGroup) return null

    const arsBlock = heroGroup.blocks.find((b) => b.currency === 'ARS')
    const usdBlock = heroGroup.blocks.find((b) => b.currency === 'USD')
    const arsRemaining =
      arsBlock?.cycle.cycleStatus !== 'pagado' ? (arsBlock?.cycle.remaining_amount ?? 0) : 0
    const usdRemaining =
      usdBlock?.cycle.cycleStatus !== 'pagado' ? (usdBlock?.cycle.remaining_amount ?? 0) : 0
    const anyPending = heroGroup.blocks.some((b) => b.cycle.cycleStatus !== 'pagado')

    return (
      <div className="surface-module rounded-card px-4 py-5">
        {anyPending ? (
          <>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
              A pagar
            </span>
            <p className="mt-1.5 type-meta text-text-tertiary">
              Resumen de {periodMonthLabel(heroGroup.periodMonth)}
            </p>

            <div className="mt-2">
              {arsRemaining > 0 && (
                <p className="text-[28px] font-bold tabular-nums leading-tight text-text-primary">
                  {formatAmount(arsRemaining, 'ARS')}
                </p>
              )}
              {usdRemaining > 0 && (
                <p className="type-body-lg font-semibold tabular-nums text-text-secondary">
                  {formatAmount(usdRemaining, 'USD')}
                </p>
              )}
            </div>

            <p className="mt-2 type-meta text-text-tertiary">
              Vence {formatUpcomingShort(heroGroup.dueDate)} · Cierra{' '}
              {formatUpcomingShort(heroGroup.closingDate)}
            </p>

            <button
              onClick={() => startCycleDateEdit(heroGroup.representativeCycle)}
              className="mt-2 type-meta font-medium text-primary underline-offset-2 hover:underline"
            >
              Editar fechas de este resumen
            </button>
            {editingCycleId === heroGroup.representativeCycle.id &&
              renderCycleDateEditPanel('Guarda fechas exactas solo para este resumen actual.')}

            <button
              onClick={() => setPayingTarget({ cycleGroup: heroGroup })}
              className="mt-4 w-full rounded-button bg-primary py-2.5 text-[13px] font-semibold text-white transition-opacity active:opacity-70"
            >
              Registrar pago
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <CheckCircle size={20} weight="fill" className="text-success" />
              <p className="type-body font-semibold text-text-primary">Todo al día</p>
            </div>
            <p className="mt-1 type-meta text-text-tertiary">
              Resumen de {periodMonthLabel(heroGroup.periodMonth)} pagado
            </p>
          </>
        )}
      </div>
    )
  }

  const renderCurrencyDetailRow = (block: CycleGroup['blocks'][number]) => {
    const { cycle, currency } = block
    const actionKey = `${cycle.id}:${currency}`

    return (
      <div key={actionKey}>
        <button
          onClick={() => setDetailKey((prev) => (prev === actionKey ? null : actionKey))}
          className="flex w-full items-center justify-between px-3 py-2.5"
        >
          <div className="flex items-center gap-2.5">
            <span className="rounded-full bg-primary/[0.08] px-2 py-0.5 text-[10px] font-semibold text-primary">
              {currency}
            </span>
            <span className="type-body font-semibold tabular-nums text-text-primary">
              {formatAmount(cycle.amount, currency)}
            </span>
            {cycle.has_partial_payment && (
              <span className="text-[10px] text-warning">Pago parcial</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-right">
            {cycle.cycleStatus === 'pagado' && (
              <CheckCircle size={14} weight="fill" className="text-success" />
            )}
            <span className="type-meta text-text-tertiary">
              {cycleExpensesMap[actionKey]?.length ?? 0} gastos
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

        {(cycle.cycleStatus === 'pagado' || (cycle.amount_paid ?? 0) > 0) && (
          <>
            {revertingKey === actionKey ? (
              <div className="mx-3 mb-2.5 space-y-2 rounded-input bg-danger/10 px-3 py-2.5">
                <p className="type-meta font-medium text-danger">
                  Queres revertir el pago {currency}? Se eliminara el movimiento registrado.
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
                className="px-3 pb-2.5 type-meta text-text-tertiary underline-offset-2 hover:underline"
              >
                Revertir pago {currency}
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  const renderStatementAccordion = (group: CycleGroup) => {
    const isExpanded = expandedKey === group.key
    const groupStatus = getGroupStatus(group)
    const arsBlock = group.blocks.find((b) => b.currency === 'ARS')
    const usdBlock = group.blocks.find((b) => b.currency === 'USD')
    const arsRemaining =
      arsBlock?.cycle.cycleStatus !== 'pagado' ? (arsBlock?.cycle.remaining_amount ?? 0) : 0
    const usdRemaining =
      usdBlock?.cycle.cycleStatus !== 'pagado' ? (usdBlock?.cycle.remaining_amount ?? 0) : 0
    const anyUnpaid = group.blocks.some((b) => b.cycle.cycleStatus !== 'pagado')

    // Permitir corregir fechas de cualquier resumen visible: si viene del fallback legacy,
    // al guardar se materializa en card_cycles para no pisar la regla habitual.
    const editableBlock = group.blocks[0]

    return (
      <div key={group.key} className="surface-module overflow-hidden rounded-card">
        <button
          onClick={() => toggleStatement(group.key)}
          className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left"
        >
          <div>
            <p className="type-body font-semibold text-text-primary">
              {periodMonthLabel(group.periodMonth)}
            </p>
            <p className="mt-0.5 type-meta text-text-tertiary">
              Cierre {formatUpcomingShort(group.closingDate)} · Vence{' '}
              {formatUpcomingShort(group.dueDate)}
            </p>
            {!isExpanded && anyUnpaid && (
              <p className="mt-1 type-meta tabular-nums text-text-secondary">
                {arsRemaining > 0 && formatAmount(arsRemaining, 'ARS')}
                {arsRemaining > 0 && usdRemaining > 0 && ' · '}
                {usdRemaining > 0 && formatAmount(usdRemaining, 'USD')}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <CycleStatusPill status={groupStatus} />
            {isExpanded ? (
              <CaretUp size={14} className="text-text-tertiary" />
            ) : (
              <CaretDown size={14} className="text-text-tertiary" />
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="border-t border-border-subtle px-4 pb-4 pt-3">
            {anyUnpaid && (
              <div className="mb-3">
                <p className="mb-1 type-label uppercase tracking-wide text-text-tertiary">
                  A pagar
                </p>
                {arsRemaining > 0 && (
                  <p className="font-bold tabular-nums text-text-primary">
                    {formatAmount(arsRemaining, 'ARS')}
                  </p>
                )}
                {usdRemaining > 0 && (
                  <p className="type-body font-semibold tabular-nums text-text-secondary">
                    {formatAmount(usdRemaining, 'USD')}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1 overflow-hidden rounded-input bg-bg-tertiary">
              {group.blocks.map((block) => renderCurrencyDetailRow(block))}
            </div>

            {editableBlock && (
              <>
                {editingCycleId === editableBlock.cycle.id ? (
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
                    onClick={() => startCycleDateEdit(editableBlock.cycle)}
                    className="mt-2 type-meta text-primary underline-offset-2 hover:underline"
                  >
                    Editar fechas
                  </button>
                )}
              </>
            )}

            {anyUnpaid && (
              <button
                onClick={() => setPayingTarget({ cycleGroup: group })}
                className="mt-3 w-full rounded-button border border-primary py-2 text-[13px] font-semibold text-primary transition-opacity active:opacity-70"
              >
                Registrar pago
              </button>
            )}

            {group.representativeCycle.source === 'legacy' && (
              <p className="mt-3 type-meta text-text-tertiary">
                Este resumen todavia viene del historial calculado por Gota.
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  const heroGroupStatus = heroGroup ? getGroupStatus(heroGroup) : null
  const datePreviewCycle = heroGroup && heroGroupStatus !== 'pagado' ? heroGroup.representativeCycle : upcomingCycle
  const datePreviewLabel = heroGroup && heroGroupStatus !== 'pagado' ? 'Resumen activo' : 'Próximo resumen'
  const headerSubtitle = heroGroup
    ? heroGroupStatus === 'vencido'
      ? `Resumen vencido · venció ${formatUpcomingShort(heroGroup.dueDate)}`
      : heroGroupStatus === 'cerrado'
        ? `Resumen cerrado · vence ${formatUpcomingShort(heroGroup.dueDate)}`
        : heroGroup.isCurrent
          ? `Resumen actual · vence ${formatUpcomingShort(heroGroup.dueDate)}`
          : null
    : null

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
          {!isEditingName && headerSubtitle && (
            <p className="type-meta text-text-tertiary">{headerSubtitle}</p>
          )}
        </div>
      </header>

      <div className="space-y-6 px-4 py-5 pb-32">
        {/* Hero financiero */}
        {renderHero()}

        {/* Resumenes accordion */}
        <section>
          {combinedCycles.length === 0 ? (
            <p className="px-1 type-meta text-text-tertiary">
              Sin gastos registrados en los ultimos meses.
            </p>
          ) : (
            <div className="space-y-3">
              {combinedCycles.map((group) => renderStatementAccordion(group))}
            </div>
          )}
        </section>

        {/* Configuracion */}
        <section>
          <p className="mb-2 type-label text-text-tertiary">Configuracion</p>
          <div className="surface-module rounded-card px-4">
            <button
              onClick={() => setIsEditingCycle(true)}
              className="flex w-full items-center justify-between border-b border-border-subtle py-3.5"
            >
              <span className="type-meta text-text-secondary">Ciclo habitual</span>
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
            <p className="border-b border-border-subtle pb-3 type-meta text-text-tertiary">
              Se usa para estimar próximos resúmenes. Las fechas reales se corrigen por período.
            </p>

            <div className={`py-3.5 ${datePreviewCycle ? 'border-b border-border-subtle' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="type-meta text-text-secondary">Cuenta de débito</span>
                <div className="flex items-center gap-2">
                  <span className="type-meta text-text-primary">
                    {selectedAccount?.name ?? 'Sin cuenta'}
                  </span>
                  <button
                    onClick={() => setIsEditingAccountConfig((prev) => !prev)}
                    className="type-meta font-medium text-primary"
                  >
                    Editar
                  </button>
                </div>
              </div>
              {isEditingAccountConfig && (
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <button
                    onClick={() => {
                      void patchCard({ account_id: null })
                      setIsEditingAccountConfig(false)
                    }}
                    className={`flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      !currentCard.account_id
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border-ocean bg-primary/[0.03] text-text-tertiary'
                    }`}
                  >
                    Sin cuenta
                  </button>
                  {[...accounts]
                    .sort((a) => (a.id === currentCard.account_id ? -1 : 1))
                    .map((account) => (
                      <button
                        key={account.id}
                        onClick={() => {
                          void patchCard({ account_id: account.id })
                          setIsEditingAccountConfig(false)
                        }}
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
              )}
            </div>

            {datePreviewCycle && (
              <div className="py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="type-meta text-text-secondary">{datePreviewLabel}</span>
                    <p className="mt-0.5 type-meta font-semibold text-text-primary">
                      Cierra {formatUpcomingShort(datePreviewCycle.closing_date)} · Vence{' '}
                      {formatUpcomingShort(datePreviewCycle.due_date)}
                    </p>
                    <p className="mt-0.5 type-meta text-text-tertiary">
                      {datePreviewCycle.dates_confirmed_at ? 'Fechas confirmadas' : 'Estimado por ciclo habitual'}
                    </p>
                  </div>
                  <button
                    onClick={() => startCycleDateEdit(datePreviewCycle)}
                    className="type-meta font-medium text-primary"
                  >
                    Editar
                  </button>
                </div>
                {editingCycleId === datePreviewCycle.id &&
                  renderCycleDateEditPanel(
                    datePreviewLabel === 'Resumen activo'
                      ? 'Guarda fechas exactas solo para este resumen actual.'
                      : 'Guarda fechas exactas solo para este resumen futuro.',
                  )}
              </div>
            )}
          </div>
        </section>

        {/* Pago anterior a Gota */}
        <section>
          <div className="overflow-hidden rounded-card bg-bg-secondary">
            <div className="px-4 py-3.5">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-tertiary">
                  <ClockCounterClockwise size={15} weight="duotone" className="text-text-label" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="type-body font-medium text-text-primary">Pago anterior a Gota</p>
                  <p className="type-meta text-text-tertiary">
                    Elegi la moneda de la deuda que queres registrar
                  </p>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                {(['ARS', 'USD'] as const).map((currency) => (
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
        </section>

        {/* Eliminar tarjeta */}
        <div className="pt-2 text-center">
          {isDeletingConfirm ? (
            <div className="space-y-2 rounded-card bg-danger/5 px-4 py-3 text-left">
              <p className="type-meta font-medium text-danger">Eliminar &quot;{currentCard.name}&quot;?</p>
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
          cycleGroup={payingTarget.cycleGroup}
          card={currentCard}
          accounts={accounts}
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
