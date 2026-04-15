'use client'

import { useRouter } from 'next/navigation'

// TODO: conectar con sistema de pago (Stripe, MercadoPago, etc.)
// TODO: reemplazar precios placeholder con precios reales
// TODO: implementar lógica de trial period

const FEATURES = [
  { icon: '📅', label: 'Historial completo (más de 12 meses)' },
  { icon: '📤', label: 'Exportación CSV ilimitada' },
  { icon: '🎯', label: 'Presupuestos por categoría' },
  { icon: '📈', label: 'Tendencias y gráficos avanzados' },
]

export function StepW8Paywall() {
  const router = useRouter()

  return (
    <div className="flex min-h-screen flex-col items-center bg-bg-primary px-5 pb-10 pt-safe">
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        {/* Logo mark */}
        <div className="mb-6 h-14 w-14 rounded-full bg-primary/12 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="h-7 w-7 fill-primary">
            <path d="M12 2C9 7 5 9.5 5 14a7 7 0 0 0 14 0c0-4.5-4-7-7-12Z" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-text-primary text-center">Gota Pro</h2>
        <p className="mt-1 text-sm text-text-tertiary text-center">Seguí sin límites</p>

        {/* Placeholder testimonial */}
        <div className="mt-6 w-full rounded-2xl border border-border-subtle bg-bg-secondary p-4">
          <div className="flex gap-1 mb-2">
            {[...Array(5)].map((_, i) => (
              <span key={i} className="text-warning text-xs">★</span>
            ))}
          </div>
          {/* TODO: reemplazar con testimonio real */}
          <p className="text-sm text-text-secondary leading-relaxed">
            "Con Gota Pro finalmente entiendo mis tendencias mes a mes."
          </p>
          <p className="mt-2 text-[10px] text-text-tertiary">— Usuario Pro</p>
        </div>

        {/* Features */}
        <div className="mt-6 w-full space-y-2.5">
          {FEATURES.map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-base">{icon}</span>
              <span className="text-sm text-text-secondary">{label}</span>
              <span className="ml-auto text-xs font-semibold text-success">✓</span>
            </div>
          ))}
        </div>

        {/* Pricing placeholder */}
        <div className="mt-8 w-full rounded-2xl border border-primary/20 bg-primary/6 p-4 text-center">
          {/* TODO: reemplazar con precio real */}
          <p className="text-xs text-text-tertiary">7 días gratis, después</p>
          <p className="text-2xl font-bold text-text-primary mt-0.5">
            {/* TODO: precio */}
            $X.XXX <span className="text-sm font-normal text-text-tertiary">/ mes</span>
          </p>
        </div>
      </div>

      <div className="w-full space-y-3">
        {/* TODO: conectar con payment provider */}
        <button
          onClick={() => {
            // TODO: iniciar flow de pago / trial
            router.push('/')
          }}
          className="w-full rounded-full bg-primary py-4 text-sm font-semibold text-bg-primary transition-transform active:scale-95"
        >
          Empezar gratis 7 días
        </button>

        <button
          onClick={() => router.push('/')}
          className="w-full py-2 text-sm text-text-tertiary transition-colors active:text-text-secondary"
        >
          Continuar con plan gratis
        </button>
      </div>
    </div>
  )
}
