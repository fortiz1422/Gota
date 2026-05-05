'use client'

import { useState } from 'react'
import { CaretLeft } from '@phosphor-icons/react'

interface Props {
  accountId: string
  accountName: string
  preferredCurrency: 'ARS' | 'USD'
  heroBalanceMode: 'combined_ars' | 'combined_usd' | 'default_currency'
  onBack: () => void
  onNext: (balanceARS: number | null, balanceUSD: number | null) => void
}

export function OnboardStep4Saldo({
  accountId,
  accountName,
  preferredCurrency,
  heroBalanceMode,
  onBack,
  onNext,
}: Props) {
  const [arsAmount, setArsAmount] = useState('')
  const [usdAmount, setUsdAmount] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isBoth = heroBalanceMode === 'combined_ars' || heroBalanceMode === 'combined_usd'
  const showARS = preferredCurrency === 'ARS' || isBoth
  const showUSD = preferredCurrency === 'USD' || isBoth

  const arsNum = parseFloat(arsAmount) || 0
  const usdNum = parseFloat(usdAmount) || 0
  const hasAny = arsNum > 0 || usdNum > 0

  const save = async () => {
    if (isSaving) return
    if (!hasAny) {
      onNext(null, null)
      return
    }
    setIsSaving(true)
    setError(null)
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
      setError('Error al guardar. Intenta de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  const skip = () => onNext(null, null)

  return (
    <div
      className="flex min-h-screen flex-col bg-bg-primary"
      style={{ animation: 'onboardIn 0.22s cubic-bezier(.4,0,.2,1)' }}
    >
      {/* Nav */}
      <OnboardNav onBack={onBack} dotIndex={2} />

      {/* Saldo stage — vertically centered */}
      <div className="flex flex-1 flex-col justify-center px-6">
        {/* Account pill */}
        <div className="mb-7 self-start rounded-full bg-primary/8 px-4 py-2">
          <span className="text-[13px] font-bold text-primary">{accountName}</span>
        </div>

        {/* ARS block */}
        {showARS && (
          <div className={showUSD ? 'mb-7' : ''}>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.09em] text-text-tertiary">
              Saldo en pesos
            </p>
            <div
              className="mb-2 flex items-baseline gap-2 border-b-2 border-text-disabled pb-[14px] transition-colors focus-within:border-primary"
            >
              <span
                className="shrink-0 font-extrabold text-text-tertiary"
                style={{ fontSize: 32, letterSpacing: '-0.02em' }}
              >
                $
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={arsAmount}
                onChange={(e) => { setArsAmount(e.target.value); setError(null) }}
                placeholder="0"
                autoFocus={showARS}
                className="min-w-0 flex-1 border-none bg-transparent font-extrabold text-text-primary outline-none placeholder:text-text-disabled"
                style={{ fontSize: 40, letterSpacing: '-0.03em' }}
              />
            </div>
            <p className="text-[12px] text-text-tertiary">Lo que hay en la cuenta ahora</p>
          </div>
        )}

        {/* USD block */}
        {showUSD && (
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.09em] text-text-tertiary">
              Saldo en dólares
            </p>
            <div
              className="mb-2 flex items-baseline gap-2 border-b-2 border-text-disabled pb-[14px] transition-colors focus-within:border-primary"
            >
              <span
                className="shrink-0 font-extrabold text-text-tertiary"
                style={{ fontSize: 20, letterSpacing: '-0.02em', paddingBottom: 4 }}
              >
                U$D
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={usdAmount}
                onChange={(e) => { setUsdAmount(e.target.value); setError(null) }}
                placeholder="0"
                autoFocus={!showARS && showUSD}
                className="min-w-0 flex-1 border-none bg-transparent font-extrabold text-text-primary outline-none placeholder:text-text-disabled"
                style={{ fontSize: 40, letterSpacing: '-0.03em' }}
              />
            </div>
            <p className="text-[12px] text-text-tertiary">Lo que hay en la cuenta ahora</p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="mx-6 mb-2 text-[13px] text-danger">{error}</p>
      )}

      {/* CTA */}
      <div className="shrink-0 px-6 pb-9 pt-4">
        <button
          onClick={save}
          disabled={isSaving}
          className="w-full rounded-full py-[17px] text-[15px] font-bold tracking-[0.01em] text-white transition-all active:scale-[0.97] hover:opacity-90 disabled:opacity-25 disabled:cursor-not-allowed"
          style={{ background: 'var(--color-text-primary)' }}
        >
          {isSaving ? 'Guardando...' : 'Continuar'}
        </button>
        <button
          onClick={skip}
          className="mt-[6px] w-full py-3 text-[14px] font-medium text-text-tertiary transition-colors hover:text-text-secondary"
        >
          Hacerlo después
        </button>
      </div>
    </div>
  )
}

function OnboardNav({ onBack, dotIndex }: { onBack: () => void; dotIndex: number }) {
  return (
    <div className="relative flex h-12 shrink-0 items-center px-5">
      <button
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-secondary transition-colors hover:bg-primary/8"
      >
        <CaretLeft size={18} weight="bold" className="text-text-secondary" />
      </button>
      <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-[5px]">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-1 rounded-full transition-all duration-300"
            style={{
              width: i === dotIndex ? 20 : 4,
              background: i === dotIndex ? 'var(--color-primary)' : 'var(--color-text-disabled)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
