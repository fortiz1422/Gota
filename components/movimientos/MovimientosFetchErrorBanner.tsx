'use client'

interface Props {
  onRetry: () => void
}

export function MovimientosFetchErrorBanner({ onRetry }: Props) {
  return (
    <div
      role="alert"
      className="rounded-card border border-danger/20 bg-danger/5 px-4 py-3"
    >
      <p className="text-sm text-text-secondary">
        No pudimos cargar los movimientos. Revisá tu conexión e intentá de nuevo.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 min-h-11 text-sm font-semibold text-primary"
      >
        Reintentar
      </button>
    </div>
  )
}
