'use client'

import { ChartBar } from '@phosphor-icons/react'

interface Props {
  onCreate: () => void
  onClone?: () => void
  canClone?: boolean
}

export function BudgetEmptyState({ onCreate, onClone, canClone = false }: Props) {
  return (
    <section className="mx-5 card-s5 border border-dashed border-primary/20 p-5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-bg-tertiary">
        <ChartBar size={20} weight="light" className="text-text-secondary" />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
        Presupuesto del mes
      </p>
      <h3 className="mt-2 text-[20px] font-bold text-text-primary">
        Definí límites por categoría
      </h3>
      <p className="mt-2 text-[14px] leading-6 text-text-tertiary">
        Creá un budget mensual para saber si venís dentro del plan sin afectar tu saldo real.
      </p>
      <ul className="mt-4 space-y-1.5">
        {[
          'Asignás un monto a cada categoría de gasto',
          'Ves en tiempo real si estás dentro o pasado',
          'Podés clonar el presupuesto del mes anterior',
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
        className="mt-5 w-full rounded-button bg-primary py-3 text-[13px] font-semibold text-white"
      >
        Crear presupuesto
      </button>
      {canClone && onClone ? (
        <button
          type="button"
          onClick={onClone}
          className="mt-2 w-full rounded-button border border-primary/30 py-3 text-[13px] font-semibold text-primary"
        >
          Clonar del mes anterior
        </button>
      ) : null}
    </section>
  )
}
