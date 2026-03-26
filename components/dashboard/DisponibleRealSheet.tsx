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
}

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

export function DisponibleRealSheet({ open, onClose, saldoVivo, gastosTarjeta, currency, selectedMonth }: Props) {
  const monthName = MESES[parseInt(selectedMonth.split('-')[1], 10) - 1] ?? ''
  const disponibleReal = saldoVivo - gastosTarjeta

  return (
    <Modal open={open} onClose={onClose}>
      {/* Handle */}
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />

      {/* Header */}
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
        DISPONIBLE REAL · {monthName}
      </p>
      <p className={`mt-1 mb-6 text-[36px] font-extrabold leading-none tabular-nums ${disponibleReal < 0 ? 'text-danger' : 'text-primary'}`}>
        {disponibleReal < 0 ? '−' : ''}
        {formatAmount(Math.abs(disponibleReal), currency)}
      </p>

      {/* Rows */}
      <div>
        <div className="flex items-center justify-between py-3.5 border-b border-border-subtle">
          <span className="text-sm text-text-secondary">Saldo Vivo</span>
          <span className={`text-sm font-semibold tabular-nums ${saldoVivo < 0 ? 'text-danger' : 'text-text-primary'}`}>
            {saldoVivo < 0 ? '−' : ''}{formatAmount(Math.abs(saldoVivo), currency)}
          </span>
        </div>

        <div className="flex items-center justify-between py-3.5">
          <span className="text-sm text-text-secondary">Comprometido en tarjeta</span>
          <span className="text-sm font-semibold tabular-nums text-warning">
            −{formatAmount(gastosTarjeta, currency)}
          </span>
        </div>

        {/* Total */}
        <div className="mt-1 flex items-center justify-between border-t border-border-strong pt-3.5">
          <span className="text-sm font-semibold text-text-primary">Disponible real</span>
          <span className={`text-[20px] font-extrabold leading-none tabular-nums ${disponibleReal < 0 ? 'text-danger' : 'text-primary'}`}>
            {disponibleReal < 0 ? '−' : ''}{formatAmount(Math.abs(disponibleReal), currency)}
          </span>
        </div>
      </div>

      {/* Nota */}
      <div className="mt-5 flex gap-3 rounded-[14px] bg-bg-secondary px-4 py-3.5">
        <Info size={16} weight="light" className="text-text-dim shrink-0 mt-0.5" />
        <p className="text-[12px] text-text-secondary leading-[1.55]">
          El Disponible Real descuenta lo que ya gastaste con tarjeta este mes pero todavía no salió de tu cuenta. Es lo que podés usar sin sorpresas cuando llegue el resumen.
        </p>
      </div>
    </Modal>
  )
}
