'use client'

import { CreditCard, Lightning, ArrowsLeftRight } from '@phosphor-icons/react'

interface Props {
  onNext: () => void
}

export function OnboardStep1Welcome({ onNext }: Props) {
  return (
    <div
      className="min-h-app flex flex-col"
      style={{ animation: 'onboardIn 0.22s cubic-bezier(.4,0,.2,1)' }}
    >
      {/* Hero — Blue zone con Saldo Vivo ejemplo */}
      <div
        className="blue-zone shrink-0 px-[22px]"
        style={{
          paddingTop: `calc(env(safe-area-inset-top) + 24px)`,
          paddingBottom: 58,
        }}
      >
        {/* Wordmark + chip Ejemplo */}
        <div className="mb-6 flex items-center justify-between">
          <div className="inline-flex items-baseline leading-none">
            <span
              className="font-extrabold tracking-[-0.04em] text-white"
              style={{ fontSize: 24 }}
            >
              gota
            </span>
            <span
              className="font-extrabold tracking-[-0.04em]"
              style={{ fontSize: 24, color: '#5BA8CC' }}
            >
              .
            </span>
          </div>
          <div
            className="header-glass flex items-center gap-1.5 rounded-full px-3 py-[6px]"
          >
            <div className="h-[5px] w-[5px] rounded-full bg-white/55" />
            <span className="text-[11px] font-semibold text-white/80">Ejemplo</span>
          </div>
        </div>

        {/* Saldo Vivo demo */}
        <p
          className="mb-[10px] text-[10px] font-bold uppercase tracking-[0.8px] text-white/55"
        >
          SALDO VIVO
        </p>
        <p
          className="font-extrabold leading-none tracking-[-0.03em] text-white"
          style={{ fontSize: 40 }}
        >
          $ 10.633.632
        </p>
        <p className="mt-[6px] text-[13px] font-medium text-white/60">
          ARS 10.633.632 · USD 7.300
        </p>
      </div>

      {/* Zona blanca */}
      <div
        className="flex flex-1 flex-col overflow-y-auto bg-bg-primary"
        style={{ marginTop: -24 }}
      >
        {/* Disponible real — card-s5 overlap */}
        <div className="card-s5 mx-[22px] flex items-center gap-3 p-[18px]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/[0.08]">
            <CreditCard size={16} className="text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-text-primary">Disponible real</p>
            <p className="mt-0.5 text-[12px] leading-snug text-text-secondary">
              Ya descuenta deuda en tarjeta
            </p>
          </div>
          <p className="shrink-0 text-[14px] font-bold text-text-primary">
            $ 8.240.100
          </p>
        </div>

        {/* 3 filas del modelo */}
        <div className="mx-[22px] mt-4 flex flex-col gap-[9px]">
          <ModelRow
            icon={<CreditCard size={17} className="text-primary" />}
            title="Tu saldo real"
            sub="Todo lo que tenés, en todas tus cuentas"
          />
          <ModelRow
            icon={<Lightning size={17} className="text-primary" />}
            title="SmartInput IA"
            sub="Registrá gastos en lenguaje natural"
          />
          <ModelRow
            icon={<ArrowsLeftRight size={17} className="text-primary" />}
            title="Bimoneda"
            sub="Pesos y dólares sin saltar de app"
          />
        </div>

        <div className="flex-1" />

        {/* CTA */}
        <div className="shrink-0 px-[22px] pb-safe-cta pt-5">
          <button
            onClick={onNext}
            className="w-full rounded-full bg-primary py-[17px] text-[15px] font-bold tracking-[0.01em] text-white transition-all active:scale-[0.97] hover:opacity-90"
          >
            Armar mi Saldo Vivo
          </button>
        </div>
      </div>
    </div>
  )
}

function ModelRow({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode
  title: string
  sub: string
}) {
  return (
    <div className="card-s5 flex items-center gap-3 px-[18px] py-[14px]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-primary/[0.08]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-text-primary">{title}</p>
        <p className="mt-[2px] text-[11px] leading-snug text-text-tertiary">{sub}</p>
      </div>
    </div>
  )
}
