'use client'

interface Props {
  onNext: () => void
}

export function StepW1Welcome({ onNext }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-bg-primary px-5 pb-10 pt-safe">
      <div className="flex-1 flex flex-col justify-center">
        {/* Logo */}
        <div className="mb-10">
          <span className="text-2xl font-bold text-primary tracking-tight">gota</span>
        </div>

        {/* Headline */}
        <h1 className="text-3xl font-bold leading-tight text-text-primary">
          Tu plata,{' '}
          <span className="text-primary">clara.</span>
          <br />
          Siempre.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-text-tertiary">
          Registrá gastos en segundos. Sabé exactamente cuánto tenés disponible.
        </p>

        {/* Dashboard mockup */}
        <div className="mt-10 rounded-2xl border border-border-subtle bg-bg-secondary p-4 shadow-sm">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-text-tertiary">
            💰 Saldo del Mes (ARS)
          </p>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-text-secondary">
              <span>Ingresos del mes</span>
              <span>$1.000.000</span>
            </div>
            <div className="flex justify-between text-xs text-text-secondary">
              <span>Gastos percibidos</span>
              <span className="text-danger">−$350.000</span>
            </div>
            <div className="flex justify-between text-xs text-text-secondary">
              <span>Pago de tarjetas</span>
              <span className="text-danger">−$450.000</span>
            </div>
            <div className="my-2 h-px bg-border-subtle" />
            <div className="flex justify-between text-sm font-semibold text-text-primary">
              <span>Disponible</span>
              <span className="text-primary">$200.000</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="text-[10px] text-success">✓ Verificado hoy</span>
          </div>
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full rounded-full bg-primary py-4 text-sm font-semibold text-bg-primary transition-transform active:scale-95"
      >
        Empezar
      </button>
    </div>
  )
}
