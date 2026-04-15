'use client'

import { useState } from 'react'
import { WizardProgress } from '../components/WizardProgress'
import { BackButton } from '../components/BackButton'

const OPTIONS: { label: string; sub: string; value: 'ARS' | 'USD' }[] = [
  { label: '🇦🇷 Solo ARS', sub: 'Peso argentino', value: 'ARS' },
  { label: '🇺🇸 Solo USD', sub: 'Dólar', value: 'USD' },
  { label: '🔄 Ambas — principal ARS', sub: 'Registro en las dos, análisis en ARS', value: 'ARS' },
  { label: '🔄 Ambas — principal USD', sub: 'Registro en las dos, análisis en USD', value: 'USD' },
]

interface Props {
  onBack: () => void
  onNext: (currency: 'ARS' | 'USD') => void
}

export function StepW6Currency({ onBack, onNext }: Props) {
  const [selected, setSelected] = useState<number | null>(null)

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary pb-10 pt-safe">
      <div className="px-5">
        <div className="flex items-center gap-3 py-4">
          <BackButton onClick={onBack} />
          <div className="flex-1">
            <WizardProgress current={5} total={6} />
          </div>
          <div className="w-6" />
        </div>

        <div className="mt-6">
          <h2 className="text-2xl font-semibold text-text-primary">
            ¿Con qué moneda operás principalmente?
          </h2>
          <p className="mt-1 text-sm text-text-tertiary">
            Podés cambiar esto cuando quieras en Configuración
          </p>
        </div>
      </div>

      <div className="mt-6 flex-1 px-5 grid grid-cols-2 gap-3 content-start">
        {OPTIONS.map(({ label, sub }, idx) => (
          <button
            key={idx}
            onClick={() => setSelected(idx)}
            className={`rounded-2xl border p-4 text-left transition-colors ${
              selected === idx
                ? 'border-primary bg-primary/8'
                : 'border-border-subtle bg-bg-secondary'
            }`}
          >
            <p className={`text-sm font-semibold leading-snug ${selected === idx ? 'text-primary' : 'text-text-primary'}`}>
              {label}
            </p>
            <p className="mt-1 text-[10px] text-text-tertiary leading-tight">{sub}</p>
          </button>
        ))}
      </div>

      <div className="px-5 mt-6">
        <button
          onClick={() => selected !== null && onNext(OPTIONS[selected].value)}
          disabled={selected === null}
          className="w-full rounded-full bg-primary py-4 text-sm font-semibold text-bg-primary transition-all active:scale-95 disabled:opacity-40"
        >
          Continuar
        </button>
      </div>
    </div>
  )
}
