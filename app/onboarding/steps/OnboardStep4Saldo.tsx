'use client'

import { useState } from 'react'
import { StepHeader } from '../components/StepHeader'

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

  const mainIsUSD = heroBalanceMode === 'combined_usd' || (heroBalanceMode === 'default_currency' && preferredCurrency === 'USD')

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
      setError('Error al guardar. Tus datos quedan acá, intentá de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  const skip = () => onNext(null, null)

  // Preview del Saldo Vivo
  const previewMain = mainIsUSD
    ? `USD ${usdNum.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
    : `$ ${arsNum.toLocaleString('es-AR')}`

  const previewSecondary = isBoth
    ? mainIsUSD
      ? `ARS ${arsNum.toLocaleString('es-AR')}`
      : `USD ${usdNum.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
    : null

  return (
    <div
      className="min-h-app flex flex-col bg-bg-primary"
      style={{ animation: 'onboardIn 0.22s cubic-bezier(.4,0,.2,1)' }}
    >
      {/* Header azul con progreso */}
      <StepHeader step={3} onBack={onBack} />

      {/* Pregunta */}
      <div className="px-[26px] pb-[18px] pt-5">
        <p
          className="mb-2 font-extrabold leading-[1.1] text-text-primary"
          style={{ fontSize: 28, letterSpacing: '-0.02em' }}
        >
          ¿Cuánto tenés<br />en {accountName}?
        </p>
        <p className="text-[14px] font-normal leading-relaxed text-text-tertiary">
          Lo que ingresés acá arma tu primer Saldo Vivo.
        </p>
      </div>

      {/* Inputs de saldo */}
      <div className="flex flex-col justify-center px-6">
        {/* ARS */}
        {showARS && (
          <div className={showUSD ? 'mb-7' : ''}>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.09em] text-text-tertiary">
              Saldo en pesos
            </p>
            <div className="mb-2 flex items-baseline gap-2 border-b-2 border-text-disabled pb-[14px] transition-colors focus-within:border-primary">
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

        {/* USD */}
        {showUSD && (
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.09em] text-text-tertiary">
              Saldo en dólares
            </p>
            <div className="mb-2 flex items-baseline gap-2 border-b-2 border-text-disabled pb-[14px] transition-colors focus-within:border-primary">
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

      {/* Preview en vivo del Saldo Vivo */}
      <div
        className="card-s5 mx-6 mt-6 px-[18px] py-[16px] transition-all duration-300"
        style={{ opacity: hasAny ? 1 : 0.4 }}
      >
        <p className="mb-[8px] text-[10px] font-bold uppercase tracking-[0.8px] text-primary">
          ASÍ SE VE TU SALDO VIVO
        </p>
        <p
          className="font-extrabold leading-none tracking-[-0.03em] text-text-primary transition-all"
          style={{ fontSize: 32 }}
        >
          {hasAny ? previewMain : (mainIsUSD ? 'USD 0,00' : '$ 0')}
        </p>
        {previewSecondary && hasAny && (
          <p className="mt-[5px] text-[13px] font-medium text-text-tertiary">
            {previewSecondary}
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-3 rounded-[12px] bg-danger-soft px-4 py-3">
          <p className="text-[13px] font-medium text-danger">{error}</p>
        </div>
      )}

      <div className="flex-1" />

      {/* CTA */}
      <div className="shrink-0 px-6 pb-safe-cta pt-4">
        <button
          onClick={save}
          disabled={isSaving}
          className="w-full rounded-full bg-primary py-[17px] text-[15px] font-bold tracking-[0.01em] text-white transition-all active:scale-[0.97] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-25"
        >
          {isSaving ? 'Guardando...' : hasAny ? 'Continuar' : 'Continuar con $ 0'}
        </button>
        {!isSaving && (
          <button
            onClick={skip}
            className="mt-[6px] w-full py-3 text-[14px] font-medium text-text-tertiary transition-colors hover:text-text-secondary"
          >
            Hacerlo después
          </button>
        )}
      </div>
    </div>
  )
}
