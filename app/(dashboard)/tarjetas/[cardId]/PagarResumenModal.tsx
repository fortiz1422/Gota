'use client'

import { useEffect, useMemo, useState } from 'react'
import { CaretDown, CaretUp } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import { paymentMethodFromAccountType } from '@/lib/cardPaymentPrompt'
import { formatAmount, todayAR } from '@/lib/format'
import { CATEGORIES } from '@/lib/validation/schemas'
import type { EnrichedCycle } from '@/lib/card-summaries'
import type { Account, Card, Expense } from '@/types/database'
import { CycleExpensesDetail } from './CycleExpensesDetail'

type Motivo = 'gasto_olvidado' | 'cargo_banco' | 'no_detallar'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  cycle: EnrichedCycle
  card: Card
  accounts: Account[]
  expenses: Expense[]
}

function periodMonthLabel(periodMonth: string): string {
  const label = new Date(`${periodMonth.substring(0, 7)}-15`).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatARS(n: number): string {
  if (n === 0) return ''
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n)
}

const ADJUSTABLE_CATEGORIES = CATEGORIES.filter((category) => category !== 'Pago de Tarjetas')

export function PagarResumenModal({ open, onClose, onSuccess, cycle, card, accounts, expenses }: Props) {
  const remainingAmount = cycle.remaining_amount > 0
    ? cycle.remaining_amount
    : Math.max(cycle.amount - (cycle.amount_paid ?? 0), 0)
  const defaultAccountId = card.account_id ?? (accounts[0]?.id ?? '')

  const [montoRaw, setMontoRaw] = useState(Math.round(remainingAmount))
  const [accountId, setAccountId] = useState(defaultAccountId)
  const [fecha, setFecha] = useState(todayAR())
  const [motivo, setMotivo] = useState<Motivo>('no_detallar')
  const [categoriaExtra, setCategoriaExtra] = useState<string>('Otros')
  const [detailOpen, setDetailOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMontoRaw(Math.round(remainingAmount))
    setAccountId(defaultAccountId)
    setFecha(todayAR())
    setMotivo('no_detallar')
    setCategoriaExtra('Otros')
    setDetailOpen(false)
    setError(null)
  }, [cycle.id, remainingAmount, defaultAccountId])

  const selectedAccount = accounts.find((account) => account.id === accountId) ?? null
  const isOpenCycle = cycle.cycleStatus === 'en_curso'
  const montoNum = montoRaw
  const extraAmount = !isOpenCycle
    ? Math.round((montoNum - remainingAmount) * 100) / 100
    : 0
  const hasAdjustment = extraAmount >= 1
  const isEqualToRemaining = Math.abs(montoNum - remainingAmount) < 1
  const canSubmit = montoNum > 0 && !!accountId && !!fecha && (!hasAdjustment || motivo !== null)

  const ctaLabel = (() => {
    if (isSaving) return 'Registrando...'
    if (isOpenCycle) return cycle.has_partial_payment ? 'Registrar otro pago' : 'Registrar pago'
    if (isEqualToRemaining) return cycle.has_partial_payment ? 'Completar pago' : 'Registrar pago total'
    if (montoNum > 0 && montoNum < remainingAmount) return 'Registrar pago parcial'
    if (hasAdjustment) return 'Registrar pago y ajuste'
    return 'Registrar pago'
  })()

  const cycleExpenses = useMemo(
    () =>
      expenses.filter(
        (expense) =>
          expense.payment_method === 'CREDIT' &&
          expense.category !== 'Pago de Tarjetas' &&
          expense.date >= cycle.period_from &&
          expense.date <= cycle.closing_date,
      ),
    [expenses, cycle.period_from, cycle.closing_date],
  )

  const handleMontoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const stripped = event.target.value.replace(/\D/g, '')
    setMontoRaw(stripped === '' ? 0 : parseInt(stripped, 10))
  }

  const handleSubmit = async () => {
    if (!canSubmit) return

    setIsSaving(true)
    setError(null)

    try {
      const payment_method = selectedAccount
        ? paymentMethodFromAccountType(selectedAccount.type)
        : 'DEBIT'
      const adjustment = hasAdjustment && motivo !== 'no_detallar'
        ? {
            amount: extraAmount,
            category: motivo === 'cargo_banco' ? 'Cargos Bancarios' : categoriaExtra,
            description: motivo === 'cargo_banco' ? 'Cargo bancario' : 'Gasto no registrado',
            is_want: false,
          }
        : null

      const body: Record<string, unknown> = {
        amount: montoNum,
        currency: 'ARS',
        card_id: card.id,
        account_id: accountId,
        payment_method,
        date: fecha,
        description: `Pago ${card.name}`,
      }

      if (cycle.source === 'stored') {
        body.cycle_id = cycle.id
      } else {
        body.cycle = {
          period_month: cycle.period_month.substring(0, 7),
          closing_date: cycle.closing_date,
          due_date: cycle.due_date,
        }
      }

      if (adjustment) {
        body.adjustment = adjustment
      }

      const response = await fetch('/api/card-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? 'Error al registrar el pago')
      }

      onSuccess()
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Error inesperado')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />

      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
          Pago de tarjeta | {card.name}
        </p>
        <h2 className="mt-0.5 text-base font-bold text-text-primary">
          {periodMonthLabel(cycle.period_month)}
        </h2>
      </div>

      <div className="space-y-5 pb-24">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
            Monto a pagar
          </p>
          <div className="flex items-center gap-2 rounded-[18px] bg-bg-tertiary px-4 py-3.5 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-bg-secondary">
            <span className="shrink-0 text-base font-bold text-text-secondary">$</span>
            <input
              type="text"
              inputMode="numeric"
              value={formatARS(montoRaw)}
              onChange={handleMontoChange}
              className="flex-1 border-0 bg-transparent text-right text-[20px] font-bold tabular-nums text-text-primary focus:outline-none"
              placeholder="0"
            />
          </div>
          <div className="mt-2 space-y-1">
            {(cycle.amount_paid ?? 0) > 0 && (
              <p className="text-xs text-text-tertiary">
                Ya registraste {formatAmount(cycle.amount_paid ?? 0, 'ARS')}.
              </p>
            )}
            {!isOpenCycle && remainingAmount > 0 && (
              <p className="text-xs text-text-tertiary">
                Si pagas {formatAmount(remainingAmount, 'ARS')} completas este resumen.
              </p>
            )}
            {isOpenCycle && (
              <p className="text-xs text-text-tertiary">
                Hoy tenes cargado {formatAmount(cycle.amount, 'ARS')} en este ciclo.
              </p>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-[18px] bg-bg-tertiary">
          {accounts.length > 0 && (
            <div className="border-b border-border-subtle px-4 py-3.5">
              <p className="mb-2 text-xs text-text-secondary">Cuenta</p>
              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {accounts.map((account) => (
                  <button
                    key={account.id}
                    onClick={() => setAccountId(account.id)}
                    className={`flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      accountId === account.id
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border-ocean bg-primary/[0.03] text-text-tertiary'
                    }`}
                  >
                    {account.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-sm text-text-secondary">Fecha</span>
            <input
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              className="border-0 appearance-none bg-transparent text-right text-sm font-semibold text-text-primary focus:outline-none [&::-webkit-calendar-picker-indicator]:opacity-50"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-[18px] bg-bg-tertiary">
          <button
            onClick={() => setDetailOpen((current) => !current)}
            className="flex w-full items-center justify-between px-4 py-3.5"
          >
            <span className="text-sm text-text-secondary">Gastos registrados</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tabular-nums text-text-primary">
                {formatAmount(cycle.amount, 'ARS')}
              </span>
              {cycleExpenses.length > 0 &&
                (detailOpen ? (
                  <CaretUp size={12} className="text-text-tertiary" />
                ) : (
                  <CaretDown size={12} className="text-text-tertiary" />
                ))}
            </div>
          </button>

          {detailOpen && cycleExpenses.length > 0 && (
            <CycleExpensesDetail expenses={cycleExpenses} />
          )}
        </div>

        {hasAdjustment && (
          <div className="space-y-3 rounded-[18px] bg-bg-secondary px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
              Pagas {formatAmount(extraAmount, 'ARS')} de mas | Por que?
            </p>

            {(['gasto_olvidado', 'cargo_banco', 'no_detallar'] as Motivo[]).map((option) => (
              <button
                key={option}
                onClick={() => setMotivo(option)}
                className="flex w-full items-center gap-3 text-left"
              >
                <div
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    motivo === option ? 'border-primary bg-primary' : 'border-border-strong'
                  }`}
                >
                  {motivo === option && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
                <span className="text-sm text-text-primary">
                  {option === 'gasto_olvidado'
                    ? 'Gasto olvidado'
                    : option === 'cargo_banco'
                      ? 'Cargo del banco'
                      : 'No detallar'}
                </span>
              </button>
            ))}

            {motivo === 'gasto_olvidado' && (
              <div className="mt-1 border-t border-border-subtle pt-3">
                <p className="mb-2 text-[11px] text-text-tertiary">Categoria del gasto olvidado</p>
                <select
                  value={categoriaExtra}
                  onChange={(event) => setCategoriaExtra(event.target.value)}
                  className="w-full rounded-input border border-border-strong bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {ADJUSTABLE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {error && <p className="rounded-[14px] bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
      </div>

      <div className="sticky bottom-0 -mx-6 -mb-6 bg-bg-secondary px-6 pb-6 pt-4">
        <button
          onClick={() => void handleSubmit()}
          disabled={!canSubmit || isSaving}
          className="w-full rounded-button bg-primary py-3 text-[14px] font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-95 disabled:opacity-40"
        >
          {ctaLabel}
        </button>
      </div>
    </Modal>
  )
}
