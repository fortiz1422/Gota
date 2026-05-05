'use client'

import { useEffect, useState } from 'react'
import { Table, Clock } from '@phosphor-icons/react'
import { trackEvent } from '@/lib/product-analytics/client'

interface Props {
  accountName: string
  balanceARS: number | null
  balanceUSD: number | null
  onNext: () => void
}

export function OnboardStep5Done({ accountName, balanceARS, balanceUSD, onNext }: Props) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const complete = async () => {
      try {
        await fetch('/api/user-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ onboarding_completed: true }),
        })
        trackEvent('onboarding_completed', {
          has_initial_balance: Boolean(balanceARS || balanceUSD),
        })
      } catch {
        // still allow proceeding
      }
      setIsReady(true)
    }
    complete()
  }, [balanceARS, balanceUSD])

  const hasSaldo = (balanceARS ?? 0) > 0 || (balanceUSD ?? 0) > 0

  const saldoDisplay = [
    (balanceARS ?? 0) > 0 && `$${balanceARS!.toLocaleString('es-AR')}`,
    (balanceUSD ?? 0) > 0 && `U$D ${balanceUSD!.toLocaleString('es-AR')}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      className="flex min-h-screen flex-col bg-bg-primary"
      style={{ animation: 'onboardIn 0.22s cubic-bezier(.4,0,.2,1)' }}
    >
      {/* Empty nav (no back, no dots) */}
      <div className="h-12 shrink-0" />

      {/* Done stage — vertically centered */}
      <div className="flex flex-1 flex-col justify-center px-[26px]">
        {/* Animated check */}
        <div
          className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success/10"
          style={{ animation: 'popIn 0.5s cubic-bezier(.34,1.56,.64,1)' }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path
              d="M6 14L11 19.5L22 8.5"
              stroke="var(--color-success)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-success">
          Todo configurado
        </p>
        <p
          className="mb-[10px] font-extrabold leading-[1.05] text-text-primary"
          style={{ fontSize: 36, letterSpacing: '-0.025em' }}
        >
          Listo para<br />arrancar.
        </p>
        <p className="mb-8 text-[15px] leading-relaxed text-text-secondary">
          Tu Saldo Vivo ya está activo.<br />
          Registrá tu primer gasto cuando quieras.
        </p>

        {/* Summary card */}
        <div className="overflow-hidden rounded-[20px] border border-border-subtle bg-bg-secondary">
          {/* Cuenta row */}
          <div className="flex items-center gap-[14px] px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/10">
              <Table size={16} weight="regular" className="text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="mb-[1px] text-[12px] text-text-tertiary">Cuenta creada</p>
              <p className="text-[14px] font-bold text-text-primary truncate">{accountName || '—'}</p>
            </div>
          </div>

          {/* Saldo row — solo si tiene saldo */}
          {hasSaldo && (
            <>
              <div className="mx-5 h-px bg-border-subtle" />
              <div className="flex items-center gap-[14px] px-5 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/10">
                  <Clock size={16} weight="regular" className="text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="mb-[1px] text-[12px] text-text-tertiary">Saldo inicial</p>
                  <p className="text-[14px] font-bold text-text-primary">{saldoDisplay}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="shrink-0 px-6 pb-9 pt-4">
        <button
          onClick={onNext}
          disabled={!isReady}
          className="w-full rounded-full py-[17px] text-[15px] font-bold tracking-[0.01em] text-white transition-all active:scale-[0.97] hover:opacity-90 disabled:opacity-25 disabled:cursor-not-allowed"
          style={{ background: 'var(--color-text-primary)' }}
        >
          Ver mi Saldo Vivo
        </button>
      </div>
    </div>
  )
}
