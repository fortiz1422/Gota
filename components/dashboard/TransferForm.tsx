'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { TaskSurface } from '@/components/ui/TaskSurface'
import { InlineError } from '@/components/ui/InlineError'
import { todayAR } from '@/lib/format'
import {
  buildTransferPayload,
  formatMonetaryInput,
  normalizeMonetaryInput,
} from '@/lib/mobile-income-transfer-surfaces'
import type { Account } from '@/types/database'

interface Props {
  accounts: Account[]
  onClose: () => void
  onSaved?: () => void
}
const labelClass = 'mb-2 block type-meta font-semibold text-text-secondary'
const fieldClass =
  'w-full border-0 border-b border-border-strong bg-transparent px-0 py-3 type-body text-text-primary outline-none focus:border-primary focus:ring-0 focus-visible:!outline-none focus-visible:ring-0'

type Currency = 'ARS' | 'USD'

export function TransferForm({ accounts, onClose, onSaved }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const amountFromRef = useRef<HTMLInputElement>(null)
  const activeAccounts = accounts.filter((a) => !a.archived)
  const [fromAccountId, setFromAccountId] = useState(
    activeAccounts[0]?.id ?? ''
  )
  const [toAccountId, setToAccountId] = useState(
    activeAccounts[1]?.id ?? activeAccounts[0]?.id ?? ''
  )
  const [currencyFrom, setCurrencyFrom] = useState<Currency>('ARS')
  const [currencyTo, setCurrencyTo] = useState<Currency>('ARS')
  const [amountFrom, setAmountFrom] = useState('')
  const [amountTo, setAmountTo] = useState('')
  const [exchangeRate, setExchangeRate] = useState('')
  const [date, setDate] = useState(todayAR)
  const [note, setNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sameCurrency = currencyFrom === currencyTo

  useEffect(() => {
    if (sameCurrency) return
    let cancelled = false
    fetch('/api/cotizaciones')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.venta) return
        const rate = data.venta
        setExchangeRate(String(rate))
        if (amountFrom && Number(amountFrom) > 0)
          setAmountTo(
            (currencyFrom === 'ARS'
              ? Number(amountFrom) / rate
              : Number(amountFrom) * rate
            ).toFixed(2)
          )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [sameCurrency, currencyFrom, currencyTo]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateAmountFrom = (display: string) => {
    const raw = normalizeMonetaryInput(display)
    setAmountFrom(raw)
    if (sameCurrency) setAmountTo(raw)
    else if (exchangeRate && Number(raw) > 0 && Number(exchangeRate) > 0)
      setAmountTo(
        (currencyFrom === 'ARS'
          ? Number(raw) / Number(exchangeRate)
          : Number(raw) * Number(exchangeRate)
        ).toFixed(2)
      )
  }
  const updateAmountTo = (display: string) => {
    const raw = normalizeMonetaryInput(display)
    setAmountTo(raw)
    if (!sameCurrency && amountFrom && raw) {
      const rate = Number(amountFrom) / Number(raw)
      if (rate > 0) setExchangeRate(rate.toFixed(2))
    }
  }
  const updateRate = (display: string) => {
    const raw = normalizeMonetaryInput(display)
    setExchangeRate(raw)
    if (!sameCurrency && amountFrom && Number(raw) > 0)
      setAmountTo((Number(amountFrom) / Number(raw)).toFixed(2))
  }
  const changeCurrency = (side: 'from' | 'to', value: Currency) => {
    if (side === 'from') setCurrencyFrom(value)
    else setCurrencyTo(value)
    const other = side === 'from' ? currencyTo : currencyFrom
    setAmountTo(value === other ? amountFrom : '')
    setExchangeRate('')
  }

  async function handleSave() {
    if (!fromAccountId || !toAccountId)
      return setError('Seleccioná las cuentas')
    if (fromAccountId === toAccountId && sameCurrency)
      return setError('Origen y destino no pueden ser la misma cuenta')
    if (!amountFrom || Number(amountFrom) <= 0)
      return setError('Ingresá el monto')
    if (!amountTo || Number(amountTo) <= 0)
      return setError('Ingresá el monto de destino')
    if (!date) return setError('Ingresá la fecha')
    setError(null)
    setIsSaving(true)
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          buildTransferPayload({
            fromAccountId,
            toAccountId,
            amountFrom,
            amountTo,
            currencyFrom,
            currencyTo,
            exchangeRate,
            date,
            note,
          })
        ),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al guardar')
      }
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['account-breakdown'] })
      router.refresh()
      onSaved?.()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setIsSaving(false)
    }
  }

  const currencyToggle = (
    value: Currency,
    onChange: (value: Currency) => void
  ) => (
    <fieldset className="flex gap-1">
      <legend className="sr-only">Moneda</legend>
      {(['ARS', 'USD'] as const).map((currency) => (
        <button
          key={currency}
          type="button"
          aria-pressed={value === currency}
          onClick={() => onChange(currency)}
          className={`rounded-button type-meta px-2 py-1 ${value === currency ? 'bg-primary text-white' : 'text-text-tertiary'}`}
        >
          {currency}
        </button>
      ))}
    </fieldset>
  )

  return (
    <TaskSurface
      open
      onClose={onClose}
      appearance="compact"
      eyebrow="TRANSFERENCIAS"
      title="Transferencia"
      description="Movimiento entre tus cuentas"
      initialFocusRef={amountFromRef}
      footer={
        <>
          <InlineError message={error} className="mb-3" />
          <button
            type="button"
            onClick={() => {
              void handleSave()
            }}
            disabled={isSaving}
            className="rounded-button bg-primary type-body-lg min-h-12 w-full px-4 text-white disabled:opacity-45"
          >
            {isSaving ? 'Guardando…' : 'Registrar transferencia'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="type-body text-text-tertiary mt-1 min-h-11 w-full disabled:opacity-50"
          >
            Cancelar
          </button>
        </>
      }
    >
      <div className="space-y-7 pb-2">
        <section>
          <label htmlFor="transfer-from-account" className={labelClass}>
            Desde
          </label>
          <div className="border-border-strong flex items-center gap-3 border-b">
            <select
              id="transfer-from-account"
              value={fromAccountId}
              onChange={(e) => setFromAccountId(e.target.value)}
              className="type-body text-text-primary min-w-0 flex-1 border-0 bg-transparent py-3 outline-none focus:ring-0 focus-visible:!outline-none focus-visible:ring-0"
            >
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {currencyToggle(currencyFrom, (value) =>
              changeCurrency('from', value)
            )}
          </div>
          <input
            ref={amountFromRef}
            id="transfer-from-amount"
            type="text"
            inputMode="decimal"
            placeholder={currencyFrom === 'ARS' ? '$ 0' : 'USD 0'}
            value={formatMonetaryInput(amountFrom)}
            onChange={(e) => updateAmountFrom(e.target.value)}
            aria-label="Monto de origen"
            className={`${fieldClass} mt-2`}
          />
        </section>
        <section>
          <label htmlFor="transfer-to-account" className={labelClass}>
            Hasta
          </label>
          <div className="border-border-strong flex items-center gap-3 border-b">
            <select
              id="transfer-to-account"
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              className="type-body text-text-primary min-w-0 flex-1 border-0 bg-transparent py-3 outline-none focus:ring-0 focus-visible:!outline-none focus-visible:ring-0"
            >
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {currencyToggle(currencyTo, (value) => changeCurrency('to', value))}
          </div>
          <input
            id="transfer-to-amount"
            type="text"
            inputMode="decimal"
            placeholder={currencyTo === 'ARS' ? '$ 0' : 'USD 0'}
            value={formatMonetaryInput(amountTo)}
            onChange={(e) => updateAmountTo(e.target.value)}
            disabled={sameCurrency}
            aria-label="Monto de destino"
            className={`${fieldClass} mt-2 ${sameCurrency ? 'cursor-not-allowed opacity-50' : ''}`}
          />
        </section>
        {!sameCurrency && (
          <section>
            <label htmlFor="transfer-rate" className={labelClass}>
              Tipo de cambio · 1 USD = $ ____
            </label>
            <input
              id="transfer-rate"
              type="text"
              inputMode="decimal"
              placeholder="Ej: 1.050"
              value={formatMonetaryInput(exchangeRate)}
              onChange={(e) => updateRate(e.target.value)}
              className={fieldClass}
            />
            <p className="type-meta text-text-tertiary mt-2">
              TC oficial BNA · podés modificarlo
            </p>
          </section>
        )}
        <div>
          <label htmlFor="transfer-date" className={labelClass}>
            Fecha
          </label>
          <input
            id="transfer-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="transfer-note" className={labelClass}>
            Nota{' '}
            <span className="text-text-muted font-normal normal-case">
              (opcional)
            </span>
          </label>
          <input
            id="transfer-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={100}
            placeholder="Para qué fue…"
            className={fieldClass}
          />
        </div>
      </div>
    </TaskSurface>
  )
}
