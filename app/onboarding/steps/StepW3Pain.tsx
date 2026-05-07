'use client'

import { useState } from 'react'
import { WizardProgress } from '../components/WizardProgress'
import { BackButton } from '../components/BackButton'

const PAINS = [
  { emoji: '😩', label: 'Empiezo a anotar y lo abandono en días' },
  { emoji: '🤷', label: 'No sé cuánto gasté hasta que reviso el banco' },
  { emoji: '💳', label: 'Los pagos con tarjeta me confunden' },
  { emoji: '📱', label: 'Las apps no son para la realidad argentina' },
  { emoji: '😰', label: 'Gasto de más pero no tengo datos para cambiar' },
  { emoji: '🔀', label: 'Mezclo ARS y dólares y pierdo el hilo' },
]

interface Props {
  onBack: () => void
  onNext: (pains: string[]) => void
}

export function StepW3Pain({ onBack, onNext }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (label: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(label) ? next.delete(label) : next.add(label)
      return next
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary pb-10 pt-safe">
      <div className="px-5">
        <div className="flex items-center gap-3 py-4">
          <BackButton onClick={onBack} />
          <div className="flex-1">
            <WizardProgress current={2} total={6} />
          </div>
          <div className="w-6" />
        </div>

        <div className="mt-6">
          <h2 className="type-title text-text-primary">¿Qué te pasa hoy?</h2>
          <p className="mt-1 type-body text-text-tertiary">Elegí todo lo que te suena</p>
        </div>
      </div>

      <div className="mt-6 flex-1 px-5 space-y-2">
        {PAINS.map(({ emoji, label }) => {
          const isSelected = selected.has(label)
          return (
            <button
              key={label}
              onClick={() => toggle(label)}
              className={`w-full flex items-center gap-3 rounded-card border px-4 py-3.5 text-left transition-colors ${
                isSelected
                  ? 'border-primary bg-primary-soft text-text-primary'
                  : 'border-border-subtle bg-bg-secondary text-text-secondary'
              }`}
            >
              <span className="text-lg">{emoji}</span>
              <span className="flex-1 type-body">{label}</span>
              <span
                className={`h-4 w-4 shrink-0 rounded border transition-colors ${
                  isSelected ? 'border-primary bg-primary' : 'border-border-strong'
                } flex items-center justify-center`}
              >
                {isSelected && (
                  <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 fill-none stroke-white stroke-2">
                    <polyline points="1 4 4 7 9 1" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            </button>
          )
        })}
      </div>

      <div className="px-5 mt-6">
        <button
          onClick={() => onNext(Array.from(selected))}
          className="w-full rounded-button bg-primary py-4 type-body-lg text-white transition-all active:scale-95"
        >
          Continuar
        </button>
      </div>
    </div>
  )
}
