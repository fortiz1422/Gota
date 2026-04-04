'use client'

import { formatCompact } from '@/lib/format'

interface Props {
  percibidos: number
  tarjeta: number
  pagoTarjeta: number
  currency?: 'ARS' | 'USD'
}

export function StripOperativo({ percibidos, tarjeta, pagoTarjeta, currency = 'ARS' }: Props) {
  return (
    <div className="flex items-stretch">
      <div className="flex-1 flex flex-col items-center text-center px-[14px] py-1">
        <span style={{ fontSize: '9px', fontWeight: 700, color: '#90A4B0', letterSpacing: '0.07em', textTransform: 'uppercase', lineHeight: 1, marginBottom: '5px' }}>
          Percibidos
        </span>
        <span style={{ fontSize: '18px', fontWeight: 700, color: '#B84A12', letterSpacing: '-0.5px', lineHeight: 1, marginBottom: '4px' }}>
          {formatCompact(percibidos, currency)}
        </span>
        <span style={{ fontSize: '10px', color: '#4A6070', lineHeight: 1.3 }}>
          lo que salió de tu bolsillo
        </span>
      </div>

      <div style={{ width: '1px', background: 'rgba(144,164,176,0.25)', alignSelf: 'stretch' }} />

      <div className="flex-1 flex flex-col items-center text-center px-[14px] py-1">
        <span style={{ fontSize: '9px', fontWeight: 700, color: '#90A4B0', letterSpacing: '0.07em', textTransform: 'uppercase', lineHeight: 1, marginBottom: '5px' }}>
          Tarjeta
        </span>
        <span style={{ fontSize: '18px', fontWeight: 700, color: '#0D1829', letterSpacing: '-0.5px', lineHeight: 1, marginBottom: '4px' }}>
          {tarjeta > 0 ? formatCompact(tarjeta, currency) : '—'}
        </span>
        <span style={{ fontSize: '10px', color: '#4A6070', lineHeight: 1.3 }}>
          lo que cargaste a la tarjeta
        </span>
      </div>

      <div style={{ width: '1px', background: 'rgba(144,164,176,0.25)', alignSelf: 'stretch' }} />

      <div className="flex-1 flex flex-col items-center text-center px-[14px] py-1">
        <span style={{ fontSize: '9px', fontWeight: 700, color: '#90A4B0', letterSpacing: '0.07em', textTransform: 'uppercase', lineHeight: 1, marginBottom: '5px' }}>
          Pago tarjeta
        </span>
        <span style={{ fontSize: '18px', fontWeight: 700, color: '#2178A8', letterSpacing: '-0.5px', lineHeight: 1, marginBottom: '4px' }}>
          {pagoTarjeta > 0 ? formatCompact(pagoTarjeta, currency) : '—'}
        </span>
        <span style={{ fontSize: '10px', color: '#4A6070', lineHeight: 1.3 }}>
          lo que ya saldaste
        </span>
      </div>
    </div>
  )
}
