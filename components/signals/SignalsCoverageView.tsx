import { CheckCircle, Gear, Hourglass, MinusCircle } from '@phosphor-icons/react'
import type { SignalCoverage } from '@/lib/intelligence/signal-center'
import { coverageFamilyDisplay, coverageStateDisplay } from '@/lib/intelligence/signal-center-display'

const STATE_STYLE = {
  active: { icon: CheckCircle, className: 'bg-success-soft text-success' },
  learning: { icon: Hourglass, className: 'bg-data-soft text-data' },
  partial: { icon: Hourglass, className: 'bg-data-soft text-data' },
  needs_setup: { icon: Gear, className: 'bg-warning-soft text-warning' },
  not_applicable: { icon: MinusCircle, className: 'bg-bg-tertiary text-text-tertiary' },
} as const

export function SignalsCoverageView({ coverage }: { coverage: SignalCoverage[] }) {
  return (
    <div className="px-5 pb-8 pt-5">
      <p className="mb-4 text-sm leading-relaxed text-text-secondary">
        Esto es lo que Gota puede revisar hoy. Una señal activa puede estar tranquila y no aparecer en Ahora.
      </p>
      <div className="card-s5 overflow-hidden">
        {coverage.map(({ family, state }, index) => {
          const familyCopy = coverageFamilyDisplay(family)
          const stateCopy = coverageStateDisplay(state)
          const { icon: Icon, className } = STATE_STYLE[state]
          return (
            <div key={family} className={`flex gap-3 px-4 py-3.5 ${index ? 'border-t border-separator' : ''}`}>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${className}`}>
                <Icon size={18} weight="regular" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h3 className="text-sm font-bold text-text-primary">{familyCopy.label}</h3>
                  <span className={`text-[11px] font-bold ${className.split(' ')[1]}`}>{stateCopy.label}</span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">{familyCopy.description}</p>
                {state !== 'active' && <p className="mt-1 text-[11px] leading-relaxed text-text-tertiary">{stateCopy.description}</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
