'use client'

import { Modal } from '@/components/ui/Modal'
import { Info } from '@phosphor-icons/react'
import { formatAmount } from '@/lib/format'

interface Props {
  open: boolean
  onClose: () => void
  saldoVivo: number
  gastosTarjeta: number
  currency: 'ARS' | 'USD'
  selectedMonth: string // YYYY-MM
  isProjected?: boolean
}

export function DisponibleRealSheet({ open, onClose, saldoVivo, gastosTarjeta, currency }: Props) {
  const disponibleReal = saldoVivo - gastosTarjeta

  return (
    <Modal open={open} onClose={onClose}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />

      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
        DISPONIBLE REAL
      </p>
      <p
        className={`mt-1 mb-6 text-[36px] font-extrabold leading-none tabular-nums ${disponibleReal < 0 ? 'text-danger' : 'text-primary'}`}
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

        <div className="flex items-center justify-between py-3.5">
          <span className="text-sm text-text-secondary">Lo ya registrado en tarjetas</span>
          <span className="text-sm font-semibold tabular-nums text-warning">
            −{formatAmount(gastosTarjeta, currency)}
          </span>
        </div>

        <div className="mt-1 flex items-center justify-between border-t border-border-strong pt-3.5">
          <span className="text-sm font-semibold text-text-primary">Disponible real</span>
          <span
            className={`text-[20px] font-extrabold leading-none tabular-nums ${disponibleReal < 0 ? 'text-danger' : 'text-primary'}`}
          >
            {disponibleReal < 0 ? '−' : ''}
            {formatAmount(Math.abs(disponibleReal), currency)}
          </span>
        </div>
      </div>

      <div className="mt-5 flex gap-3 rounded-[14px] bg-bg-secondary px-4 py-3.5">
        <Info size={16} weight="light" className="text-text-dim shrink-0 mt-0.5" />
        <p className="text-[12px] text-text-secondary leading-[1.55]">
          Comprometido en tarjetas te muestra lo que llevás consumido. Disponible Real te muestra cuánto de tu plata
          sigue libre hoy.
        </p>
      </div>
    </Modal>
  )
}
