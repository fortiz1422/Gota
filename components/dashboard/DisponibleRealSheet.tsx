'use client'

import { useMemo, useState } from 'react'
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
  const [mode, setMode] = useState<'real' | 'libre'>(initialMode)

  const disponibleReal = saldoVivo - gastosTarjeta
  const libre = disponibleLibre ?? disponibleReal - comprometidoMetas
  const hasCommittedGoals = comprometidoMetas > 0
  const activeValue = mode === 'libre' ? libre : disponibleReal
  const activeTitle = mode === 'libre' ? 'DISPONIBLE LIBRE' : 'DISPONIBLE REAL'
  const activeExplanation = useMemo(() => {
    if (mode === 'libre') {
      if (!hasCommittedGoals) {
        return 'Hoy coincide con tu disponible real porque todavía no apartaste plata a metas.'
      }
      return 'Es lo que te queda después de tarjetas y también de lo que ya decidiste apartar para metas.'
    }

    return 'Es lo que te queda después de descontar obligaciones ya causadas en tarjetas.'
  }, [hasCommittedGoals, mode])

  return (
    <Modal open={open} onClose={onClose}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">{activeTitle}</p>
          <p className="mt-2 max-w-[26rem] text-[12px] leading-[1.5] text-text-secondary">{activeExplanation}</p>
        </div>

        {hasCommittedGoals ? (
          <div className="inline-flex rounded-pill border border-border-subtle bg-bg-secondary p-1">
            <button
              type="button"
              onClick={() => setMode('real')}
              className={`rounded-pill px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                mode === 'real' ? 'bg-white text-text-primary shadow-sm' : 'text-text-tertiary'
              }`}
            >
              Real
            </button>
            <button
              type="button"
              onClick={() => setMode('libre')}
              className={`rounded-pill px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                mode === 'libre' ? 'bg-white text-text-primary shadow-sm' : 'text-text-tertiary'
              }`}
            >
              Libre
            </button>
          </div>
        ) : null}
      </div>

      <p
        className={`mb-6 mt-3 text-[36px] font-extrabold leading-none tabular-nums ${activeValue < 0 ? 'text-danger' : 'text-primary'}`}
      >
        {activeValue < 0 ? '−' : ''}
        {formatAmount(Math.abs(activeValue), currency)}
      </p>

      <div>
        <div className="flex items-center justify-between border-b border-border-subtle py-3.5">
          <span className="text-sm text-text-secondary">Saldo Vivo</span>
          <span className={`text-sm font-semibold tabular-nums ${saldoVivo < 0 ? 'text-danger' : 'text-text-primary'}`}>
            {saldoVivo < 0 ? '−' : ''}
            {formatAmount(Math.abs(saldoVivo), currency)}
          </span>
        </div>

        <div className="flex items-center justify-between border-b border-border-subtle py-3.5">
          <span className="text-sm text-text-secondary">Lo ya registrado en tarjetas</span>
          <span className="text-sm font-semibold tabular-nums text-warning">−{formatAmount(gastosTarjeta, currency)}</span>
        </div>

        <div
          className={`flex items-center justify-between py-3.5 ${mode === 'real' ? 'rounded-card bg-primary/5 px-3 -mx-3' : ''}`}
        >
          <div>
            <span className="text-sm font-semibold text-text-primary">Disponible real</span>
            {mode === 'real' ? (
              <p className="mt-1 text-[12px] text-text-tertiary">Base operativa para mirar qué podés usar hoy.</p>
            ) : null}
          </div>
          <span className={`text-[20px] font-extrabold leading-none tabular-nums ${disponibleReal < 0 ? 'text-danger' : 'text-primary'}`}>
            {disponibleReal < 0 ? '−' : ''}
            {formatAmount(Math.abs(disponibleReal), currency)}
          </span>
        </div>

        <div className="flex items-center justify-between border-b border-border-subtle py-3.5">
          <div>
            <span className="text-sm text-text-secondary">Comprometido en metas</span>
            <p className="mt-1 text-[12px] text-text-tertiary">Decisiones de ahorro que siguen dentro de tu caja actual.</p>
          </div>
          <span className="text-sm font-semibold tabular-nums text-primary">−{formatAmount(comprometidoMetas, currency)}</span>
        </div>

        <div
          className={`mt-1 flex items-center justify-between border-t border-border-strong pt-3.5 ${mode === 'libre' ? 'rounded-card bg-primary/5 px-3 pb-3 -mx-3' : ''}`}
        >
          <div>
            <span className="text-sm font-semibold text-text-primary">Disponible libre</span>
            <p className="mt-1 text-[12px] text-text-tertiary">
              {!hasCommittedGoals
                ? 'Hoy coincide con el real porque todavía no comprometiste metas.'
                : 'Disponible real menos lo que ya decidiste apartar para metas.'}
            </p>
          </div>
          <span className={`text-[20px] font-extrabold leading-none tabular-nums ${libre < 0 ? 'text-danger' : 'text-primary'}`}>
            {libre < 0 ? '−' : ''}
            {formatAmount(Math.abs(libre), currency)}
          </span>
        </div>
      </div>

      <div className="mt-5 flex gap-3 rounded-[14px] bg-bg-secondary px-4 py-3.5">
        <Info size={16} weight="light" className="mt-0.5 shrink-0 text-text-dim" />
        <p className="text-[12px] leading-[1.55] text-text-secondary">
          Tarjetas refleja obligaciones ya causadas. Metas refleja plata que vos decidiste comprometer, sin cambiar el significado de Saldo Vivo.
        </p>
      </div>
    </Modal>
  )
}
