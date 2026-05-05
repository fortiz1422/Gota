'use client'

import { useEffect, useState } from 'react'
import { trackEvent } from '@/lib/product-analytics/client'
interface OnboardingData {
  accountName: string
  balanceARS: number | null
  balanceUSD: number | null
}

interface Props {
  data: OnboardingData
  onNext: () => void
}

export function Step6Done({ data, onNext }: Props) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const complete = async () => {
      await fetch('/api/user-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboarding_completed: true }),
      })
      trackEvent('onboarding_completed', {
        has_initial_balance: Boolean(data.balanceARS || data.balanceUSD),
      })
      setIsReady(true)
    }
    complete()
  }, [data.balanceARS, data.balanceUSD])

  const completedItems = [
    data.accountName && `Cuenta "${data.accountName}" creada`,
    (data.balanceARS || data.balanceUSD) && `Saldo inicial registrado`,
  ].filter(Boolean) as string[]

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-bg-primary px-5 pb-10 pt-safe">
      <div />

      <div className="flex flex-col items-center text-center">
        {/* Animated check */}
        <div
          className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success/10"
          style={{ animation: 'fadeScale 0.4s ease-out' }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-10 w-10 text-success"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h2 className="text-2xl font-semibold text-text-primary">¡Listo!</h2>
        <p className="mt-2 text-sm text-text-tertiary">
          Tu Saldo Vivo está configurado.
        </p>

        {completedItems.length > 0 && (
          <ul className="mt-6 w-full space-y-2 text-left">
            {completedItems.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-text-secondary">
                <span className="text-success">✓</span>
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={onNext}
        disabled={!isReady}
        className="w-full rounded-full bg-primary py-4 text-sm font-semibold text-bg-primary transition-all active:scale-95 disabled:opacity-40"
      >
        Ver mi Saldo Vivo
      </button>

      <style>{`
        @keyframes fadeScale {
          from { opacity: 0; transform: scale(0.7); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
