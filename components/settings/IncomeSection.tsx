'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getMonthLabel(month: string): string {
  const label = new Date(month + '-15').toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function IncomeSection({ defaultMonth }: { defaultMonth: string }) {
  const router = useRouter()
  const currentMonth = getCurrentMonth()
  const [month, setMonth] = useState(defaultMonth)
  const [amountArs, setAmountArs] = useState('')
  const [amountUsd, setAmountUsd] = useState('')
  const [saldoInicialArs, setSaldoInicialArs] = useState('')
  const [saldoInicialUsd, setSaldoInicialUsd] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const minMonth = addMonths(currentMonth, -12)

  useEffect(() => {
    setIsLoading(true)
    fetch(`/api/monthly-income?month=${month}`)
      .then((r) => r.json())
      .then((data) => {
        setAmountArs(data.amount_ars > 0 ? String(data.amount_ars) : '')
        setAmountUsd(data.amount_usd > 0 ? String(data.amount_usd) : '')
        setSaldoInicialArs(data.saldo_inicial_ars > 0 ? String(data.saldo_inicial_ars) : '')
        setSaldoInicialUsd(data.saldo_inicial_usd > 0 ? String(data.saldo_inicial_usd) : '')
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

  return (
    <div>
      <p className="mb-2 type-label text-text-label">
        Ingresos mensuales
      </p>

      <div className="mb-3 flex items-center justify-between rounded-card bg-bg-tertiary border border-border-ocean px-3 py-2">
        <button
          onClick={() => setMonth((m) => addMonths(m, -1))}
          disabled={month <= minMonth}
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-primary/5 disabled:opacity-30"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm text-text-primary">{getMonthLabel(month)}</span>
        <button
          onClick={() => setMonth((m) => addMonths(m, 1))}
          disabled={month >= currentMonth}
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-primary/5 disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <span className="spinner" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] text-text-tertiary">Ingreso ARS</span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={amountArs}
                onChange={(e) => setAmountArs(e.target.value)}
                className="w-full rounded-input border border-transparent bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-primary focus:outline-none"
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
                className="w-full rounded-input border border-transparent bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-primary focus:outline-none"
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
                className="w-full rounded-input border border-transparent bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-primary focus:outline-none"
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
                className="w-full rounded-input border border-transparent bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-primary focus:outline-none"
              />
            </label>
          </div>
          <p className="text-xs text-text-tertiary">Saldo inicial: el dinero que ya tenías antes de este mes</p>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-bg-primary transition-all duration-150 hover:brightness-110 active:scale-95 disabled:opacity-50"
          >
            {isSaving ? 'Guardando...' : 'Guardar ingreso'}
          </button>
        </div>
      )}
    </div>
  )
}
