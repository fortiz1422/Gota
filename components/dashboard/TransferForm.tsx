'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Bank, Wallet, DeviceMobileSpeaker } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import { todayAR } from '@/lib/format'
import type { Account } from '@/types/database'

interface Props {
  accounts: Account[]
  onClose: () => void
}

function AccountIcon({ type, size = 14 }: { type: Account['type']; size?: number }) {
  if (type === 'cash') return <Wallet weight="duotone" size={size} />
  if (type === 'digital') return <DeviceMobileSpeaker weight="duotone" size={size} />
  return <Bank weight="duotone" size={size} />
}

export function TransferForm({ accounts, onClose }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const activeAccounts = accounts.filter((a) => !a.archived)

  const [fromAccountId, setFromAccountId] = useState(activeAccounts[0]?.id ?? '')
  const [toAccountId, setToAccountId] = useState(activeAccounts[1]?.id ?? activeAccounts[0]?.id ?? '')
  const [currencyFrom, setCurrencyFrom] = useState<'ARS' | 'USD'>('ARS')
  const [currencyTo, setCurrencyTo] = useState<'ARS' | 'USD'>('ARS')
  const [amountFrom, setAmountFrom] = useState('')
  const [amountTo, setAmountTo] = useState('')
  const [exchangeRate, setExchangeRate] = useState('')
  const [date, setDate] = useState(todayAR())
  const [note, setNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sameCurrency = currencyFrom === currencyTo

  // Sincronizar amount_to con amount_from si misma moneda
  const handleAmountFromChange = (v: string) => {
    setAmountFrom(v)
    if (sameCurrency) setAmountTo(v)
  }

  // Calcular TC automático si se ingresan ambos montos
  const handleAmountToChange = (v: string) => {
    setAmountTo(v)
    if (!sameCurrency && amountFrom && v) {
      const tc = Number(amountFrom) / Number(v)
      if (!isNaN(tc) && tc > 0) setExchangeRate(tc.toFixed(2))
    }
  }

  const handleExchangeRateChange = (v: string) => {
    setExchangeRate(v)
    if (!sameCurrency && amountFrom && v) {
      const to = Number(amountFrom) / Number(v)
      if (!isNaN(to) && to > 0) setAmountTo(to.toFixed(2))
    }
  }

  const handleCurrencyFromChange = (c: 'ARS' | 'USD') => {
    setCurrencyFrom(c)
    if (c === currencyTo) setAmountTo(amountFrom)
    else setAmountTo('')
    setExchangeRate('')
  }

  const handleCurrencyToChange = (c: 'ARS' | 'USD') => {
    setCurrencyTo(c)
    if (c === currencyFrom) setAmountTo(amountFrom)
    else setAmountTo('')
    setExchangeRate('')
  }

  const handleSave = async () => {
    if (!fromAccountId || !toAccountId) return setError('Seleccioná las cuentas')
    if (fromAccountId === toAccountId) return setError('Origen y destino no pueden ser la misma cuenta')
    if (!amountFrom || Number(amountFrom) <= 0) return setError('Ingresá el monto')
    if (!amountTo || Number(amountTo) <= 0) return setError('Ingresá el monto de destino')
    if (!date) return setError('Ingresá la fecha')

    setIsSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_account_id: fromAccountId,
          to_account_id: toAccountId,
          amount_from: Number(amountFrom),
          amount_to: Number(amountTo),
          currency_from: currencyFrom,
          currency_to: currencyTo,
          exchange_rate: !sameCurrency && exchangeRate ? Number(exchangeRate) : null,
          date,
          note: note.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al guardar')
      }
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      router.refresh()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setIsSaving(false)
    }
  }

  const labelCls = 'mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-text-secondary'
  const inputCls =
    'w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none'
  const selectCls = inputCls

  const currencyToggle = (value: 'ARS' | 'USD', onChange: (v: 'ARS' | 'USD') => void) => (
    <div className="flex rounded-input bg-bg-tertiary p-0.5">
      {(['ARS', 'USD'] as const).map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`flex-1 rounded-button px-2 py-1.5 text-xs font-semibold transition-colors ${
            value === c ? 'bg-primary text-white' : 'text-text-secondary'
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  )

  return (
    <Modal open onClose={onClose}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />
      <h2 className="text-lg font-semibold text-text-primary">Transferencia</h2>
      <p className="mb-5 mt-1 text-xs text-text-tertiary">Movimiento entre tus cuentas</p>

      <div className="space-y-4">
        {/* Desde */}
        <div>
          <label className={labelCls}>Desde</label>
          <div className="flex gap-2">
            <select
              value={fromAccountId}
              onChange={(e) => setFromAccountId(e.target.value)}
              className={`${selectCls} flex-1`}
            >
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {currencyToggle(currencyFrom, handleCurrencyFromChange)}
          </div>
          <input
            type="number"
            inputMode="decimal"
            placeholder={currencyFrom === 'ARS' ? '$ 0' : 'USD 0'}
            value={amountFrom}
            onChange={(e) => handleAmountFromChange(e.target.value)}
            className={`${inputCls} mt-2`}
          />
        </div>

        {/* Hasta */}
        <div>
          <label className={labelCls}>Hasta</label>
          <div className="flex gap-2">
            <select
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              className={`${selectCls} flex-1`}
            >
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {currencyToggle(currencyTo, handleCurrencyToChange)}
          </div>
          <input
            type="number"
            inputMode="decimal"
            placeholder={currencyTo === 'ARS' ? '$ 0' : 'USD 0'}
            value={amountTo}
            onChange={(e) => handleAmountToChange(e.target.value)}
            disabled={sameCurrency}
            className={`${inputCls} mt-2 ${sameCurrency ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
        </div>

        {/* Tipo de cambio (solo si monedas distintas) */}
        {!sameCurrency && (
          <div>
            <label className={labelCls}>Tipo de cambio · 1 USD = $ ____</label>
            <input
              type="number"
              inputMode="decimal"
              placeholder="Ej: 1050"
              value={exchangeRate}
              onChange={(e) => handleExchangeRateChange(e.target.value)}
              className={inputCls}
            />
            <p className="mt-1 text-[11px] text-text-tertiary">
              Se calcula automático si ingresás ambos montos
            </p>
          </div>
        )}

        {/* Fecha */}
        <div>
          <label className={labelCls}>Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
        </div>

        {/* Nota opcional */}
        <div>
          <label className={labelCls}>Nota (opcional)</label>
          <input
            type="text"
            placeholder="Para qué fue..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputCls}
          />
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-bg-primary transition-transform active:scale-95 hover:scale-[1.02] disabled:opacity-50"
        >
          {isSaving ? 'Guardando...' : 'Registrar transferencia'}
        </button>
        <button
          onClick={onClose}
          className="w-full rounded-button py-3 text-sm text-text-secondary"
        >
          Cancelar
        </button>
      </div>
    </Modal>
  )
}
