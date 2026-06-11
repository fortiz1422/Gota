'use client'

import { CaretLeft } from '@phosphor-icons/react'

interface Props {
  step: 1 | 2 | 3
  onBack: () => void
}

export function StepHeader({ step, onBack }: Props) {
  return (
    <div
      className="blue-zone shrink-0 px-5"
      style={{
        paddingTop: `calc(env(safe-area-inset-top) + 14px)`,
        paddingBottom: 22,
      }}
    >
      <div className="flex items-center justify-between">
        {/* Back */}
        <button
          onClick={onBack}
          className="header-glass flex items-center gap-1.5 rounded-full px-3 py-[7px]"
          aria-label="Volver"
        >
          <CaretLeft size={14} weight="bold" className="text-white/90" />
          <span className="text-[13px] font-medium text-white/90">Volver</span>
        </button>

        {/* Paso N de 3 */}
        <span className="text-[12px] font-medium text-white/60">
          Paso {step} de 3
        </span>

        {/* Segmentos de progreso */}
        <div className="flex items-center gap-[5px]">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[3px] rounded-full transition-all duration-300"
              style={{
                width: 22,
                background:
                  i < step
                    ? 'rgba(255,255,255,0.62)'
                    : i === step
                      ? 'rgba(255,255,255,1)'
                      : 'rgba(255,255,255,0.28)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
