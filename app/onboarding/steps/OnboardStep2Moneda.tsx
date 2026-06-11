'use client'

import { useState } from 'react'
import { StepHeader } from '../components/StepHeader'

type CurrencyChoice = 'ARS' | 'USD' | 'BOTH'
type VizChoice = 'ARS' | 'USD'

interface Props {
  onBack: () => void
  onNext: (currency: 'ARS' | 'USD', heroMode: 'combined_ars' | 'combined_usd' | 'default_currency') => void
}

const CURRENCY_OPTS: { value: CurrencyChoice; flag: string; title: string; sub: string }[] = [
  { value: 'ARS', flag: '🇦🇷', title: 'Solo pesos', sub: 'Registro y visualización en ARS' },
  { value: 'USD', flag: '🇺🇸', title: 'Solo dólares', sub: 'Registro y visualización en USD' },
  { value: 'BOTH', flag: '🔄', title: 'Ambas monedas', sub: 'Registrás en ARS y USD' },
]

const VIZ_OPTS: { value: VizChoice; icon: string; title: string; sub: string }[] = [
  { value: 'USD', icon: '💵', title: 'En dólares', sub: 'Los pesos se convierten al oficial' },
  { value: 'ARS', icon: '💴', title: 'En pesos', sub: 'Los dólares se convierten al oficial' },
]

