'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { TrendUp } from '@phosphor-icons/react'
import { formatAmount, formatDate } from '@/lib/format'
import { Modal } from '@/components/ui/Modal'
import type { Account, YieldAccumulator } from '@/types/database'

interface Props {
  ya: YieldAccumulator
  accounts: Account[]
  isCurrentMonth: boolean
}

export function YieldItem({ ya, accounts, isCurrentMonth }: Props) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [overrideAmount, setOverrideAmount] = useState(String(ya.accumulated))
  const [isSaving, setIsSaving] = useState(false)

  const accountName = accounts.find((a) => a.id === ya.account_id)?.name ?? 'Cuenta'
  const isClosed = !!ya.confirmed_at

  const handleSave = async () => {
    if (overrideAmount === '') return
    setIsSaving(true)
    try {
      await fetch(`/api/yield-accumulator/${ya.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accumulated: Number(overrideAmount), is_manual_override: true }),
      })
      setSheetOpen(false)
      router.refresh()
    } catch {
      alert('Error al guardar rendimiento.')
    } finally {
      setIsSaving(false)
    }
  }

  const inputClass =
    'w-full rounded-input border border-transparent bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-disabled focus:border-primary focus:outline-none'

  return (
    <>
      <div
        className={`flex items-center gap-3 rounded-card border border-border-subtle bg-bg-secondary px-3 py-3 ${isCurrentMonth && !isClosed ? 'cursor-pointer active:opacity-70' : ''}`}
        onClick={() => isCurrentMonth && !isClosed && setSheetOpen(true)}
      >
        <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-success/20 bg-success/10">
          <TrendUp weight="duotone" size={18} className="text-success" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-[13px] font-medium text-text-primary">{accountName}</p>
          <p className="text-[11px] text-text-label">
            Rendimiento · {isClosed ? formatDate(ya.confirmed_at!) : 'en curso'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[14px] font-bold tabular-nums tracking-[-0.01em] text-success">
            +{formatAmount(ya.accumulated, 'ARS')}
          </p>
          {!isClosed && (
            <p className="text-[10px] text-text-disabled leading-none">est.</p>
          )}
        </div>
      </div>

      {sheetOpen && (
        <Modal open onClose={() => setSheetOpen(false)}>
          <div className="space-y-4">
            <div>
              <p className="mb-0.5 text-xs text-text-tertiary">Rendimiento estimado</p>
              <h2 className="text-lg font-bold text-text-primary">{accountName}</h2>
            </div>
            <p className="text-[13px] text-text-secondary">
              Si conocés el número real desde la app del banco, ingresalo acá. Gota dejará de estimar este mes.
            </p>
            <label className="block space-y-1">
              <span className="text-[10px] text-text-disabled">Acumulado del mes (ARS)</span>
              <input
                type="number"
                inputMode="decimal"
                value={overrideAmount}
                onChange={(e) => setOverrideAmount(e.target.value)}
                className={inputClass}
                autoFocus
              />
            </label>
            <button
              onClick={handleSave}
              disabled={isSaving || overrideAmount === ''}
              className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-bg-primary transition-all duration-150 hover:brightness-110 active:scale-95 disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : 'Guardar monto real'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
