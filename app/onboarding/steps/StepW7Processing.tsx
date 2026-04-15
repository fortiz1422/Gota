'use client'

import { useEffect } from 'react'

interface Props {
  preferredCurrency: 'ARS' | 'USD'
  onNext: () => void
}

export function StepW7Processing({ preferredCurrency, onNext }: Props) {
  useEffect(() => {
    const run = async () => {
      await fetch('/api/user-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_currency: preferredCurrency }),
      })
      setTimeout(onNext, 1500)
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-5 pt-safe">
      <div
        className="mb-6 h-16 w-16 rounded-full bg-primary/12 flex items-center justify-center"
        style={{ animation: 'pulse 1.2s ease-in-out infinite' }}
      >
        <svg viewBox="0 0 24 24" className="h-8 w-8 fill-primary">
          <path d="M12 2C9 7 5 9.5 5 14a7 7 0 0 0 14 0c0-4.5-4-7-7-12Z" />
        </svg>
      </div>

      <p className="text-base font-semibold text-text-primary">Preparando tu Gota...</p>
      <p className="mt-1 text-sm text-text-tertiary">Configurando para vos</p>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.92); }
        }
      `}</style>
    </div>
  )
}
