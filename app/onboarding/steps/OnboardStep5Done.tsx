'use client'

import { CreditCard } from '@phosphor-icons/react'

interface Props {
  accountName: string
  preferredCurrency: 'ARS' | 'USD'
  heroBalanceMode: 'combined_ars' | 'combined_usd' | 'default_currency'
  balanceARS: number | null
  balanceUSD: number | null
  onNext: () => void
}

export function OnboardStep5Done({
  accountName,
  preferredCurrency,
  heroBalanceMode,
  balanceARS,
  balanceUSD,
  onNext,
}: Props) {
  const mainIsUSD =
    heroBalanceMode === 'combined_usd' ||
    (heroBalanceMode === 'default_currency' && preferredCurrency === 'USD')

  const isBoth = heroBalanceMode === 'combined_ars' || heroBalanceMode === 'combined_usd'

  const arsNum = balanceARS ?? 0
  const usdNum = balanceUSD ?? 0
  const hasAny = arsNum > 0 || usdNum > 0

  const mainLabel = mainIsUSD
    ? `USD ${usdNum.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
    : `$ ${arsNum.toLocaleString('es-AR')}`

  const secondaryLabel = isBoth
    ? mainIsUSD
      ? `ARS ${arsNum.toLocaleString('es-AR')}`
      : `USD ${usdNum.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
    : null

  return (
    <div
      className="min-h-app flex flex-col"
      style={{ animation: 'onboardIn 0.22s cubic-bezier(.4,0,.2,1)' }}
    >
      {/* Hero — Blue zone con Saldo Vivo real */}
      <div
        className="blue-zone shrink-0 px-[22px]"
        style={{
          paddingTop: `calc(env(safe-area-inset-top) + 24px)`,
          paddingBottom: 58,
        }}
      >
        {/* Label */}
        <p
          className="mb-[10px] text-[10px] font-bold uppercase tracking-[0.8px] text-white/55"
        >
          SALDO VIVO
        </p>

        {/* Monto principal */}
        <p
          className="font-extrabold leading-none tracking-[-0.03em] text-white"
          style={{ fontSize: 40 }}
        >
          {hasAny ? mainLabel : (mainIsUSD ? 'USD 0,00' : '$ 0')}
        </p>

        {/* Secundario bimoneda */}
        {secondaryLabel && hasAny && (
          <p className="mt-[6px] text-[13px] font-medium text-white/60">
            {secondaryLabel}
          </p>
        )}

        {/* Sin saldo: nota */}
        {!hasAny && (
          <p className="mt-[6px] text-[13px] text-white/55">
            Podés cargarlo en Config → Cuentas
          </p>
        )}
      </div>

      {/* Zona blanca */}
      <div
        className="flex flex-1 flex-col overflow-y-auto bg-bg-primary"
        style={{ marginTop: -24 }}
      >
        {/* Card Disponible real */}
        <div className="card-s5 mx-[22px] flex items-center gap-3 p-[18px]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/[0.08]">
            <CreditCard size={16} className="text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-text-primary">Cuenta activa</p>
            <p className="mt-0.5 text-[12px] leading-snug text-text-secondary">{accountName}</p>
          </div>
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'rgba(26,122,66,0.12)' }}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path
                d="M2.5 7L5.5 10L11.5 4"
                stroke="var(--color-success)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Mensaje central */}
        <div className="px-[26px] pt-6">
          <p
            className="mb-2 font-extrabold leading-[1.05] text-text-primary"
            style={{ fontSize: 26, letterSpacing: '-0.02em' }}
          >
            Tu Saldo Vivo<br />está activo.
          </p>
          <p className="text-[15px] leading-relaxed text-text-secondary">
            Registrá tu primer movimiento con SmartInput y mirá cómo se actualiza en tiempo real.
          </p>
        </div>

        {/* Teaser SmartInput */}
        <div
          className="mx-[22px] mt-5 flex items-center gap-3 rounded-[16px] px-4 py-[14px]"
          style={{ background: 'var(--color-surface-glass)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-text-secondary">café 2500...</p>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 19V5M5 12l7-7 7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <div className="flex-1" />

        {/* CTA */}
        <div className="shrink-0 px-[22px] pb-safe-cta pt-5">
          <button
            onClick={onNext}
            className="w-full rounded-full bg-primary py-[17px] text-[15px] font-bold tracking-[0.01em] text-white transition-all active:scale-[0.97] hover:opacity-90"
          >
            Ir a mi Saldo Vivo
          </button>
        </div>
      </div>
    </div>
  )
}
