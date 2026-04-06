'use client'

import { formatCompact } from '@/lib/format'
import type { OrigenFilter } from './FiltroSheet'

interface Props {
  percibidos:    number
  tarjeta:       number
  pagoTarjeta:   number
  currency?:     'ARS' | 'USD'
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

  const itemClass = (o: OrigenFilter) =>
    [
      'flex-1 flex flex-col items-center text-center px-[14px] py-1 rounded-xl transition-colors',
      onOrigenClick ? 'cursor-pointer active:opacity-60' : '',
      isActive(o) ? 'bg-primary/[0.06]' : '',
    ].filter(Boolean).join(' ')

  return (
    <div className="flex items-stretch">
      <div
        className={itemClass('percibido')}
        onClick={() => onOrigenClick?.('percibido')}
        role={onOrigenClick ? 'button' : undefined}
      >
        <span style={{ fontSize: '9px', fontWeight: 700, color: isActive('percibido') ? '#2178A8' : '#90A4B0', letterSpacing: '0.07em', textTransform: 'uppercase', lineHeight: 1, marginBottom: '5px' }}>
          Percibidos
        </span>
        <span style={{ fontSize: '18px', fontWeight: 700, color: '#B84A12', letterSpacing: '-0.5px', lineHeight: 1, marginBottom: '4px' }}>
          {formatCompact(percibidos, currency)}
        </span>
        <span style={{ fontSize: '10px', color: '#4A6070', lineHeight: 1.3 }}>
          Caja + débito + pago tarjeta
        </span>
      </div>

      <div style={{ width: '1px', background: 'rgba(144,164,176,0.25)', alignSelf: 'stretch' }} />

      <div
        className={itemClass('tarjeta')}
        onClick={() => onOrigenClick?.('tarjeta')}
        role={onOrigenClick ? 'button' : undefined}
      >
        <span style={{ fontSize: '9px', fontWeight: 700, color: isActive('tarjeta') ? '#2178A8' : '#90A4B0', letterSpacing: '0.07em', textTransform: 'uppercase', lineHeight: 1, marginBottom: '5px' }}>
          Tarjeta
        </span>
        <span style={{ fontSize: '18px', fontWeight: 700, color: '#0D1829', letterSpacing: '-0.5px', lineHeight: 1, marginBottom: '4px' }}>
          {tarjeta > 0 ? formatCompact(tarjeta, currency) : '—'}
        </span>
        <span style={{ fontSize: '10px', color: '#4A6070', lineHeight: 1.3 }}>
          Consumos aún no debitados
        </span>
      </div>

      <div style={{ width: '1px', background: 'rgba(144,164,176,0.25)', alignSelf: 'stretch' }} />

      <div
        className={itemClass('pago_tarjeta')}
        onClick={() => onOrigenClick?.('pago_tarjeta')}
        role={onOrigenClick ? 'button' : undefined}
      >
        <span style={{ fontSize: '9px', fontWeight: 700, color: isActive('pago_tarjeta') ? '#2178A8' : '#90A4B0', letterSpacing: '0.07em', textTransform: 'uppercase', lineHeight: 1, marginBottom: '5px' }}>
          Pago tarjeta
        </span>
        <span style={{ fontSize: '18px', fontWeight: 700, color: '#2178A8', letterSpacing: '-0.5px', lineHeight: 1, marginBottom: '4px' }}>
          {pagoTarjeta > 0 ? formatCompact(pagoTarjeta, currency) : '—'}
        </span>
        <span style={{ fontSize: '10px', color: '#4A6070', lineHeight: 1.3 }}>
          Pagos reales del mes
        </span>
      </div>
    </div>
  )
}
