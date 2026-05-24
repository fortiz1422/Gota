import { Target } from '@phosphor-icons/react'

export function MetasEmptyState() {
  return (
    <div className="mx-5 flex flex-col items-center rounded-card border border-dashed border-border-strong bg-bg-primary px-5 py-6 text-center">
      <Target size={24} weight="light" className="text-text-muted" />
      <p className="mt-3 text-[13px] font-semibold text-text-secondary">Próximamente</p>
      <p className="mt-1 text-[12px] text-text-tertiary">
        Vas a poder definir objetivos de ahorro
        <br />
        por categoría
      </p>
    </div>
  )
}
