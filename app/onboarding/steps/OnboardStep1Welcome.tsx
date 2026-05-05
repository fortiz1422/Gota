'use client'

import { CreditCard } from '@phosphor-icons/react'

interface Props {
  onNext: () => void
}

export function OnboardStep1Welcome({ onNext }: Props) {
  return (
    <div
      className="flex min-h-screen flex-col bg-bg-primary"
      style={{ animation: 'onboardIn 0.22s cubic-bezier(.4,0,.2,1)' }}
    >
      {/* Hero */}
      <div className="flex flex-1 flex-col px-[26px]">
        <p
          className="mb-1 mt-auto text-[64px] font-extrabold leading-none text-text-primary"
          style={{ letterSpacing: '-0.045em' }}
        >
          gota<span className="text-primary">.</span>
        </p>

        <p
          className="mb-7 font-light italic text-text-secondary"
          style={{ fontSize: 26, lineHeight: 1.2, letterSpacing: '-0.01em' }}
        >
          Tu plata,<br />clara.
        </p>

        {/* Home preview */}
        <div className="overflow-hidden rounded-3xl border border-border-subtle bg-bg-primary shadow-md">
          <div className="px-5 pb-[14px] pt-[18px]">
            <p className="mb-[6px] text-[10px] font-bold uppercase tracking-[0.1em] text-text-tertiary">
              Saldo Vivo
            </p>
            <p
              className="mb-[6px] font-extrabold leading-none text-text-primary"
              style={{ fontSize: 34, letterSpacing: '-0.03em' }}
            >
              USD 14.788,47
            </p>
            <div className="flex items-center gap-[10px]">
              <span className="text-[12px] font-semibold text-primary">ARS 10.633.632</span>
              <span className="text-[11px] text-text-disabled">|</span>
              <span className="text-[12px] font-semibold text-primary">USD 7.300,00</span>
            </div>
          </div>

          <div className="mx-5 h-px bg-border-subtle" />

          <div className="flex items-center gap-3 px-5 py-[14px]">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/8">
              <CreditCard size={16} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="mb-[2px] text-[13px] font-bold text-text-primary">Disponible real</p>
              <p className="text-[11px] text-text-tertiary leading-snug">
                Ya descuenta deuda y consumos en tarjeta.
              </p>
            </div>
            <p className="shrink-0 text-[14px] font-extrabold text-text-primary">USD 12.606,08</p>
          </div>
        </div>

        <div className="h-6 shrink-0" />
      </div>

      {/* CTA */}
      <div className="shrink-0 px-6 pb-9 pt-4">
        <button
          onClick={onNext}
          className="w-full rounded-full py-[17px] text-[15px] font-bold tracking-[0.01em] text-white transition-all active:scale-[0.97] hover:opacity-90"
          style={{ background: 'var(--color-text-primary)' }}
        >
          Empezar
        </button>
      </div>
    </div>
  )
}
