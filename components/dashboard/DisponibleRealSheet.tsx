'use client'

import { Modal } from '@/components/ui/Modal'
import { Info } from '@phosphor-icons/react'
import { formatAmount } from '@/lib/format'

interface Props {
  open: boolean
  onClose: () => void
  saldoVivo: number
  gastosTarjeta: number
  comprometidoMetas?: number
  disponibleLibre?: number
  currency: 'ARS' | 'USD'
  selectedMonth: string // YYYY-MM
  isProjected?: boolean
}

export function DisponibleRealSheet({
  open,
  onClose,
  saldoVivo,
  gastosTarjeta,
  comprometidoMetas = 0,
  disponibleLibre,
  currency,
}: Props) {
  const disponibleReal = saldoVivo - gastosTarjeta
  const libre = disponibleLibre ?? disponibleReal - comprometidoMetas

  return (
    <Modal open={open} onClose={onClose}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />

      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
        DISPONIBLE REAL
      </p>
      <p
        className={`mb-6 mt-1 text-[36px] font-extrabold leading-none tabular-nums ${disponibleReal < 0 ? 'text-danger' : 'text-primary'}`}
      >
        {disponibleReal < 0 ? '−' : ''}
        {formatAmount(Math.abs(disponibleReal), currency)}
      </p>

      <div>
        <div className="flex items-center justify-between border-b border-border-subtle py-3.5">
          <span className="text-sm text-text-secondary">Saldo Vivo</span>
          <span
            className={`text-sm font-semibold tabular-nums ${saldoVivo < 0 ? 'text-danger' : 'text-text-primary'}`}
          >
            {saldoVivo < 0 ? '−' : ''}
            {formatAmount(Math.abs(saldoVivo), currency)}
          </span>
        </div>

        <div className="flex items-center justify-between border-b border-border-subtle py-3.5">
          <span className="text-sm text-text-secondary">Lo ya registrado en tarjetas</span>
          <span className="text-sm font-semibold tabular-nums text-warning">
            −{formatAmount(gastosTarjeta, currency)}
          </span>
        </div>

        <div className="flex items-center justify-between py-3.5">
          <span className="text-sm font-semibold text-text-primary">Disponible real</span>
          <span
            className={`text-[20px] font-extrabold leading-none tabular-nums ${disponibleReal < 0 ? 'text-danger' : 'text-primary'}`}
          >
            {disponibleReal < 0 ? '−' : ''}
            {formatAmount(Math.abs(disponibleReal), currency)}
          </span>
        </div>

        <div className="flex items-center justify-between border-b border-border-subtle py-3.5">
          <div>
            <span className="text-sm text-text-secondary">Comprometido en metas</span>
            <p className="mt-1 text-[12px] text-text-tertiary">
              Decisiones de ahorro que siguen dentro de tu caja actual.
            </p>
          </div>
          <span className="text-sm font-semibold tabular-nums text-primary">
            −{formatAmount(comprometidoMetas, currency)}
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between border-t border-border-strong pt-3.5">
          <div>
            <span className="text-sm font-semibold text-text-primary">Disponible libre</span>
            <p className="mt-1 text-[12px] text-text-tertiary">
              Disponible real menos lo que ya decidiste apartar para metas.
            </p>
          </div>
          <span
            className={`text-[20px] font-extrabold leading-none tabular-nums ${libre < 0 ? 'text-danger' : 'text-primary'}`}
          >
            {libre < 0 ? '−' : ''}
            {formatAmount(Math.abs(libre), currency)}
          </span>
        </div>
      </div>

      <div className="mt-5 flex gap-3 rounded-[14px] bg-bg-secondary px-4 py-3.5">
        <Info size={16} weight="light" className="mt-0.5 shrink-0 text-text-dim" />
        <p className="text-[12px] leading-[1.55] text-text-secondary">
          Tarjetas refleja obligaciones ya causadas. Metas refleja plata que vos decidiste comprometer, sin cambiar el significado de Saldo Vivo ni Disponible real.
        </p>
      </div>
    </Modal>
  )
}
