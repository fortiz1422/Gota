'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Coins } from '@phosphor-icons/react'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'

function getMonthLabel(month: string): string {
  const label = new Date(month + '-15').toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

interface Props {
  month: string
}

export function IncomeSection({ month }: Props) {
  const router = useRouter()
  const [amountArs, setAmountArs] = useState('')
  const [amountUsd, setAmountUsd] = useState('')
  const [saldoInicialArs, setSaldoInicialArs] = useState('')
  const [saldoInicialUsd, setSaldoInicialUsd] = useState('')
  const [isClosed, setIsClosed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setIsLoading(true)
    fetch(`/api/monthly-income?month=${month}`)
      .then((r) => r.json())
      .then((data) => {
        setAmountArs(data.amount_ars > 0 ? String(data.amount_ars) : '')
        setAmountUsd(data.amount_usd > 0 ? String(data.amount_usd) : '')
        setSaldoInicialArs(data.saldo_inicial_ars > 0 ? String(data.saldo_inicial_ars) : '')
        setSaldoInicialUsd(data.saldo_inicial_usd > 0 ? String(data.saldo_inicial_usd) : '')
        setIsClosed(data.closed ?? false)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [month])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/monthly-income', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          amount_ars: Number(amountArs) || 0,
          amount_usd: Number(amountUsd) || 0,
          saldo_inicial_ars: Number(saldoInicialArs) || 0,
          saldo_inicial_usd: Number(saldoInicialUsd) || 0,
        }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      alert('Error al guardar ingreso.')
    } finally {
      setIsSaving(false)
    }
  }

  const monthLabel = getMonthLabel(month)
  const summary = isClosed
    ? `${monthLabel} · cerrado`
    : amountArs
      ? `${monthLabel} · $ ${Number(amountArs).toLocaleString('es-AR')}`
      : monthLabel

  const inputClass = (disabled: boolean) =>
    `w-full rounded-input border border-transparent bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-primary focus:outline-none ${
      disabled ? 'opacity-50 cursor-not-allowed' : ''
    }`

  return (
    <CollapsibleSection icon={<Coins weight="duotone" size={18} className="text-text-primary icon-duotone" />} title="Ingresos" summary={summary}>
      {isLoading ? (
        <div className="flex justify-center py-4">
          <span className="spinner" />
        </div>
      ) : (
        <div className="space-y-3">
          {isClosed && (
            <div className="flex items-center gap-2 rounded-input bg-bg-elevated px-3 py-2">
              <Lock size={12} weight="duotone" className="text-text-disabled shrink-0" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-text-disabled">
                Cerrado
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] text-text-tertiary">Ingreso ARS</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={amountArs}
                onChange={(e) => setAmountArs(e.target.value)}
                disabled={isClosed}
                className={inputClass(isClosed)}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-text-tertiary">Ingreso USD</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={amountUsd}
                onChange={(e) => setAmountUsd(e.target.value)}
                disabled={isClosed}
                className={inputClass(isClosed)}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] text-text-tertiary">Saldo inicial ARS</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={saldoInicialArs}
                onChange={(e) => setSaldoInicialArs(e.target.value)}
                disabled={isClosed}
                className={inputClass(isClosed)}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-text-tertiary">Saldo inicial USD</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={saldoInicialUsd}
                onChange={(e) => setSaldoInicialUsd(e.target.value)}
                disabled={isClosed}
                className={inputClass(isClosed)}
              />
            </label>
          </div>

          {!isClosed && (
            <>
              <p className="text-xs text-text-tertiary">
                Ingreso y saldo de partida para calcular tu disponible.
              </p>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-bg-primary transition-all duration-150 hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                {isSaving ? 'Guardando...' : 'Guardar ingreso'}
              </button>
            </>
          )}
        </div>
      )}
    </CollapsibleSection>
  )
}
