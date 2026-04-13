'use client'

import { formatCompact } from '@/lib/format'
import type { OrigenFilter } from './FiltroSheet'

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
  const isActive = (o: OrigenFilter) => activeOrigen === o

  const cardClass = (o: OrigenFilter) =>
    [
      'rounded-[18px] px-4 py-3 text-left transition-colors',
      onOrigenClick ? 'cursor-pointer active:opacity-60' : '',
      isActive(o) ? 'bg-primary/6' : '',
    ]
      .filter(Boolean)
      .join(' ')

  return (
    <div className="surface-module rounded-[22px] px-4 py-4">
      <button
        onClick={() => onOrigenClick?.('percibido')}
        className={`w-full ${cardClass('percibido')}`}
        type="button"
      >
        <p className={`type-label ${isActive('percibido') ? 'text-primary' : 'text-text-secondary'}`}>
          Percibidos
        </p>
        <p className="mt-1 text-[28px] font-extrabold tracking-[-0.03em] text-warning">
          {formatCompact(percibidos, currency)}
        </p>
        <p className="mt-1 text-[12px] text-text-secondary">
          Dinero que salió de tu cuenta
        </p>
      </button>

      <div className="my-3 h-px bg-[color:var(--color-separator)]" />

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onOrigenClick?.('tarjeta')}
          className={cardClass('tarjeta')}
          type="button"
        >
          <p className={`type-label ${isActive('tarjeta') ? 'text-primary' : 'text-text-secondary'}`}>
            Tarjeta
          </p>
          <p className="mt-1 text-[18px] font-bold tracking-[-0.02em] text-text-primary">
            {tarjeta > 0 ? formatCompact(tarjeta, currency) : '-'}
          </p>
          <p className="mt-1 text-[12px] text-text-dim">
            Consumos del mes sin pagar
          </p>
        </button>

        <button
          onClick={() => onOrigenClick?.('pago_tarjeta')}
          className={cardClass('pago_tarjeta')}
          type="button"
        >
          <p className={`type-label ${isActive('pago_tarjeta') ? 'text-primary' : 'text-text-secondary'}`}>
            Pago tarjeta
          </p>
          <p className="mt-1 text-[18px] font-bold tracking-[-0.02em] text-primary">
            {pagoTarjeta > 0 ? formatCompact(pagoTarjeta, currency) : '-'}
          </p>
          <p className="mt-1 text-[12px] text-text-dim">
            Pagos por consumos previos
          </p>
        </button>
      </div>
    </div>
  )
}
