'use client'

import { useRef, useState } from 'react'
import { TaskSurface } from '@/components/ui/TaskSurface'
import { ConfirmationSurface } from '@/components/ui/ConfirmationSurface'
import { InlineError } from '@/components/ui/InlineError'
import {
  buildTransferPayload,
  formatMonetaryInput,
  normalizeMonetaryInput,
} from '@/lib/mobile-income-transfer-surfaces'
import type { Account, Transfer } from '@/types/database'

interface Props {
  transfer: Transfer
  accounts: Account[]
  onClose: () => void
  onUpdate: () => void
}
const labelClass = 'mb-2 block type-meta font-semibold text-text-secondary'
const fieldClass =
  'w-full border-0 border-b border-border-strong bg-transparent px-0 py-3 type-body text-text-primary outline-none focus:border-primary focus:ring-0 focus-visible:!outline-none focus-visible:ring-0'
type Currency = 'ARS' | 'USD'

export function TransferEditSheet({
  transfer,
  accounts,
  onClose,
  onUpdate,
}: Props) {
  const amountFromRef = useRef<HTMLInputElement>(null)
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)
  const [fromAccountId, setFromAccountId] = useState(transfer.from_account_id)
  const [toAccountId, setToAccountId] = useState(transfer.to_account_id)
  const [currencyFrom, setCurrencyFrom] = useState<Currency>(
    transfer.currency_from
  )
  const [currencyTo, setCurrencyTo] = useState<Currency>(transfer.currency_to)
  const [amountFrom, setAmountFrom] = useState(String(transfer.amount_from))
  const [amountTo, setAmountTo] = useState(String(transfer.amount_to))
  const [exchangeRate, setExchangeRate] = useState(
    transfer.exchange_rate ? String(transfer.exchange_rate) : ''
  )
  const [date, setDate] = useState(transfer.date.substring(0, 10))
  const [note, setNote] = useState(transfer.note ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sameCurrency = currencyFrom === currencyTo

  const updateFrom = (display: string) => {
    const raw = normalizeMonetaryInput(display, amountFrom)
    setAmountFrom(raw)
    if (sameCurrency) setAmountTo(raw)
  }
  const updateTo = (display: string) => {
    const raw = normalizeMonetaryInput(display, amountTo)
    setAmountTo(raw)
    if (!sameCurrency && amountFrom && raw) {
      const rate = Number(amountFrom) / Number(raw)
      if (rate > 0) setExchangeRate(rate.toFixed(2))
    }
  }
  const updateRate = (display: string) => {
    const raw = normalizeMonetaryInput(display, exchangeRate)
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
      const res = await fetch(`/api/transfers/${transfer.id}`, {
        method: 'PATCH',
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
      onUpdate()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al guardar. Intentá de nuevo.'
      )
    } finally {
      setIsSaving(false)
    }
  }
  async function handleDelete() {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/transfers/${transfer.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Error al eliminar.')
      onUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar.')
      setIsSaving(false)
      setConfirmDelete(false)
    }
  }
  const currencyToggle = (
    value: Currency,
    onChange: (value: Currency) => void
  ) => (
    <fieldset className="flex rounded-input bg-bg-tertiary p-1">
      <legend className="sr-only">Moneda</legend>
      {(['ARS', 'USD'] as const).map((currency) => (
        <button
          key={currency}
          type="button"
          aria-pressed={value === currency}
          onClick={() => onChange(currency)}
          className={`rounded-button px-3 py-1.5 text-sm font-medium transition-colors ${value === currency ? 'bg-primary text-bg-primary' : 'text-text-secondary'}`}
        >
          {currency}
        </button>
      ))}
    </fieldset>
  )

  return (
    <>
      <TaskSurface
        open
        onClose={onClose}
        appearance="compact"
        eyebrow="TRANSFERENCIAS"
        title="Editar transferencia"
        description="Ajustá el movimiento entre tus cuentas."
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
              {isSaving ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button
              ref={deleteTriggerRef}
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={isSaving}
              className="type-body text-danger mt-1 min-h-11 w-full disabled:opacity-50"
            >
              Eliminar transferencia
            </button>
          </>
        }
      >
        <div className="space-y-7 pb-2">
          <section>
            <label htmlFor="transfer-edit-from-account" className={labelClass}>
              Desde
            </label>
            <div className="border-border-strong flex items-center gap-3 border-b">
              <select
                id="transfer-edit-from-account"
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                className="type-body text-text-primary min-w-0 flex-1 border-0 bg-transparent py-3 outline-none focus:ring-0 focus-visible:!outline-none focus-visible:ring-0"
              >
                {accounts.map((a) => (
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
              id="transfer-edit-from-amount"
              type="text"
              inputMode="decimal"
              value={formatMonetaryInput(amountFrom)}
              onChange={(e) => updateFrom(e.target.value)}
              aria-label="Monto de origen"
              className={`${fieldClass} mt-2`}
            />
          </section>
          <section>
            <label htmlFor="transfer-edit-to-account" className={labelClass}>
              Hasta
            </label>
            <div className="border-border-strong flex items-center gap-3 border-b">
              <select
                id="transfer-edit-to-account"
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="type-body text-text-primary min-w-0 flex-1 border-0 bg-transparent py-3 outline-none focus:ring-0 focus-visible:!outline-none focus-visible:ring-0"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {currencyToggle(currencyTo, (value) =>
                changeCurrency('to', value)
              )}
            </div>
            <input
              id="transfer-edit-to-amount"
              type="text"
              inputMode="decimal"
              value={formatMonetaryInput(amountTo)}
              onChange={(e) => updateTo(e.target.value)}
              disabled={sameCurrency}
              aria-label="Monto de destino"
              className={`${fieldClass} mt-2 ${sameCurrency ? 'cursor-not-allowed opacity-50' : ''}`}
            />
          </section>
          {!sameCurrency && (
            <section>
              <label htmlFor="transfer-edit-rate" className={labelClass}>
                Tipo de cambio · 1 USD = $ ____
              </label>
              <input
                id="transfer-edit-rate"
                type="text"
                inputMode="decimal"
                value={formatMonetaryInput(exchangeRate)}
                onChange={(e) => updateRate(e.target.value)}
                className={fieldClass}
              />
              <p className="type-meta text-text-tertiary mt-2">
                Se calcula automático si ingresás ambos montos
              </p>
            </section>
          )}
          <div>
            <label htmlFor="transfer-edit-date" className={labelClass}>
              Fecha
            </label>
            <input
              id="transfer-edit-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="transfer-edit-note" className={labelClass}>
              Nota{' '}
              <span className="text-text-muted font-normal normal-case">
                (opcional)
              </span>
            </label>
            <input
              id="transfer-edit-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={100}
              className={fieldClass}
            />
          </div>
        </div>
      </TaskSurface>
      <ConfirmationSurface
        open={confirmDelete}
        onClose={() => {
          if (!isSaving) setConfirmDelete(false)
        }}
        onConfirm={() => {
          void handleDelete()
        }}
        triggerElement={deleteTriggerRef.current}
        appearance="compact"
        destructive
        title="Eliminar transferencia"
        description="Esta acción elimina la transferencia y no se puede deshacer."
        confirmLabel="Eliminar transferencia"
        busy={isSaving}
      >
        <p>Se eliminarán las dos partes del movimiento.</p>
      </ConfirmationSurface>
    </>
  )
}
