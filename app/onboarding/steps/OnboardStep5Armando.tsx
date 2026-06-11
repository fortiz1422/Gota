'use client'

import { useEffect, useState } from 'react'
import { trackEvent } from '@/lib/product-analytics/client'

interface Props {
  accountName: string
  preferredCurrency: 'ARS' | 'USD'
  heroBalanceMode: 'combined_ars' | 'combined_usd' | 'default_currency'
  balanceARS: number | null
  balanceUSD: number | null
  onNext: () => void
}

const ITEMS = [
  (d: Props) => `Moneda: ${d.preferredCurrency === 'ARS' ? 'Pesos' : d.preferredCurrency === 'USD' ? 'Dólares' : 'Bimoneda'}`,
  (d: Props) => `Cuenta: ${d.accountName}`,
  (d: Props) => {
    const parts = [
      (d.balanceARS ?? 0) > 0 && `$ ${d.balanceARS!.toLocaleString('es-AR')}`,
      (d.balanceUSD ?? 0) > 0 && `USD ${d.balanceUSD!.toLocaleString('es-AR')}`,
    ].filter(Boolean)
    return parts.length > 0 ? `Saldo: ${parts.join(' · ')}` : 'Saldo: pendiente'
  },
]

export function OnboardStep5Armando(props: Props) {
  const { onNext } = props
  const [checksDone, setChecksDone] = useState(0)

  useEffect(() => {
    const complete = async () => {
      try {
        await fetch('/api/user-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ onboarding_completed: true }),
        })
        trackEvent('onboarding_completed', {
          has_initial_balance: Boolean(props.balanceARS || props.balanceUSD),
        })
      } catch {
        // avanzar igual
      }
    }
    complete()

    // Checks con stagger
    const timers = [
      setTimeout(() => setChecksDone(1), 300),
      setTimeout(() => setChecksDone(2), 650),
      setTimeout(() => setChecksDone(3), 1000),
      setTimeout(() => onNext(), 1900),
    ]
    return () => timers.forEach(clearTimeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="min-h-app flex flex-col"
      style={{ animation: 'onboardIn 0.22s cubic-bezier(.4,0,.2,1)' }}
    >
      {/* Header azul slim */}
      <div
        className="blue-zone shrink-0"
        style={{
          paddingTop: `calc(env(safe-area-inset-top) + 14px)`,
          paddingBottom: 52,
        }}
      />

      {/* Zona blanca */}
      <div
        className="flex flex-1 flex-col justify-center px-[26px]"
        style={{ marginTop: -24 }}
      >
        {/* Spinner + título */}
        <div className="mb-8 flex items-center gap-4">
          <div className="spinner" />
          <p
            className="font-extrabold leading-tight text-text-primary"
            style={{ fontSize: 28, letterSpacing: '-0.02em' }}
          >
            Armando tu<br />Saldo Vivo…
          </p>
        </div>

        {/* Check rows */}
        <div className="flex flex-col gap-[10px]">
          {ITEMS.map((fn, i) => {
            const done = checksDone > i
            return (
              <div
                key={i}
                className="flex items-center gap-3 transition-all duration-300"
                style={{ opacity: done ? 1 : 0.25 }}
              >
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-300"
                  style={{
                    background: done ? 'rgba(26,122,66,0.12)' : 'rgba(0,0,0,0.05)',
                  }}
                >
                  {done ? (
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M2.5 7L5.5 10L11.5 4"
                        stroke="var(--color-success)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-text-disabled" />
                  )}
                </div>
                <p className="text-[14px] font-medium text-text-primary">
                  {fn(props)}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
