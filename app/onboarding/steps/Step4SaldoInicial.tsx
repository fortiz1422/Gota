'use client'

import { useState } from 'react'
import { ProgressDots } from '../components/ProgressDots'
import { BackButton } from '../components/BackButton'
import { InlineError } from '@/components/ui/InlineError'

interface Props {
  accountId: string
  accountName: string
  onBack: () => void
  onNext: (balanceARS: number | null, balanceUSD: number | null) => void
}

export function Step4SaldoInicial({ accountId, accountName, onBack, onNext }: Props) {
  const [arsAmount, setArsAmount] = useState('')
  const [usdAmount, setUsdAmount] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const arsNum = parseFloat(arsAmount) || 0
  const usdNum = parseFloat(usdAmount) || 0
  const hasAny = arsNum > 0 || usdNum > 0

  const handleContinue = async () => {
    if (isSaving) return
    if (!hasAny) {
      onNext(null, null)
      return
    }
    setIsSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opening_balance_ars: arsNum,
          opening_balance_usd: usdNum,
        }),
      })
      if (!res.ok) throw new Error()
      onNext(arsNum || null, usdNum || null)
    } catch {
      setSaveError('Error al guardar. Intenta de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary px-5 pb-10 pt-safe">
      <div className="flex items-center gap-3 py-4">
        <BackButton onClick={onBack} />
        <div className="flex-1">
          <ProgressDots total={4} current={2} />
        </div>
        <div className="w-6" />
      </div>

      <div className="mt-6 flex-1">
        <h2 className="text-2xl font-semibold text-text-primary">
          ¿Cuánto hay en{' '}
          <span className="text-primary">{accountName}</span> ahora?
        </h2>
        <p className="mt-2 text-sm text-text-tertiary">
          Si no lo tenés a mano, podés poner cero.
        </p>

        {/* ARS input */}
        <div className="mt-6">
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
            Saldo en ARS
          </label>
          <div className="flex items-center rounded-full border border-border-ocean/30 bg-bg-secondary px-4 py-3 focus-within:border-primary/40 transition-colors">
            <span className="mr-2 text-sm text-text-tertiary">$</span>
            <input
              type="number"
              inputMode="numeric"
              value={arsAmount}
              onChange={(e) => {
                setArsAmount(e.target.value)
                setSaveError(null)
              }}
              placeholder="0"
              autoFocus
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-dim outline-none"
            />
          </div>
        </div>

        {/* USD input */}
        <div className="mt-4">
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
            Saldo en USD
          </label>
          <div className="flex items-center rounded-full border border-border-ocean/30 bg-bg-secondary px-4 py-3 focus-within:border-primary/40 transition-colors">
            <span className="mr-2 text-sm text-text-tertiary">U$D</span>
            <input
              type="number"
              inputMode="numeric"
              value={usdAmount}
              onChange={(e) => {
                setUsdAmount(e.target.value)
                setSaveError(null)
              }}
              placeholder="0"
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-dim outline-none"
            />
          </div>
        </div>
      </div>

      <InlineError message={saveError} className="mb-3" />

      <button
        onClick={handleContinue}
        disabled={isSaving}
        className="w-full rounded-full bg-primary py-4 text-sm font-semibold text-bg-primary transition-all active:scale-95 disabled:opacity-40"
      >
        {isSaving ? 'Guardando...' : 'Continuar'}
      </button>
    </div>
  )
}
