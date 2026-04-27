'use client'

import { ArrowCircleDown, CreditCard, Wallet } from '@phosphor-icons/react'
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

type SegmentConfig = {
  key: OrigenFilter
  label: string
  value: string
  description: string
  icon: typeof Wallet
  valueClassName: string
  iconClassName: string
  iconWrapClassName: string
  activeClassName: string
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

  const segmentClass = (segment: SegmentConfig) =>
    [
      'flex min-w-0 flex-1 flex-col items-center justify-start px-3 py-3 text-center transition-colors',
      onOrigenClick ? 'cursor-pointer active:opacity-60' : '',
      isActive(segment.key) ? segment.activeClassName : '',
    ]
      .filter(Boolean)
      .join(' ')

  const iconWrapClass = (segment: SegmentConfig) =>
    [
      'mb-2.5 flex h-10 w-10 items-center justify-center rounded-full border transition-colors',
      segment.iconWrapClassName,
      isActive(segment.key) ? 'shadow-[var(--shadow-sm)]' : '',
    ]
      .filter(Boolean)
      .join(' ')

  const segments: SegmentConfig[] = [
    {
      key: 'percibido',
      label: 'Percibidos',
      value: formatCompact(percibidos, currency),
      description: 'Salio de tu cuenta',
      icon: Wallet,
      valueClassName: 'type-amount-sm text-warning',
      iconClassName: 'text-warning',
      iconWrapClassName: 'border-warning/20 bg-warning/10',
      activeClassName: 'bg-warning/6',
    },
    {
      key: 'tarjeta',
      label: 'Tarjeta',
      value: tarjeta > 0 ? formatCompact(tarjeta, currency) : '—',
      description: 'Aun sin pagar',
      icon: CreditCard,
      valueClassName: 'type-amount-sm text-success',
      iconClassName: 'text-success',
      iconWrapClassName: 'border-success/20 bg-success/10',
      activeClassName: 'bg-success/6',
    },
    {
      key: 'pago_tarjeta',
      label: 'Pago tarjeta',
      value: pagoTarjeta > 0 ? formatCompact(pagoTarjeta, currency) : '—',
      description: 'Pagos del mes',
      icon: ArrowCircleDown,
      valueClassName: 'type-amount-sm text-primary',
      iconClassName: 'text-primary',
      iconWrapClassName: 'border-primary/20 bg-primary/10',
      activeClassName: 'bg-primary/6',
    },
  ]

  return (
    <div className="surface-module rounded-[22px] px-2 py-2">
      <div className="flex divide-x divide-[color:var(--color-separator)]">
        {segments.map((segment) => {
          const Icon = segment.icon
          return (
            <button
              key={segment.key}
              onClick={() => onOrigenClick?.(segment.key)}
              className={segmentClass(segment)}
              type="button"
            >
              <div className={iconWrapClass(segment)}>
                <Icon weight="duotone" size={21} className={segment.iconClassName} />
              </div>
              <p className={`type-label ${isActive(segment.key) ? 'text-primary' : 'text-text-secondary'}`}>
                {segment.label}
              </p>
              <p className={`mt-1 ${segment.valueClassName}`}>{segment.value}</p>
              <p className="mt-1 max-w-[84px] text-[11px] leading-[1.35] text-text-dim">
                {segment.description}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
