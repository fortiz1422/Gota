'use client'

import { Wallet, CreditCard, CheckCircle } from '@phosphor-icons/react'
import { formatCompact } from '@/lib/format'
import type { OrigenFilter } from './FiltroSheet'

interface PillProps {
  label: string
  amount: string
  helper: string
  icon: React.ReactNode
  iconBg: string
  active: boolean
  accentClass: string
  accentBgClass: string
  accentBorderClass: string
  onClick: () => void
}

function MovementPill({
  label,
  amount,
  helper,
  icon,
  iconBg,
  active,
  accentClass,
  accentBgClass,
  accentBorderClass,
  onClick,
}: PillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex flex-1 flex-col rounded-card p-3 text-left transition-colors active:opacity-70',
        active
          ? `border ${accentBorderClass} ${accentBgClass}`
          : 'glass-1',
      ].join(' ')}
    >
      <div className={`mb-2 flex h-6 w-6 items-center justify-center rounded-full ${iconBg}`}>
        {icon}
      </div>
      <p className={`type-label ${active ? accentClass : 'text-text-tertiary'}`}>{label}</p>
      <p className="mt-1.5 whitespace-nowrap text-[15px] font-bold tracking-[-0.02em] text-text-primary">
        {amount}
      </p>
      <p className="mt-1.5 text-[10px] leading-tight text-text-tertiary">{helper}</p>
    </button>
  )
}

interface Props {
  percibidos: number
  tarjeta: number
  pagoTarjeta: number
  currency?: 'ARS' | 'USD'
  activeOrigen?: OrigenFilter | null
  onOrigenClick?: (o: OrigenFilter) => void
}

export function StripOperativo({
  percibidos,
  tarjeta,
  pagoTarjeta,
  currency = 'ARS',
  activeOrigen,
  onOrigenClick,
}: Props) {
  return (
    <div className="flex gap-2">
      <MovementPill
        label="PERCIBIDOS"
        amount={percibidos > 0 ? formatCompact(percibidos, currency) : '-'}
        helper="Dinero que salió de tu cuenta"
        icon={<Wallet size={13} weight="duotone" className="text-warning" />}
        iconBg="bg-warning/10"
        active={activeOrigen === 'percibido'}
        accentClass="text-warning"
        accentBgClass="bg-warning/10"
        accentBorderClass="border-warning/30"
        onClick={() => onOrigenClick?.('percibido')}
      />
      <MovementPill
        label="TARJETA"
        amount={tarjeta > 0 ? formatCompact(tarjeta, currency) : '-'}
        helper="Consumos del mes sin pagar"
        icon={<CreditCard size={13} weight="duotone" className="text-primary" />}
        iconBg="bg-primary/10"
        active={activeOrigen === 'tarjeta'}
        accentClass="text-primary"
        accentBgClass="bg-primary/10"
        accentBorderClass="border-primary/30"
        onClick={() => onOrigenClick?.('tarjeta')}
      />
      <MovementPill
        label="PAGO TARJETA"
        amount={pagoTarjeta > 0 ? formatCompact(pagoTarjeta, currency) : '-'}
        helper="Pagos por consumos previos"
        icon={<CheckCircle size={13} weight="duotone" className="text-success" />}
        iconBg="bg-success/10"
        active={activeOrigen === 'pago_tarjeta'}
        accentClass="text-success"
        accentBgClass="bg-success/10"
        accentBorderClass="border-success/30"
        onClick={() => onOrigenClick?.('pago_tarjeta')}
      />
    </div>
  )
}
