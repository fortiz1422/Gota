'use client'

interface Props {
  onCreate: () => void
  onClone?: () => void
  canClone?: boolean
}

export function BudgetEmptyState({ onCreate, onClone, canClone = false }: Props) {
  return (
    <div className="mx-auto max-w-md px-[22px]">
      <section className="card-s5 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Control del mes</p>
        <h3 className="mt-2 text-[20px] font-bold leading-7 text-text-primary">
          Todavía no definiste un marco para este mes
        </h3>
        <p className="mt-2 text-[14px] leading-6 text-text-secondary">
          Con un presupuesto simple por categoría, Gota te ayuda a detectar rápido cuándo te empezás a correr sin tocar tu saldo real.
        </p>

        <div className="mt-4 space-y-2 text-[13px] text-text-secondary">
          <p>• ponés un límite a las categorías que más pesan</p>
          <p>• ves si el mes sigue en línea</p>
          <p>• podés clonar el mes anterior y ajustar sólo lo necesario</p>
        </div>

        <button
          type="button"
          onClick={onCreate}
          className="mt-5 w-full rounded-button bg-primary py-3 text-[13px] font-semibold text-white"
        >
          Armar mi presupuesto
        </button>

        {canClone && onClone ? (
          <button
            type="button"
            onClick={onClone}
            className="mt-2 w-full rounded-button border border-primary/20 bg-primary/10 py-3 text-[13px] font-semibold text-primary"
          >
            Clonar el mes anterior
          </button>
        ) : null}
      </section>
    </div>
  )
}
