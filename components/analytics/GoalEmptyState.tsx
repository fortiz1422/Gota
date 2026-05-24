'use client'

import { Target } from '@phosphor-icons/react'

interface Props {
  onCreate: () => void
}

export function GoalEmptyState({ onCreate }: Props) {
  return (
    <section className="mx-5 rounded-card border border-dashed border-border-ocean bg-bg-secondary p-5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-bg-tertiary">
        <Target size={20} weight="light" className="text-text-secondary" />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
        Tus metas
      </p>
      <h3 className="mt-2 text-[20px] font-bold text-text-primary">
        Convertí objetivos en un plan visible
      </h3>
      <p className="mt-2 text-[14px] leading-6 text-text-tertiary">
        Sin mezclarlo con tu saldo real. Las metas no apartan dinero automáticamente — el progreso avanza con aportes que vos registrás.
      </p>
      <ul className="mt-4 space-y-1.5">
        {[
          'Definí un monto objetivo',
          'Opcionalmente elegí una fecha',
          'Registrá aportes cuando realmente ahorres',
        ].map((bullet) => (
          <li key={bullet} className="flex items-center gap-2 text-[13px] text-text-tertiary">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
            {bullet}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onCreate}
        className="mt-5 rounded-button bg-primary px-4 py-3 text-[13px] font-semibold text-white"
      >
        Crear meta
      </button>
    </section>
  )
}
