'use client'

import { WizardProgress } from '../components/WizardProgress'
import { BackButton } from '../components/BackButton'

const SOLUTIONS = [
  {
    pain: 'Abandonás en días',
    fix: 'Un campo de texto. Sin formularios. 5 segundos.',
    icon: '⚡',
  },
  {
    pain: 'No sabés cuánto tenés',
    fix: 'Saldo Vivo: tu balance real, actualizado al instante.',
    icon: '💧',
  },
  {
    pain: 'Tarjeta = caja negra',
    fix: 'Separamos lo diferido de lo que ya salió del banco.',
    icon: '💳',
  },
  {
    pain: 'ARS y dólares mezclados',
    fix: 'Registrá en ambas monedas, con una principal.',
    icon: '🇦🇷',
  },
]

interface Props {
  onBack: () => void
  onNext: () => void
}

export function StepW5Solution({ onBack, onNext }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-bg-primary pb-10 pt-safe">
      <div className="px-5">
        <div className="flex items-center gap-3 py-4">
          <BackButton onClick={onBack} />
          <div className="flex-1">
            <WizardProgress current={4} total={6} />
          </div>
          <div className="w-6" />
        </div>

        <div className="mt-6">
          <h2 className="type-title text-text-primary">Así lo resuelve Gota</h2>
        </div>
      </div>

      <div className="mt-8 flex-1 px-5 space-y-3">
        {SOLUTIONS.map(({ pain, fix, icon }) => (
          <div key={pain} className="rounded-card border border-border-subtle bg-bg-secondary p-4 flex gap-3">
            <span className="text-xl mt-0.5">{icon}</span>
            <div>
              <p className="type-meta text-text-tertiary mb-0.5">{pain}</p>
              <p className="type-body-lg text-text-primary leading-snug">{fix}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="px-5 mt-6">
        <button
          onClick={onNext}
          className="w-full rounded-button bg-primary py-4 type-body-lg text-white transition-transform active:scale-95"
        >
          Tiene sentido →
        </button>
      </div>
    </div>
  )
}
