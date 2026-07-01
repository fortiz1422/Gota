'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { InlineError } from '@/components/ui/InlineError'
import { formatAmount } from '@/lib/format'
import { trackEvent } from '@/lib/product-analytics/client'
import type { CardPaymentPromptCandidate } from '@/lib/card-payment-prompts'
import type { CardPaymentPromptSubmitInput } from '@/hooks/useCardPaymentPrompts'
import type { Account, Currency } from '@/types/database'

type CotizacionLike = {
  venta: number
} | null

interface Props {
  candidate: CardPaymentPromptCandidate
  accounts: Account[]
  cotizacion: CotizacionLike
  onConfirm: (input: CardPaymentPromptSubmitInput) => Promise<void>
  onDismiss: () => void
}

function formatShortDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function periodMonthLabel(periodMonth: string): string {
  const label = new Date(`${periodMonth}-15T12:00:00`).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function parseAmount(value: string): number {
  const normalized = value.replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0
}

function formatInitialAmount(value: number): string {
  return String(Math.round(value * 100) / 100)
}

function accountLabel(account: Account): string {
  if (account.type === 'digital') return `${account.name} · billetera`
  if (account.type === 'cash') return `${account.name} · efectivo`
  return account.name
}

export function CardPaymentPrompt({ candidate, accounts, cotizacion, onConfirm, onDismiss }: Props) {
  const paymentAccounts = useMemo(() => {
    const nonCash = accounts.filter((account) => account.type !== 'cash')
    return nonCash.length > 0 ? nonCash : accounts
  }, [accounts])

  const arsBlock = candidate.blocks.find((block) => block.currency === 'ARS') ?? null
  const usdBlock = candidate.blocks.find((block) => block.currency === 'USD') ?? null
  const defaultAccountId = candidate.card.account_id ?? paymentAccounts[0]?.id ?? ''
  const currenciesLabel = candidate.blocks.map((block) => block.currency).join('+')

  const [arsValue, setArsValue] = useState(formatInitialAmount(arsBlock?.cycle.remaining_amount ?? 0))
  const [usdValue, setUsdValue] = useState(formatInitialAmount(usdBlock?.cycle.remaining_amount ?? 0))
  const [usdPayMode, setUsdPayMode] = useState<'ARS' | 'USD'>('ARS')
  const [exchangeRateValue, setExchangeRateValue] = useState(cotizacion?.venta ? String(cotizacion.venta) : '')
  const [accountId, setAccountId] = useState(defaultAccountId)
  const [usdAccountId, setUsdAccountId] = useState(defaultAccountId)
  const [availableBalance, setAvailableBalance] = useState<number | null>(null)
  const [arsAvailableBalance, setArsAvailableBalance] = useState<number | null>(null)
  const [usdAvailableBalance, setUsdAvailableBalance] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const seenTrackedRef = useRef<string | null>(null)

  useEffect(() => {
    setArsValue(formatInitialAmount(arsBlock?.cycle.remaining_amount ?? 0))
    setUsdValue(formatInitialAmount(usdBlock?.cycle.remaining_amount ?? 0))
    setUsdPayMode('ARS')
    setExchangeRateValue(cotizacion?.venta ? String(cotizacion.venta) : '')
    setAccountId(defaultAccountId)
    setUsdAccountId(defaultAccountId)
    setSubmitError(null)
    setAvailableBalance(null)
    setArsAvailableBalance(null)
    setUsdAvailableBalance(null)
  }, [candidate.key, arsBlock?.cycle.remaining_amount, usdBlock?.cycle.remaining_amount, cotizacion?.venta, defaultAccountId])

  useEffect(() => {
    if (seenTrackedRef.current === candidate.key) return
    seenTrackedRef.current = candidate.key
    trackEvent('card_payment_prompt_seen', { currency: currenciesLabel })
  }, [candidate.key, currenciesLabel])

  const arsAmount = arsBlock ? parseAmount(arsValue) : 0
  const usdAmount = usdBlock ? parseAmount(usdValue) : 0
  const exchangeRate = parseAmount(exchangeRateValue)
  const hasArsPortion = !!arsBlock && arsAmount > 0
  const hasUsdInArsPortion = !!usdBlock && usdAmount > 0 && usdPayMode === 'ARS'
  const fromCurrency: Currency = hasArsPortion || hasUsdInArsPortion ? 'ARS' : 'USD'
  const isSplitMode = !!arsBlock && !!usdBlock && usdPayMode === 'USD' && arsAmount > 0 && usdAmount > 0
  const totalArsOut = (hasArsPortion ? arsAmount : 0) + (hasUsdInArsPortion ? usdAmount * exchangeRate : 0)
  const totalUsdOut = usdBlock && usdPayMode === 'USD' ? usdAmount : 0
  const requestedAmount = fromCurrency === 'ARS' ? totalArsOut : totalUsdOut
  const needsRate = hasUsdInArsPortion

  const exceedsBalance = availableBalance != null && requestedAmount > availableBalance + 0.01
  const arsExceedsBalance = arsAvailableBalance != null && arsAmount > arsAvailableBalance + 0.01
  const usdExceedsBalance = usdAvailableBalance != null && usdAmount > usdAvailableBalance + 0.01
  const hasAnyAmount = arsAmount > 0 || usdAmount > 0
  const canSubmit =
    hasAnyAmount &&
    !isSaving &&
    (!needsRate || exchangeRate > 0) &&
    (isSplitMode ? !!accountId && !!usdAccountId && !arsExceedsBalance && !usdExceedsBalance : !!accountId && !exceedsBalance)

  useEffect(() => {
    let cancelled = false

    if (!accountId || isSplitMode || !hasAnyAmount) {
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
  }, [accountId, fromCurrency, hasAnyAmount, isSplitMode])

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

  const handleDismiss = () => {
    trackEvent('card_payment_prompt_dismissed', { currency: currenciesLabel })
    onDismiss()
  }

  const handleConfirm = async () => {
    if (!canSubmit) return
    setSubmitError(null)
    setIsSaving(true)
    try {
      await onConfirm({
        accountId,
        accountIdUsd: isSplitMode ? usdAccountId : null,
        fromCurrency,
        exchangeRate: needsRate ? exchangeRate : null,
        payments: [
          ...(arsBlock ? [{ currency: 'ARS' as const, amount: arsAmount }] : []),
          ...(usdBlock ? [{ currency: 'USD' as const, amount: usdAmount }] : []),
        ],
      })
      trackEvent('card_payment_prompt_confirmed', {
        currency: currenciesLabel,
        edited_amount:
          arsAmount !== (arsBlock?.cycle.remaining_amount ?? 0) ||
          usdAmount !== (usdBlock?.cycle.remaining_amount ?? 0),
      })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Error al registrar el pago.')
      setIsSaving(false)
    }
  }

  const renderAccountSelect = (
    label: string,
    value: string,
    onChange: (next: string) => void,
    currency: Currency,
    balance: number | null,
    hasError: boolean,
  ) => (
    <label className="block">
      <span className="mb-1 block text-xs text-text-tertiary">{label}</span>
      <select
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setSubmitError(null)
        }}
        className="w-full rounded-button border border-border-subtle bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary outline-none"
      >
        {paymentAccounts.map((account) => (
          <option key={account.id} value={account.id}>
            {accountLabel(account)}
          </option>
        ))}
      </select>
      {balance != null && (
        <span className={`mt-1 block text-[11px] ${hasError ? 'text-danger' : 'text-text-tertiary'}`}>
          Disponible: {formatAmount(balance, currency)}
        </span>
      )}
    </label>
  )

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={handleDismiss} />

      <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-h-[88dvh] max-w-md overflow-y-auto rounded-t-[24px] border-t border-border-subtle bg-bg-secondary px-5 pb-8 pt-4 slide-up">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-text-disabled" />

        <div className="mb-4">
          <p className="type-label text-text-tertiary">Resumen por pagar</p>
          <h2 className="mt-1 text-lg font-semibold text-text-primary">Pago de {candidate.card.name}</h2>
          <p className="mt-1 text-xs text-text-tertiary">
            {periodMonthLabel(candidate.periodMonth)} · cierra {formatShortDate(candidate.closingDate)} · vence{' '}
            {formatShortDate(candidate.dueDate)}
          </p>
        </div>

        <div className="space-y-3">
          {arsBlock && (
            <div className="rounded-card bg-bg-tertiary px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-text-secondary">ARS pendiente</span>
                {arsBlock.cycle.has_partial_payment && <span className="text-[11px] text-warning">Pago parcial</span>}
              </div>
              <p className="mb-2 text-xl font-semibold tabular-nums text-text-primary">
                {formatAmount(arsBlock.cycle.remaining_amount, 'ARS')}
              </p>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={arsValue}
                onChange={(event) => {
                  setArsValue(event.target.value)
                  setSubmitError(null)
                }}
                className="w-full rounded-button border border-border-subtle bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
              />
            </div>
          )}

          {usdBlock && (
            <div className="rounded-card bg-bg-tertiary px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-text-secondary">USD pendiente</span>
                {usdBlock.cycle.has_partial_payment && <span className="text-[11px] text-warning">Pago parcial</span>}
              </div>
              <p className="mb-2 text-xl font-semibold tabular-nums text-text-primary">
                {formatAmount(usdBlock.cycle.remaining_amount, 'USD')}
              </p>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={usdValue}
                onChange={(event) => {
                  setUsdValue(event.target.value)
                  setSubmitError(null)
                }}
                className="w-full rounded-button border border-border-subtle bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
              />

              <div className="mt-3 grid grid-cols-2 gap-2">
                {(['ARS', 'USD'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setUsdPayMode(mode)}
                    className={`rounded-button border py-2 text-xs font-semibold ${
                      usdPayMode === mode
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border-subtle text-text-secondary'
                    }`}
                  >
                    Pagar USD con {mode}
                  </button>
                ))}
              </div>

              {usdPayMode === 'ARS' && (
                <label className="mt-3 block">
                  <span className="mb-1 block text-xs text-text-tertiary">Tipo de cambio</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    value={exchangeRateValue}
                    onChange={(event) => {
                      setExchangeRateValue(event.target.value)
                      setSubmitError(null)
                    }}
                    className="w-full rounded-button border border-border-subtle bg-bg-secondary px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
                  />
                </label>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {isSplitMode ? (
            <>
              {renderAccountSelect('Cuenta ARS', accountId, setAccountId, 'ARS', arsAvailableBalance, arsExceedsBalance)}
              {renderAccountSelect('Cuenta USD', usdAccountId, setUsdAccountId, 'USD', usdAvailableBalance, usdExceedsBalance)}
            </>
          ) : (
            renderAccountSelect(
              fromCurrency === 'USD' ? 'Cuenta USD' : 'Cuenta',
              accountId,
              setAccountId,
              fromCurrency,
              availableBalance,
              exceedsBalance,
            )
          )}
        </div>

        <div className="mt-4 rounded-card bg-bg-tertiary px-4 py-3">
          <p className="text-xs text-text-tertiary">Sale de la cuenta</p>
          {fromCurrency === 'ARS' ? (
            <p className="mt-1 text-lg font-semibold tabular-nums text-text-primary">
              {formatAmount(totalArsOut, 'ARS')}
            </p>
          ) : (
            <p className="mt-1 text-lg font-semibold tabular-nums text-text-primary">
              {formatAmount(totalUsdOut, 'USD')}
            </p>
          )}
        </div>

        <InlineError message={submitError} className="mt-3" />

        <div className="mt-4 space-y-2">
          <button
            onClick={() => void handleConfirm()}
            disabled={!canSubmit}
            className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-50"
          >
            {isSaving ? 'Registrando...' : 'Registrar pago'}
          </button>
          <button
            onClick={handleDismiss}
            disabled={isSaving}
            className="w-full py-2.5 text-sm text-text-tertiary"
          >
            Ahora no
          </button>
        </div>
      </div>
    </>
  )
}
