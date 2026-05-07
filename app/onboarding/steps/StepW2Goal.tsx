'use client'

import { useState } from 'react'
import { WizardProgress } from '../components/WizardProgress'
import { BackButton } from '../components/BackButton'

const GOALS = [
  { emoji: '💸', label: 'Saber a dónde va mi plata' },
  { emoji: '🎯', label: 'Gastar menos en impulsos' },
  { emoji: '💰', label: 'Ahorrar todos los meses' },
  { emoji: '🗂️', label: 'Ordenar ARS y dólares juntos' },
  { emoji: '📊', label: 'Entender mis gastos con tarjeta' },
  { emoji: '🧘', label: 'Tener paz mental con el dinero' },
]

interface Props {
  onBack: () => void
  onNext: (goal: string) => void
}

export function StepW2Goal({ onBack, onNext }: Props) {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary pb-10 pt-safe">
      <div className="px-5">
        <div className="flex items-center gap-3 py-4">
          <BackButton onClick={onBack} />
          <div className="flex-1">
            <WizardProgress current={1} total={6} />
          </div>
          <div className="w-6" />
        </div>

        <div className="mt-6">
          <h2 className="type-title text-text-primary">¿Qué querés lograr?</h2>
          <p className="mt-1 type-body text-text-tertiary">Elegí tu objetivo principal</p>
        </div>
      </div>

      <div className="mt-6 flex-1 px-5 space-y-2">
        {GOALS.map(({ emoji, label }) => (
          <button
            key={label}
            onClick={() => setSelected(label)}
            className={`w-full flex items-center gap-3 rounded-card border px-4 py-3.5 text-left transition-colors ${
              selected === label
                ? 'border-primary bg-primary-soft text-text-primary'
                : 'border-border-subtle bg-bg-secondary text-text-secondary'
            }`}
          >
            <span className="text-lg">{emoji}</span>
            <span className="type-body">{label}</span>
          </button>
        ))}
      </div>

      <div className="px-5 mt-6">
        <button
          onClick={() => selected && onNext(selected)}
          disabled={!selected}
          className="w-full rounded-button bg-primary py-4 type-body-lg text-white transition-all active:scale-95 disabled:opacity-40"
        >
          Continuar
        </button>
      </div>
    </div>
  )
}
