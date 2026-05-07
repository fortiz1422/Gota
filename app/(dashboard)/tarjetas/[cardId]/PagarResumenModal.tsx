'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { paymentMethodFromAccountType } from '@/lib/cardPaymentPrompt'
import { formatAmount, todayAR } from '@/lib/format'
import type { Account, Card, Currency } from '@/types/database'
import type { CycleGroup } from './CardDetailClient'

/** "1234.56" → "1.234,56" */
function toAR(raw: string): string {
  if (!raw) return ''
  const [int, dec] = raw.split('.')
  const intFmt = (int ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return dec !== undefined ? `${intFmt},${dec}` : intFmt
}

/** "1.234,56" → "1234.56" */
function fromAR(display: string): string {
  const clean = display.replace(/[^\d,]/g, '').replace(',', '.')
  const parts = clean.split('.')
  if (parts.length > 2) return parts[0] + '.' + parts.slice(1).join('')
  return clean
}

function periodMonthLabel(periodMonth: string): string {
  const label = new Date(`${periodMonth.substring(0, 7)}-15`).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatMoneyInput(n: number): string {
  if (n === 0) return ''
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n)
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  cycleGroup: CycleGroup
  card: Card
  accounts: Account[]
}

export function PagarResumenModal({ open, onClose, onSuccess, cycleGroup, card, accounts }: Props) {
  const arsBlock = cycleGroup.blocks.find((b) => b.currency === 'ARS') ?? null
  const usdBlock = cycleGroup.blocks.find((b) => b.currency === 'USD') ?? null

  const arsRemaining = arsBlock
    ? arsBlock.cycle.remaining_amount > 0
      ? arsBlock.cycle.remaining_amount
      : Math.max(arsBlock.cycle.amount - (arsBlock.cycle.amount_paid ?? 0), 0)
    : 0

  const usdRemaining = usdBlock
    ? usdBlock.cycle.remaining_amount > 0
      ? usdBlock.cycle.remaining_amount
      : Math.max(usdBlock.cycle.amount - (usdBlock.cycle.amount_paid ?? 0), 0)
    : 0

  const defaultAccountId = card.account_id ?? (accounts[0]?.id ?? '')

  const [arsAmount, setArsAmount] = useState(Math.round(arsRemaining))
  const [usdAmount, setUsdAmount] = useState(usdRemaining)
  const [usdPayMode, setUsdPayMode] = useState<'USD' | 'ARS'>('ARS')
  const [exchangeRateStr, setExchangeRateStr] = useState('')
  const [accountId, setAccountId] = useState(defaultAccountId)
  const [fecha, setFecha] = useState(todayAR())
  const [availableBalance, setAvailableBalance] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when cycleGroup changes
  useEffect(() => {
    setArsAmount(Math.round(arsRemaining))
    setUsdAmount(usdRemaining)
    setUsdPayMode('ARS')
    setExchangeRateStr('')
    setAccountId(defaultAccountId)
    setFecha(todayAR())
    setAvailableBalance(null)
    setError(null)
  }, [cycleGroup.key]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch exchange rate when USD paid with ARS
  useEffect(() => {
    if (usdPayMode !== 'ARS' || !usdBlock) return
    let cancelled = false
    fetch('/api/cotizaciones')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.venta) return
        setExchangeRateStr(String(data.venta))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [usdPayMode, usdBlock])

  const exchangeRateNum = parseFloat(fromAR(exchangeRateStr)) || 0
  const usdInArs = usdBlock && usdPayMode === 'ARS' ? usdAmount * exchangeRateNum : 0

  // from_currency: ARS if paying anything with ARS, else USD
  const hasArsPortion = !!(arsBlock && arsAmount > 0)
  const hasUsdInArsPortion = !!(usdBlock && usdAmount > 0 && usdPayMode === 'ARS')
  const fromCurrency: Currency = hasArsPortion || hasUsdInArsPortion ? 'ARS' : 'USD'

  useEffect(() => {
    let cancelled = false

    if (!accountId) {
      setAvailableBalance(null)
      return
    }

    void fetch(`/api/dashboard/account-breakdown?currency=${fromCurrency}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        const match = data?.breakdown?.find?.((account: { id: string; saldo: number }) => account.id === accountId)
        setAvailableBalance(typeof match?.saldo === 'number' ? match.saldo : null)
      })
      .catch(() => {
        if (!cancelled) setAvailableBalance(null)
      })

    return () => {
      cancelled = true
    }
  }, [accountId, fromCurrency])

  // Total that leaves the account
  const totalArsOut = (hasArsPortion ? arsAmount : 0) + usdInArs
  const totalUsdOut = usdBlock && usdPayMode === 'USD' && usdAmount > 0 ? usdAmount : 0
  const showTotal = fromCurrency === 'ARS' ? totalArsOut > 0 : totalUsdOut > 0

  const needsRate = !!(usdBlock && usdAmount > 0 && usdPayMode === 'ARS')
  const hasAnyAmount = (arsBlock ? arsAmount > 0 : false) || (usdBlock ? usdAmount > 0 : false)
  const requestedAmount = fromCurrency === 'ARS' ? totalArsOut : totalUsdOut
  const exceedsBalance = availableBalance != null && requestedAmount > availableBalance + 0.01
  const canSubmit =
    hasAnyAmount && !!accountId && !!fecha && (!needsRate || exchangeRateNum > 0) && !isSaving && !exceedsBalance

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsSaving(true)
    setError(null)

    try {
      const selectedAccount = accounts.find((a) => a.id === accountId) ?? null
      const payment_method = selectedAccount ? paymentMethodFromAccountType(selectedAccount.type) : 'DEBIT'

      // Build payments array
      type PaymentItem = {
        currency: 'ARS' | 'USD'
        amount: number
        cycle_id?: string
        cycle?: { period_month: string; closing_date: string; due_date: string }
      }
      const paymentItems: PaymentItem[] = []

      if (arsBlock && arsAmount > 0) {
        const item: PaymentItem = { currency: 'ARS', amount: arsAmount }
        if (arsBlock.cycle.source === 'stored') {
          item.cycle_id = arsBlock.cycle.id
        } else {
          item.cycle = {
            period_month: arsBlock.cycle.period_month.substring(0, 7),
            closing_date: arsBlock.cycle.closing_date,
            due_date: arsBlock.cycle.due_date,
          }
        }
        paymentItems.push(item)
      }

      if (usdBlock && usdAmount > 0) {
        const item: PaymentItem = { currency: 'USD', amount: usdAmount }
        if (usdBlock.cycle.source === 'stored') {
          item.cycle_id = usdBlock.cycle.id
        } else {
          item.cycle = {
            period_month: usdBlock.cycle.period_month.substring(0, 7),
            closing_date: usdBlock.cycle.closing_date,
            due_date: usdBlock.cycle.due_date,
          }
        }
        paymentItems.push(item)
      }

      const body: Record<string, unknown> = {
        card_id: card.id,
        account_id: accountId,
        payment_method,
        date: fecha,
        description: `Pago ${card.name}`,
        payments: paymentItems,
        from_currency: fromCurrency,
      }

      if (needsRate && exchangeRateNum > 0) {
        body.exchange_rate = exchangeRateNum
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
          {periodMonthLabel(cycleGroup.periodMonth)}
        </h2>
      </div>

      <div className="space-y-4 pb-28">

        {/* ── ARS portion ── */}
        {arsBlock && (
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
              Monto ARS
            </p>
            <div className="flex items-center gap-2 rounded-[18px] bg-bg-tertiary px-4 py-3.5 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-bg-secondary">
              <span className="shrink-0 text-base font-bold text-text-secondary">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={formatMoneyInput(arsAmount)}
                onChange={(e) => {
                  const stripped = e.target.value.replace(/\D/g, '')
                  setArsAmount(stripped === '' ? 0 : parseInt(stripped, 10))
                }}
                className="flex-1 border-0 bg-transparent text-right text-[20px] font-bold tabular-nums text-text-primary focus:outline-none"
                placeholder="0"
              />
            </div>
            {arsRemaining > 0 && (
              <p className="mt-1.5 text-xs text-text-tertiary">
                Saldo: {formatAmount(arsRemaining, 'ARS')}
              </p>
            )}
          </div>
        )}

        {/* ── USD portion ── */}
        {usdBlock && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                Monto USD
              </p>
              {/* Toggle: pay in USD / ARS */}
              <div className="flex items-center gap-1 rounded-full bg-bg-tertiary p-0.5">
                {(['USD', 'ARS'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setUsdPayMode(mode)}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                      usdPayMode === mode
                        ? 'bg-primary text-white'
                        : 'text-text-tertiary hover:text-text-secondary'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-[18px] bg-bg-tertiary px-4 py-3.5 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-bg-secondary">
              <span className="shrink-0 text-base font-bold text-text-secondary">USD</span>
              <input
                type="text"
                inputMode="decimal"
                value={toAR(String(usdAmount === 0 ? '' : usdAmount))}
                onChange={(e) => {
                  const raw = fromAR(e.target.value)
                  setUsdAmount(raw === '' ? 0 : parseFloat(raw))
                }}
                className="flex-1 border-0 bg-transparent text-right text-[20px] font-bold tabular-nums text-text-primary focus:outline-none"
                placeholder="0"
              />
            </div>

            {usdRemaining > 0 && (
              <p className="mt-1.5 text-xs text-text-tertiary">
                Saldo: {formatAmount(usdRemaining, 'USD')}
              </p>
            )}

            {/* Exchange rate section (only when paying USD with ARS) */}
            {usdPayMode === 'ARS' && (
              <div className="mt-3 rounded-[16px] bg-bg-secondary px-4 py-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-text-secondary">Tipo de cambio · 1 USD =</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-text-secondary">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={toAR(exchangeRateStr)}
                      onChange={(e) => setExchangeRateStr(fromAR(e.target.value))}
                      className="w-28 border-0 bg-transparent text-right text-sm font-bold tabular-nums text-text-primary focus:outline-none"
                    />
                  </div>
                </div>
                {usdAmount > 0 && exchangeRateNum > 0 && (
                  <p className="text-right text-xs text-text-tertiary">
                    = {formatAmount(usdInArs, 'ARS')} ARS
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Cuenta & Fecha ── */}
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
              onChange={(e) => setFecha(e.target.value)}
              className="appearance-none border-0 bg-transparent text-right text-sm font-semibold text-text-primary focus:outline-none [&::-webkit-calendar-picker-indicator]:opacity-50"
            />
          </div>
        </div>

        {/* ── Total summary ── */}
        {showTotal && (
          <div className="rounded-[16px] bg-bg-secondary px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Total que sale de tu cuenta</span>
              <span className="text-sm font-bold tabular-nums text-text-primary">
                {fromCurrency === 'ARS'
                  ? formatAmount(totalArsOut, 'ARS')
                  : formatAmount(totalUsdOut, 'USD')}
              </span>
            </div>
          </div>
        )}

        {availableBalance != null && (
          <div className="rounded-[16px] bg-bg-secondary px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">Disponible hoy</span>
              <span className="text-sm font-semibold text-text-primary">
                {formatAmount(availableBalance, fromCurrency)}
              </span>
            </div>
          </div>
        )}

        {exceedsBalance && (
          <p className="rounded-[14px] bg-danger-soft px-4 py-3 text-sm text-danger">
            El pago supera el saldo actual de la cuenta seleccionada.
          </p>
        )}

        {error && <p className="rounded-[14px] bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
      </div>

      <div className="sticky bottom-0 -mx-6 -mb-6 bg-bg-secondary px-6 pb-6 pt-4">
        <button
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          className="w-full rounded-button bg-primary py-3 text-[14px] font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-95 disabled:opacity-40"
        >
          {isSaving ? 'Registrando...' : 'Registrar pago'}
        </button>
      </div>
    </Modal>
  )
}
