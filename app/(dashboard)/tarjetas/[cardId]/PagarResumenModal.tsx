'use client'

import { useMemo, useState } from 'react'
import { CaretDown, CaretUp } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import { formatAmount, formatDate, todayAR } from '@/lib/format'
import { CATEGORIES } from '@/lib/validation/schemas'
import type { Account, Card, Expense } from '@/types/database'
import type { EnrichedCycle } from './page'

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

const ADJUSTABLE_CATEGORIES = CATEGORIES.filter((c) => c !== 'Pago de Tarjetas')

export function PagarResumenModal({ open, onClose, onSuccess, cycle, card, accounts, expenses }: Props) {
  const [montoRaw, setMontoRaw] = useState(Math.round(cycle.amount))
  const [accountId, setAccountId] = useState(card.account_id ?? (accounts[0]?.id ?? ''))
  const [fecha, setFecha] = useState(todayAR())
  const [motivo, setMotivo] = useState<Motivo>('no_detallar')
  const [categoriaExtra, setCategoriaExtra] = useState<string>('Otros')
  const [detailOpen, setDetailOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const montoNum = montoRaw
  const diff = Math.round((montoNum - cycle.amount) * 100) / 100
  const hasDiff = Math.abs(diff) >= 1

  const isEqualToTotal = Math.abs(montoNum - cycle.amount) < 1
  const canSubmit = montoNum > 0 && !!accountId && !!fecha && (!hasDiff || motivo !== null)

  const ctaLabel = (() => {
    if (isSaving) return 'Registrando…'
    if (isEqualToTotal) return 'Registrar pago total'
    if (montoNum > 0) return 'Registrar pago parcial'
    return 'Registrar pago'
  })()

  const cycleExpenses = useMemo(
    () =>
      expenses.filter(
        (e) =>
          e.payment_method === 'CREDIT' &&
          e.category !== 'Pago de Tarjetas' &&
          e.date >= cycle.period_from &&
          e.date <= cycle.closing_date,
      ),
    [expenses, cycle.period_from, cycle.closing_date],
  )

  const handleMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stripped = e.target.value.replace(/\D/g, '')
    setMontoRaw(stripped === '' ? 0 : parseInt(stripped, 10))
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsSaving(true)
    setError(null)

    try {
      const cycleRes = await fetch(`/api/card-cycles/${cycle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_paid: montoNum,
          paid_at: `${fecha}T12:00:00.000Z`,
          status: 'paid',
        }),
      })
      if (!cycleRes.ok) throw new Error('Error al registrar el resumen')

      const expRes = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: montoNum,
          currency: 'ARS',
          category: 'Pago de Tarjetas',
          description: `Pago ${card.name}`,
          payment_method: 'DEBIT',
          card_id: card.id,
          account_id: accountId,
          date: fecha,
          is_want: null,
        }),
      })
      if (!expRes.ok) throw new Error('Error al registrar el movimiento')

      if (hasDiff && diff > 0 && motivo !== 'no_detallar') {
        const extraCategory = motivo === 'cargo_banco' ? 'Cargos Bancarios' : categoriaExtra
        const extraPaymentMethod = motivo === 'cargo_banco' ? 'DEBIT' : 'CREDIT'
        const extraDate = fecha
        const extraBody: Record<string, unknown> = {
          amount: diff,
          currency: 'ARS',
          category: extraCategory,
          description: motivo === 'cargo_banco' ? 'Cargo bancario' : 'Gasto no registrado',
          payment_method: extraPaymentMethod,
          account_id: accountId,
          date: extraDate,
          is_want: false,
        }
        if (extraPaymentMethod === 'CREDIT') extraBody.card_id = card.id

        const adjRes = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(extraBody),
        })
        if (!adjRes.ok) {
          const errorText = await adjRes.text()
          throw new Error(errorText || 'Error al registrar el ajuste')
        }
      }

      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />

      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
          Pago de tarjeta · {card.name}
        </p>
        <h2 className="mt-0.5 text-base font-bold text-text-primary">
          {periodMonthLabel(cycle.period_month)}
        </h2>
      </div>

      <div className="space-y-5 pb-24">
        {/* Monto a pagar */}
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
        </div>

        {/* Cuenta y Fecha */}
        <div className="overflow-hidden rounded-[18px] bg-bg-tertiary">
          {accounts.length > 0 && (
            <div className="border-b border-border-subtle px-4 py-3.5">
              <p className="mb-2 text-xs text-text-secondary">Cuenta</p>
              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAccountId(a.id)}
                    className={`flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      accountId === a.id
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
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-sm text-text-secondary">Fecha</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="border-0 appearance-none bg-transparent text-right text-sm font-semibold text-text-primary focus:outline-none [&::-webkit-calendar-picker-indicator]:opacity-50"
            />
          </div>
        </div>

        {/* Gastos registrados */}
        <div className="overflow-hidden rounded-[18px] bg-bg-tertiary">
          <button
            onClick={() => setDetailOpen((o) => !o)}
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
            <div className="space-y-1 border-t border-border-subtle pb-3 pt-2">
              {cycleExpenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-1">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-text-primary">{e.description || e.category}</p>
                    <p className="text-[10px] text-text-tertiary">
                      {formatDate(e.date)} · {e.category}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-text-primary">
                    {formatAmount(e.amount, e.currency as 'ARS' | 'USD')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Diferencia */}
        {hasDiff && (
          <div className="space-y-3 rounded-[18px] bg-bg-secondary px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
              {diff > 0
                ? `Pagas ${formatAmount(diff, 'ARS')} de mas`
                : `Pagas ${formatAmount(Math.abs(diff), 'ARS')} de menos`} · ¿Por que?
            </p>

            {(['gasto_olvidado', 'cargo_banco', 'no_detallar'] as Motivo[]).map((m) => (
              <button key={m} onClick={() => setMotivo(m)} className="flex w-full items-center gap-3 text-left">
                <div
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    motivo === m ? 'border-primary bg-primary' : 'border-border-strong'
                  }`}
                >
                  {motivo === m && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
                <span className="text-sm text-text-primary">
                  {m === 'gasto_olvidado'
                    ? 'Gasto olvidado'
                    : m === 'cargo_banco'
                      ? 'Cargo del banco'
                      : 'No detallar'}
                </span>
              </button>
            ))}

            {motivo === 'gasto_olvidado' && diff > 0 && (
              <div className="mt-1 border-t border-border-subtle pt-3">
                <p className="mb-2 text-[11px] text-text-tertiary">Categoria del gasto olvidado</p>
                <select
                  value={categoriaExtra}
                  onChange={(e) => setCategoriaExtra(e.target.value)}
                  className="w-full rounded-input border border-border-strong bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {ADJUSTABLE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
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
