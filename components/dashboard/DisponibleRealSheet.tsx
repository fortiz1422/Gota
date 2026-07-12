'use client'

import { Modal } from '@/components/ui/Modal'
import { Info } from '@phosphor-icons/react'
import { formatAmount } from '@/lib/format'

interface Props {
  open: boolean
  onClose: () => void
  initialMode?: 'real' | 'libre'
  saldoVivo: number
  gastosTarjeta: number
  comprometidoMetas?: number
  disponibleLibre?: number
  currency: 'ARS' | 'USD'
  selectedMonth: string // YYYY-MM
  isProjected?: boolean
}

function amountClass(value: number, emphasized = false) {
  const size = emphasized ? 'text-[20px]' : 'text-sm'
  return `${size} shrink-0 whitespace-nowrap text-right ${emphasized ? 'font-extrabold' : 'font-semibold'} leading-none tabular-nums ${
    value < 0 ? 'text-danger' : emphasized ? 'text-primary' : 'text-text-primary'
  }`
}

function signedAmount(value: number, currency: 'ARS' | 'USD', prefix = '') {
  return `${value < 0 ? '−' : prefix}${formatAmount(Math.abs(value), currency)}`
}

export function DisponibleRealSheet({
  open,
  onClose,
  initialMode = 'real',
  saldoVivo,
  gastosTarjeta,
  comprometidoMetas = 0,
  disponibleLibre,
  currency,
}: Props) {
  const disponibleReal = saldoVivo - gastosTarjeta
  const libre = disponibleLibre ?? disponibleReal - comprometidoMetas
  const hasCommittedGoals = comprometidoMetas > 0
  const showLibre = initialMode === 'libre' && hasCommittedGoals
  const primaryValue = showLibre ? libre : disponibleReal
  const primaryTitle = showLibre ? 'Disponible libre' : 'Disponible real'
  const primaryExplanation = showLibre
    ? 'Lo que podés usar después de tarjetas y de la plata que ya apartaste para metas.'
    : 'Lo que te queda después de descontar consumos ya registrados en tarjetas.'

  return (
    <Modal open={open} onClose={onClose}>
      <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />

      <header className="mb-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-tertiary">{primaryTitle}</p>
        <p className="mt-2 max-w-[29rem] text-[14px] leading-relaxed text-text-secondary">{primaryExplanation}</p>
        <p className={`mt-5 text-[38px] font-extrabold leading-none tabular-nums ${primaryValue < 0 ? 'text-danger' : 'text-primary'}`}>
          {signedAmount(primaryValue, currency)}
        </p>
      </header>

      <section aria-label="Cómo se calcula tu disponible real">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-text-tertiary">Cómo se calcula</p>

        <div className="flex items-center justify-between gap-4 border-b border-border-subtle py-3.5">
          <span className="min-w-0 text-sm text-text-secondary">Saldo Vivo</span>
          <span className={amountClass(saldoVivo)}>{signedAmount(saldoVivo, currency)}</span>
        </div>

        <div className="flex items-center justify-between gap-4 border-b border-border-subtle py-3.5">
          <span className="min-w-0 text-sm text-text-secondary">Consumos ya registrados en tarjetas</span>
          <span className={amountClass(-gastosTarjeta)}>−{formatAmount(gastosTarjeta, currency)}</span>
        </div>

        <div className="mt-1 flex items-center justify-between gap-4 border-t border-border-strong pt-4">
          <span className="min-w-0 text-sm font-bold text-text-primary">Disponible real</span>
          <span className={amountClass(disponibleReal, true)}>{signedAmount(disponibleReal, currency)}</span>
        </div>
      </section>

      {hasCommittedGoals ? (
        <section className="mt-7" aria-label="Impacto de tus metas">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-text-tertiary">Metas</p>

          <div className="flex items-center justify-between gap-4 border-b border-border-subtle py-3.5">
            <div className="min-w-0">
              <p className="text-sm text-text-secondary">Plata apartada para metas</p>
              <p className="mt-1 text-[12px] leading-relaxed text-text-tertiary">Sigue dentro de tu caja, pero ya tiene destino.</p>
            </div>
            <span className={amountClass(-comprometidoMetas)}>−{formatAmount(comprometidoMetas, currency)}</span>
          </div>

          <div className="mt-1 flex items-center justify-between gap-4 border-t border-border-strong pt-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-text-primary">Disponible libre</p>
              <p className="mt-1 text-[12px] leading-relaxed text-text-tertiary">Lo que podés usar sin tocar metas.</p>
            </div>
            <span className={amountClass(libre, true)}>{signedAmount(libre, currency)}</span>
          </div>
        </section>
      ) : (
        <p className="mt-6 text-[13px] leading-relaxed text-text-secondary">
          No tenés metas comprometidas: hoy tu disponible libre coincide con el real.
        </p>
      )}

      <div className="mt-6 flex gap-3 border-t border-border-subtle pt-4">
        <Info size={16} weight="light" className="mt-0.5 shrink-0 text-text-dim" />
        <p className="text-[12px] leading-[1.55] text-text-secondary">
          Los consumos de tarjeta ya están descontados. Las metas no cambian tu Saldo Vivo: solo reservan parte de ese dinero.
        </p>
      </div>
    </Modal>
  )
}
