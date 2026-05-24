'use client'

interface Props {
  onCreate: () => void
  onClone?: () => void
  canClone?: boolean
}

export function BudgetEmptyState({ onCreate, onClone, canClone = false }: Props) {
  return (
    <section className="mx-5 rounded-card border border-dashed border-border-ocean bg-bg-secondary p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
        Presupuesto del mes
      </p>
      <h3 className="mt-2 text-[20px] font-bold text-text-primary">
        Definí límites por categoría
      </h3>
      <p className="mt-2 text-[14px] leading-6 text-text-tertiary">
        Creá un budget mensual para entender si venís dentro de tu plan sin afectar saldo vivo ni disponible.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-5 rounded-button bg-primary px-4 py-3 text-[13px] font-semibold text-white"
      >
        Crear presupuesto
      </button>
      {canClone && onClone ? (
        <button
          type="button"
          onClick={onClone}
          className="mt-3 rounded-button border border-border-ocean px-4 py-3 text-[13px] font-semibold text-primary"
        >
          Clonar presupuesto anterior
        </button>
      ) : null}
    </section>
  )
}