export function OnboardStep2Moneda({ onBack, onNext }: Props) {
  const [currency, setCurrency] = useState<CurrencyChoice | null>(null)
  const [viz, setViz] = useState<VizChoice | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const isBoth = currency === 'BOTH'
  const canContinue = currency !== null && (!isBoth || viz !== null)

  const handleContinue = async () => {
    if (!canContinue || isSaving) return
    setIsSaving(true)

    let defaultCurrency: 'ARS' | 'USD'
    let heroMode: 'combined_ars' | 'combined_usd' | 'default_currency'

    if (isBoth) {
      defaultCurrency = viz === 'USD' ? 'USD' : 'ARS'
      heroMode = viz === 'USD' ? 'combined_usd' : 'combined_ars'
    } else {
      defaultCurrency = currency as 'ARS' | 'USD'
      heroMode = 'default_currency'
    }

    try {
      await fetch('/api/user-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_currency: defaultCurrency, hero_balance_mode: heroMode }),
      })
    } catch {
      // best effort
    }

    setIsSaving(false)
    onNext(defaultCurrency, heroMode)
  }

  const handleSelectCurrency = (val: CurrencyChoice) => {
    setCurrency(val)
    if (val !== 'BOTH') setViz(null)
  }

  return (
    <div
      className="min-h-app flex flex-col bg-bg-primary"
      style={{ animation: 'onboardIn 0.22s cubic-bezier(.4,0,.2,1)' }}
    >
      {/* Header azul con progreso */}
      <StepHeader step={1} onBack={onBack} />

      {/* Pregunta */}
      <div className="px-[26px] pb-[22px] pt-5">
        <p
          className="mb-2 font-extrabold leading-[1.1] text-text-primary"
          style={{ fontSize: 28, letterSpacing: '-0.02em' }}
        >
          ¿En qué monedas<br />operás?
        </p>
        <p className="text-[14px] font-normal leading-relaxed text-text-tertiary">
          Esto determina cómo registrás tus movimientos.
        </p>
      </div>

      {/* Opciones de moneda */}
      <div className="flex flex-col gap-2 px-6">
        {CURRENCY_OPTS.map((opt) => {
          const sel = currency === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => handleSelectCurrency(opt.value)}
              className={`flex items-center gap-[14px] rounded-[20px] border px-5 py-[18px] text-left transition-all ${
                sel
                  ? 'border-primary bg-bg-primary shadow-[0_0_0_3px_rgba(33,120,168,0.08)]'
                  : 'border-border-subtle bg-bg-secondary hover:border-primary/30 hover:bg-bg-primary'
              }`}
              style={{ borderWidth: 1.5 }}
            >
              <span className="shrink-0 text-[26px] leading-none">{opt.flag}</span>
              <div className="min-w-0 flex-1">
                <p className={`mb-[2px] text-[15px] font-bold transition-colors ${sel ? 'text-primary' : 'text-text-primary'}`}>
                  {opt.title}
                </p>
                <p className="text-[12px] leading-snug text-text-tertiary">{opt.sub}</p>
              </div>
              <div
                className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                  sel ? 'border-primary bg-primary' : 'border-text-disabled'
                }`}
              >
                <div
                  className="h-2 w-2 rounded-full bg-white transition-transform"
                  style={{ transform: sel ? 'scale(1)' : 'scale(0)', transitionTimingFunction: 'cubic-bezier(.34,1.56,.64,1)' }}
                />
              </div>
            </button>
          )
        })}
      </div>

      {/* Panel de visualización — solo si BOTH */}
      <div
        className="mx-6 overflow-hidden rounded-[20px] border border-border-subtle bg-bg-secondary transition-all duration-[350ms] ease-[cubic-bezier(.4,0,.2,1)]"
        style={{
          maxHeight: isBoth ? 300 : 0,
          opacity: isBoth ? 1 : 0,
          marginTop: isBoth ? 16 : 0,
          borderWidth: isBoth ? 1.5 : 0,
        }}
      >
        <div className="p-[18px_20px]">
          <p className="mb-[14px] text-[11px] font-bold uppercase tracking-[0.08em] text-primary">
            ¿Cómo querés ver tu Saldo Vivo?
          </p>
          <div className="flex flex-col gap-2">
            {VIZ_OPTS.map((opt) => {
              const sel = viz === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setViz(opt.value)}
                  className={`flex items-center gap-3 rounded-[14px] border px-4 py-[14px] text-left transition-all ${
                    sel
                      ? 'border-primary bg-primary/8'
                      : 'border-transparent bg-bg-primary hover:border-primary/30'
                  }`}
                  style={{ borderWidth: 1.5 }}
                >
                  <span className="shrink-0 text-[18px]">{opt.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`mb-[2px] text-[14px] font-bold ${sel ? 'text-primary' : 'text-text-primary'}`}>
                      {opt.title}
                    </p>
                    <p className="text-[11px] text-text-tertiary">{opt.sub}</p>
                  </div>
                  <div
                    className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                      sel ? 'border-primary bg-primary' : 'border-text-disabled'
                    }`}
                  >
                    <div
                      className="h-[6px] w-[6px] rounded-full bg-white transition-transform"
                      style={{ transform: sel ? 'scale(1)' : 'scale(0)', transitionTimingFunction: 'cubic-bezier(.34,1.56,.64,1)' }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Nota tipo de cambio oficial */}
      <div
        className="mx-6 mt-[14px] flex items-center gap-2 rounded-xl bg-primary/8 px-[14px] py-[10px] transition-opacity duration-300"
        style={{ opacity: isBoth ? 1 : 0, pointerEvents: isBoth ? 'auto' : 'none' }}
      >
        <div className="h-[6px] w-[6px] shrink-0 rounded-full bg-primary" />
        <span className="text-[12px] font-medium text-text-secondary">
          Las conversiones usan el tipo de cambio oficial actualizado.
        </span>
      </div>

      <div className="flex-1" />

      {/* CTA */}
      <div className="shrink-0 px-6 pb-safe-cta pt-4">
        <button
          onClick={handleContinue}
          disabled={!canContinue || isSaving}
          className="w-full rounded-full bg-primary py-[17px] text-[15px] font-bold tracking-[0.01em] text-white transition-all active:scale-[0.97] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-25 disabled:active:scale-100"
        >
          {isSaving ? 'Guardando...' : 'Continuar'}
        </button>
      </div>
    </div>
  )
}
