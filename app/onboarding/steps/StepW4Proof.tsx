'use client'

import { WizardProgress } from '../components/WizardProgress'
import { BackButton } from '../components/BackButton'

// TODO: reemplazar con testimonios reales cuando los tengas
const TESTIMONIALS = [
  {
    initials: 'MV',
    name: 'Martín V.',
    tag: 'Empleado en relación de dependencia',
    quote:
      'Por primera vez el saldo me cierra con el banco. Llevo 3 meses sin abandonar.',
  },
  {
    initials: 'LM',
    name: 'Lara M.',
    tag: 'Freelance',
    quote:
      'Registro un gasto en 5 segundos. Antes tardaba 2 minutos y lo dejaba para después.',
  },
  {
    initials: 'DP',
    name: 'Diego P.',
    tag: 'Comerciante',
    quote: 'Finalmente una app que entiende que tengo ARS y dólares.',
  },
]

interface Props {
  onBack: () => void
  onNext: () => void
}

export function StepW4Proof({ onBack, onNext }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-bg-primary pb-10 pt-safe">
      <div className="px-5">
        <div className="flex items-center gap-3 py-4">
          <BackButton onClick={onBack} />
          <div className="flex-1">
            <WizardProgress current={3} total={6} />
          </div>
          <div className="w-6" />
        </div>

        <div className="mt-6">
          <h2 className="text-2xl font-semibold text-text-primary">
            Miles de argentinos ya controlan su plata
          </h2>
        </div>
      </div>

      <div className="mt-8 flex-1 px-5 space-y-3">
        {TESTIMONIALS.map(({ initials, name, tag, quote }) => (
          <div key={name} className="rounded-2xl border border-border-subtle bg-bg-secondary p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 shrink-0 rounded-full bg-primary/12 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{initials}</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-text-primary">{name}</p>
                <p className="text-[10px] text-text-tertiary">{tag}</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-text-secondary">&quot;{quote}&quot;</p>
          </div>
        ))}
      </div>

      <div className="px-5 mt-6">
        <button
          onClick={onNext}
          className="w-full rounded-full bg-primary py-4 text-sm font-semibold text-bg-primary transition-transform active:scale-95"
        >
          Continuar
        </button>
      </div>
    </div>
  )
}
