'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { formatArDecimal, parseArDecimalInput, parseCanonicalDecimal, toCanonicalDecimalString } from '@/lib/ar-input'
import { paymentMethodFromAccountType } from '@/lib/cardPaymentPrompt'
import { formatAmount, todayAR } from '@/lib/format'
import { CATEGORIES } from '@/lib/validation/schemas'
import type { Account, Card, Currency } from '@/types/database'
import type { CycleGroup } from './CardDetailClient'

function periodMonthLabel(periodMonth: string): string {
  const label = new Date(`${periodMonth.substring(0, 7)}-15`).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatShortDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

type Motivo = 'gasto_olvidado' | 'cargo_banco' | 'no_detallar'

type AdjustmentDraft = {
  motivo: Motivo
  categoriaExtra: string
}

const ADJUSTABLE_CATEGORIES = CATEGORIES.filter((category) => category !== 'Pago de Tarjetas')

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
  const bothCurrencies = !!(arsBlock && usdBlock)

  const [arsAmount, setArsAmount] = useState(arsRemaining)
  const [usdAmount, setUsdAmount] = useState(usdRemaining)
  const [usdPayMode, setUsdPayMode] = useState<'USD' | 'ARS'>('ARS')
  const [exchangeRateStr, setExchangeRateStr] = useState('')
  const [accountId, setAccountId] = useState(defaultAccountId)
  const [usdAccountId, setUsdAccountId] = useState(defaultAccountId)
  const [fecha, setFecha] = useState(todayAR())
  const [arsAdjustment, setArsAdjustment] = useState<AdjustmentDraft>({
    motivo: 'no_detallar',
    categoriaExtra: 'Otros',
  })
  const [usdAdjustment, setUsdAdjustment] = useState<AdjustmentDraft>({
    motivo: 'no_detallar',
    categoriaExtra: 'Otros',
  })
  const [availableBalance, setAvailableBalance] = useState<number | null>(null)
  const [arsAvailableBalance, setArsAvailableBalance] = useState<number | null>(null)
  const [usdAvailableBalance, setUsdAvailableBalance] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when cycleGroup changes
  useEffect(() => {
    setArsAmount(arsRemaining)
    setUsdAmount(usdRemaining)
    setUsdPayMode('ARS')
    setExchangeRateStr('')
    setAccountId(defaultAccountId)
    setUsdAccountId(defaultAccountId)
    setFecha(todayAR())
    setArsAdjustment({ motivo: 'no_detallar', categoriaExtra: 'Otros' })
    setUsdAdjustment({ motivo: 'no_detallar', categoriaExtra: 'Otros' })
    setAvailableBalance(null)
    setArsAvailableBalance(null)
    setUsdAvailableBalance(null)
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

  const exchangeRateNum = parseCanonicalDecimal(exchangeRateStr)
  const usdInArs = usdBlock && usdPayMode === 'ARS' ? usdAmount * exchangeRateNum : 0

  // from_currency: ARS if paying anything with ARS, else USD
  const hasArsPortion = !!(arsBlock && arsAmount > 0)
  const hasUsdInArsPortion = !!(usdBlock && usdAmount > 0 && usdPayMode === 'ARS')
  const fromCurrency: Currency = hasArsPortion || hasUsdInArsPortion ? 'ARS' : 'USD'
  const isSplitMode = bothCurrencies && usdPayMode === 'USD' && hasArsPortion && usdAmount > 0
  const primaryAccountLabel = isSplitMode ? 'Cuenta ARS' : fromCurrency === 'USD' ? 'Cuenta USD' : 'Cuenta'

  useEffect(() => {
    let cancelled = false

    if (!accountId || isSplitMode) {
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
  }, [accountId, fromCurrency, isSplitMode])

  useEffect(() => {
    let cancelled = false

    if (!isSplitMode || !accountId || arsAmount <= 0) {
      setArsAvailableBalance(null)
      return
    }

    void fetch('/api/dashboard/account-breakdown?currency=ARS')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        const match = data?.breakdown?.find?.((account: { id: string; saldo: number }) => account.id === accountId)
        setArsAvailableBalance(typeof match?.saldo === 'number' ? match.saldo : null)
      })
      .catch(() => {
        if (!cancelled) setArsAvailableBalance(null)
      })

    return () => {
      cancelled = true
    }
  }, [accountId, arsAmount, isSplitMode])

  useEffect(() => {
    let cancelled = false

    if (!isSplitMode || !usdAccountId || usdAmount <= 0) {
      setUsdAvailableBalance(null)
      return
    }

    void fetch('/api/dashboard/account-breakdown?currency=USD')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        const match = data?.breakdown?.find?.((account: { id: string; saldo: number }) => account.id === usdAccountId)
        setUsdAvailableBalance(typeof match?.saldo === 'number' ? match.saldo : null)
      })
      .catch(() => {
        if (!cancelled) setUsdAvailableBalance(null)
      })

    return () => {
      cancelled = true
    }
  }, [usdAccountId, usdAmount, isSplitMode])

  // Total that leaves the account
  const totalArsOut = (hasArsPortion ? arsAmount : 0) + usdInArs
  const totalUsdOut = usdBlock && usdPayMode === 'USD' && usdAmount > 0 ? usdAmount : 0
  const showTotal = fromCurrency === 'ARS' ? totalArsOut > 0 : totalUsdOut > 0

  const arsAdjustmentAmount = arsBlock ? Math.max(Math.round((arsAmount - arsRemaining) * 100) / 100, 0) : 0
  const usdAdjustmentAmount = usdBlock ? Math.max(Math.round((usdAmount - usdRemaining) * 100) / 100, 0) : 0
  const hasArsAdjustment = arsAdjustmentAmount >= 0.01
  const hasUsdAdjustment = usdAdjustmentAmount >= 0.01

  const needsRate = !!(usdBlock && usdAmount > 0 && usdPayMode === 'ARS')
  const hasAnyAmount = (arsBlock ? arsAmount > 0 : false) || (usdBlock ? usdAmount > 0 : false)
  const requestedAmount = fromCurrency === 'ARS' ? totalArsOut : totalUsdOut
  const exceedsBalance = availableBalance != null && requestedAmount > availableBalance + 0.01
  const arsExceedsBalance = arsAvailableBalance != null && arsAmount > arsAvailableBalance + 0.01
  const usdExceedsBalance = usdAvailableBalance != null && usdAmount > usdAvailableBalance + 0.01
  const requiresPrimaryAccount = isSplitMode ? hasArsPortion : hasAnyAmount
  const requiresUsdAccount = isSplitMode && usdAmount > 0
  const canSubmit =
    hasAnyAmount &&
    !!fecha &&
    (!needsRate || exchangeRateNum > 0) &&
    !isSaving &&
    (!requiresPrimaryAccount || !!accountId) &&
    (!requiresUsdAccount || !!usdAccountId) &&
    (isSplitMode ? !arsExceedsBalance && !usdExceedsBalance : !exceedsBalance)

  const buildAdjustmentPayload = (draft: AdjustmentDraft, amount: number) => {
    if (amount < 0.01 || draft.motivo === 'no_detallar') return undefined

    return {
      amount,
      category: draft.motivo === 'cargo_banco' ? 'Cargos Bancarios' : draft.categoriaExtra,
      description: draft.motivo === 'cargo_banco' ? 'Cargo bancario' : 'Gasto no registrado',
      is_want: false,
    }
  }

  const adjustmentSections = [
    {
      key: 'ars',
      label: 'ARS',
      currency: 'ARS' as const,
      amount: arsAdjustmentAmount,
      visible: hasArsAdjustment,
      draft: arsAdjustment,
      setDraft: setArsAdjustment,
    },
    {
      key: 'usd',
      label: 'USD',
      currency: 'USD' as const,
      amount: usdAdjustmentAmount,
      visible: hasUsdAdjustment,
      draft: usdAdjustment,
      setDraft: setUsdAdjustment,
    },
  ].filter((section) => section.visible)

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
        adjustment?: {
          amount: number
          category: string
          description: string
          is_want: boolean
        }
      }
      const paymentItems: PaymentItem[] = []

      if (arsBlock && arsAmount > 0) {
        const item: PaymentItem = { currency: 'ARS', amount: arsAmount }
        const adjustment = buildAdjustmentPayload(arsAdjustment, arsAdjustmentAmount)
        if (adjustment) item.adjustment = adjustment
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
        const adjustment = buildAdjustmentPayload(usdAdjustment, usdAdjustmentAmount)
        if (adjustment) item.adjustment = adjustment
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

      if (isSplitMode && usdAmount > 0) {
        body.account_id_usd = usdAccountId
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
        <p className="mt-1 text-xs text-text-tertiary">
          Cierre {formatShortDate(cycleGroup.closingDate)} · Vence {formatShortDate(cycleGroup.dueDate)}
        </p>
        <p className="mt-0.5 text-xs text-text-tertiary">
          {cycleGroup.representativeCycle.dates_confirmed_at
            ? 'Fechas confirmadas para este resumen'
            : 'Fechas estimadas: corregilas desde la tarjeta si el banco muestra otras'}
        </p>
      </div>

      <div className="space-y-5 pb-24">

        {/* ── Monto(s) ── */}
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
            Monto a pagar
          </p>

          {bothCurrencies ? (
            /* Unified block: ARS row + USD row + TC row — separated by dividers */
            <div className="overflow-hidden rounded-[18px] bg-bg-tertiary">

              {/* ARS row */}
              <div className="border-b border-border-subtle px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="w-8 shrink-0 text-xs font-semibold text-text-secondary">ARS</span>
                  <span className="shrink-0 text-base font-bold text-text-secondary">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formatArDecimal(toCanonicalDecimalString(arsAmount))}
                    onChange={(e) => {
                      const raw = parseArDecimalInput(e.target.value)
                      setArsAmount(raw === '' ? 0 : parseCanonicalDecimal(raw))
                    }}
                    className="flex-1 border-0 bg-transparent text-right text-[20px] font-bold tabular-nums text-text-primary focus:outline-none"
                    placeholder="0"
                  />
                </div>
                {arsRemaining > 0 && (
                  <p className="mt-1 text-right text-xs text-text-tertiary">
                    Pendiente: {formatAmount(arsRemaining, 'ARS')}
                  </p>
                )}
              </div>

              {/* USD row */}
              <div className={usdPayMode === 'ARS' ? 'border-b border-border-subtle' : ''}>
                <div className="flex justify-end px-4 pt-3">
                  <div className="flex items-center rounded-full bg-bg-secondary p-0.5">
                    {(['USD', 'ARS'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setUsdPayMode(mode)}
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                          usdPayMode === mode ? 'bg-primary text-white' : 'text-text-tertiary'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 pb-3.5 pt-2">
                  <span className="w-8 shrink-0 text-xs font-semibold text-text-secondary">USD</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formatArDecimal(String(usdAmount === 0 ? '' : usdAmount))}
                    onChange={(e) => {
                      const raw = parseArDecimalInput(e.target.value)
                      setUsdAmount(raw === '' ? 0 : parseFloat(raw))
                    }}
                    className="min-w-0 flex-1 border-0 bg-transparent text-right text-[20px] font-bold tabular-nums text-text-primary focus:outline-none"
                    placeholder="0"
                  />
                </div>
                {usdRemaining > 0 && (
                  <p className="pb-2.5 pr-4 text-right text-xs text-text-tertiary">
                    Pendiente: {formatAmount(usdRemaining, 'USD')}
                  </p>
                )}
              </div>

              {/* TC row — only when paying USD with ARS */}
              {usdPayMode === 'ARS' && (
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-text-tertiary">1 USD =</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-text-secondary">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={formatArDecimal(exchangeRateStr)}
                        onChange={(e) => setExchangeRateStr(parseArDecimalInput(e.target.value))}
                        className="w-28 border-0 bg-transparent text-right text-sm font-bold tabular-nums text-text-primary focus:outline-none"
                      />
                    </div>
                  </div>
                  {usdAmount > 0 && exchangeRateNum > 0 && (
                    <p className="mt-0.5 text-right text-xs text-text-tertiary">
                      = {formatAmount(usdInArs, 'ARS')}
                    </p>
                  )}
                </div>
              )}
            </div>

          ) : arsBlock ? (
            /* Single ARS input */
            <div className="flex items-center gap-2 rounded-[18px] bg-bg-tertiary px-4 py-3.5 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-bg-secondary">
              <span className="shrink-0 text-base font-bold text-text-secondary">$</span>
              <input
                type="text"
                inputMode="decimal"
                value={formatArDecimal(toCanonicalDecimalString(arsAmount))}
                onChange={(e) => {
                  const raw = parseArDecimalInput(e.target.value)
                  setArsAmount(raw === '' ? 0 : parseCanonicalDecimal(raw))
                }}
                className="flex-1 border-0 bg-transparent text-right text-[20px] font-bold tabular-nums text-text-primary focus:outline-none"
                placeholder="0"
              />
            </div>

          ) : usdBlock ? (
            /* Single USD input with toggle + TC */
            <div>
              <div className="mb-2 flex items-end justify-end">
                <div className="flex items-center rounded-full bg-bg-tertiary p-0.5">
                  {(['USD', 'ARS'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setUsdPayMode(mode)}
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                        usdPayMode === mode ? 'bg-primary text-white' : 'text-text-tertiary'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-hidden rounded-[18px] bg-bg-tertiary">
                <div className="flex items-center gap-2 px-4 py-3.5">
                  <span className="shrink-0 text-base font-bold text-text-secondary">USD</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formatArDecimal(String(usdAmount === 0 ? '' : usdAmount))}
                    onChange={(e) => {
                      const raw = parseArDecimalInput(e.target.value)
                      setUsdAmount(raw === '' ? 0 : parseFloat(raw))
                    }}
                    className="flex-1 border-0 bg-transparent text-right text-[20px] font-bold tabular-nums text-text-primary focus:outline-none"
                    placeholder="0"
                  />
                </div>
                {usdPayMode === 'ARS' && (
                  <div className="border-t border-border-subtle px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-text-tertiary">1 USD =</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-text-secondary">$</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0,00"
                          value={formatArDecimal(exchangeRateStr)}
                          onChange={(e) => setExchangeRateStr(parseArDecimalInput(e.target.value))}
                          className="w-28 border-0 bg-transparent text-right text-sm font-bold tabular-nums text-text-primary focus:outline-none"
                        />
                      </div>
                    </div>
                    {usdAmount > 0 && exchangeRateNum > 0 && (
                      <p className="mt-0.5 text-right text-xs text-text-tertiary">
                        = {formatAmount(usdInArs, 'ARS')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Hints below the amount block */}
          {!bothCurrencies && arsBlock && arsRemaining > 0 && (
            <p className="mt-1.5 text-xs text-text-tertiary">
              Disponible: {formatAmount(arsRemaining, 'ARS')}
            </p>
          )}
          {!bothCurrencies && usdBlock && usdRemaining > 0 && (
            <p className="mt-1.5 text-xs text-text-tertiary">
              Pendiente: {formatAmount(usdRemaining, 'USD')}
            </p>
          )}
        </div>

        {/* ── Cuenta & Fecha ── */}
        <div className="overflow-hidden rounded-[18px] bg-bg-tertiary">
          {accounts.length > 0 && (
            <>
              <div className="border-b border-border-subtle px-4 py-3.5">
                <p className="mb-2 text-xs text-text-secondary">{primaryAccountLabel}</p>
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
              {isSplitMode && (
                <div className="border-b border-border-subtle px-4 py-3.5">
                  <p className="mb-2 text-xs text-text-secondary">Cuenta USD</p>
                  <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {accounts.map((account) => (
                      <button
                        key={`usd-${account.id}`}
                        onClick={() => setUsdAccountId(account.id)}
                        className={`flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          usdAccountId === account.id
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
            </>
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

        {/* ── Summary hints (plain text, no extra cards) ── */}
        {isSplitMode ? (
          <div className="space-y-1 px-1">
            {hasArsPortion && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-tertiary">Sale de cuenta ARS</span>
                  <span className="text-xs font-bold tabular-nums text-text-primary">
                    {formatAmount(arsAmount, 'ARS')}
                  </span>
                </div>
                {arsAvailableBalance != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-tertiary">Disponible ARS</span>
                    <span className={`text-xs font-semibold tabular-nums ${arsExceedsBalance ? 'text-danger' : 'text-text-secondary'}`}>
                      {formatAmount(arsAvailableBalance, 'ARS')}
                    </span>
                  </div>
                )}
              </>
            )}
            {usdAmount > 0 && (
              <>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-text-tertiary">Sale de cuenta USD</span>
                  <span className="text-xs font-bold tabular-nums text-text-primary">
                    {formatAmount(usdAmount, 'USD')}
                  </span>
                </div>
                {usdAvailableBalance != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-tertiary">Disponible USD</span>
                    <span className={`text-xs font-semibold tabular-nums ${usdExceedsBalance ? 'text-danger' : 'text-text-secondary'}`}>
                      {formatAmount(usdAvailableBalance, 'USD')}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          (showTotal || availableBalance != null) && (
            <div className="space-y-1 px-1">
              {showTotal && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-tertiary">Total que sale de tu cuenta</span>
                  <span className="text-xs font-bold tabular-nums text-text-primary">
                    {fromCurrency === 'ARS'
                      ? formatAmount(totalArsOut, 'ARS')
                      : formatAmount(totalUsdOut, 'USD')}
                  </span>
                </div>
              )}
              {availableBalance != null && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-tertiary">Disponible hoy</span>
                  <span className={`text-xs font-semibold tabular-nums ${exceedsBalance ? 'text-danger' : 'text-text-secondary'}`}>
                    {formatAmount(availableBalance, fromCurrency)}
                  </span>
                </div>
              )}
            </div>
          )
        )}

        {(isSplitMode ? arsExceedsBalance || usdExceedsBalance : exceedsBalance) && (
          <p className="px-1 text-xs text-danger">
            {isSplitMode
              ? 'El pago supera el saldo de una de las cuentas seleccionadas.'
              : 'El pago supera el saldo de la cuenta seleccionada.'}
          </p>
        )}

        {adjustmentSections.length > 0 && (
          <div className="space-y-3 rounded-[18px] bg-bg-secondary px-4 py-4">
            {adjustmentSections.map((section) => (
              <div key={section.key} className="space-y-3 first:mt-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                  {section.label}: pagas {formatAmount(section.amount, section.currency)} de más · ¿Por qué?
                </p>

                {(['gasto_olvidado', 'cargo_banco', 'no_detallar'] as Motivo[]).map((motivo) => (
                  <button
                    key={`${section.key}-${motivo}`}
                    type="button"
                    onClick={() => section.setDraft((current) => ({ ...current, motivo }))}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        section.draft.motivo === motivo ? 'border-primary bg-primary' : 'border-border-strong'
                      }`}
                    >
                      {section.draft.motivo === motivo && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                    <span className="text-sm text-text-primary">
                      {motivo === 'gasto_olvidado'
                        ? 'Gasto olvidado'
                        : motivo === 'cargo_banco'
                          ? 'Cargo del banco'
                          : 'No detallar'}
                    </span>
                  </button>
                ))}

                {section.draft.motivo === 'gasto_olvidado' && (
                  <div className="mt-1 border-t border-border-subtle pt-3">
                    <p className="mb-2 text-[11px] text-text-tertiary">Categoría del gasto olvidado</p>
                    <select
                      value={section.draft.categoriaExtra}
                      onChange={(event) =>
                        section.setDraft((current) => ({ ...current, categoriaExtra: event.target.value }))
                      }
                      className="w-full rounded-input border border-border-strong bg-bg-primary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {ADJUSTABLE_CATEGORIES.map((category) => (
                        <option key={`${section.key}-${category}`} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
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
