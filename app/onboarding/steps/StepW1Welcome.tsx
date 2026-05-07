'use client'

import Image from 'next/image'

interface Props {
  onNext: () => void
}

export function StepW1Welcome({ onNext }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-bg-primary px-5 pb-10 pt-safe">
      <div className="flex-1 flex flex-col justify-center">
        {/* Logo */}
        <div className="mb-10">
          <Image
            src="/gota-wordmark.png"
            alt="Gota"
            width={60}
            height={80}
            priority
            style={{ mixBlendMode: 'multiply' }}
          />
        </div>

        {/* Headline */}
        <h1 className="type-title leading-tight text-text-primary">
          Tu plata,{' '}
          <span className="text-primary">clara.</span>
          <br />
          Siempre.
        </h1>
        <p className="mt-3 type-body leading-relaxed text-text-tertiary">
          Registrá gastos en segundos. Sabé exactamente cuánto tenés disponible.
        </p>

        {/* Dashboard mockup */}
        <div className="mt-10 rounded-card border border-border-subtle bg-bg-secondary p-4 surface-module">
          <p className="mb-3 type-label text-text-tertiary">
            SALDO DEL MES (ARS)
          </p>
          <div className="space-y-1.5">
            <div className="flex justify-between type-meta text-text-secondary">
              <span>Ingresos del mes</span>
              <span>$1.000.000</span>
            </div>
            <div className="flex justify-between type-meta text-text-secondary">
              <span>Gastos percibidos</span>
              <span className="text-danger">−$350.000</span>
            </div>
            <div className="flex justify-between type-meta text-text-secondary">
              <span>Pago de tarjetas</span>
              <span className="text-danger">−$450.000</span>
            </div>
            <div className="my-2 h-px bg-separator" />
            <div className="flex justify-between type-body-lg text-text-primary">
              <span>Disponible</span>
              <span className="text-primary">$200.000</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="type-micro text-success">✓ Verificado hoy</span>
          </div>
        </div>
      </div>

      <button
        onClick={onNext}
        className="w-full rounded-button bg-primary py-4 type-body-lg text-white transition-transform active:scale-95"
      >
        Empezar
      </button>
    </div>
  )
}
