'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { formatAmount } from '@/lib/format'
import { ArrowsDownUp, CaretRight } from '@phosphor-icons/react'
import { DisponibleRealSheet } from './DisponibleRealSheet'
import { getCurrentMonth } from '@/lib/dates'
import type { DashboardData } from '@/types/database'

interface Props {
  data: DashboardData['saldo_vivo']
  currency: 'ARS' | 'USD'
  gastosTarjeta?: number
  transferAdjustment?: number
  capitalInstrumentos?: number
  onBreakdownOpen?: () => void
  selectedMonth?: string
  isProjected?: boolean
}

type HeroMode = 'saldo_vivo' | 'disponible_real'
type AnimPhase = 'idle' | 'exit' | 'pre-enter' | 'enter'

export function SaldoVivo({ data, currency, gastosTarjeta = 0, transferAdjustment = 0, capitalInstrumentos = 0, onBreakdownOpen, selectedMonth = '', isProjected = false }: Props) {
  const router = useRouter()
  const currentMonth = getCurrentMonth()
  const [mode, setMode] = useState<HeroMode>('saldo_vivo')
  const [displayedMode, setDisplayedMode] = useState<HeroMode>('saldo_vivo')
  const [animPhase, setAnimPhase] = useState<AnimPhase>('idle')
  const [sheetOpen, setSheetOpen] = useState(false)

  if (!data) {
    return (
      <div className="px-2 py-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
          Disponible
        </p>
        <p className="mt-2 text-sm text-text-tertiary">
          Configurá tu ingreso mensual para ver cuánto te queda disponible.
        </p>
      </div>
    )
  }

  const saldoInicial = (data.saldo_inicial as number | undefined) ?? 0
  const computedSaldoVivo =
    saldoInicial +
    data.ingresos +
    (data.rendimientos ?? 0) -
    data.gastos_percibidos -
    data.pago_tarjetas +
    transferAdjustment -
    capitalInstrumentos
  const disponible = computedSaldoVivo
  const disponibleReal = disponible - gastosTarjeta

  const heroValue = displayedMode === 'saldo_vivo' ? disponible : disponibleReal
  const isNegative = heroValue < 0

  const handleToggle = () => {
    const newMode = mode === 'saldo_vivo' ? 'disponible_real' : 'saldo_vivo'
    setMode(newMode)
    setAnimPhase('exit')
    setTimeout(() => {
      setDisplayedMode(newMode)
      setAnimPhase('pre-enter')
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimPhase('enter')
          setTimeout(() => setAnimPhase('idle'), 200)
        })
      })
    }, 150)
  }

  const handleHeroTap = () => {
    if (mode === 'saldo_vivo') {
      onBreakdownOpen?.()
    } else {
      setSheetOpen(true)
    }
  }

  const isTappable = mode === 'saldo_vivo' ? !!onBreakdownOpen : true

  const handleCurrencyToggle = (next: 'ARS' | 'USD') => {
    if (next === currency) return
    const params = new URLSearchParams()
    if (selectedMonth !== currentMonth) params.set('month', selectedMonth)
    if (next !== 'ARS') params.set('currency', next)
    const query = params.toString()
    router.push(query ? `/?${query}` : '/')
  }

  const heroStyle: CSSProperties = animPhase === 'exit'
    ? { opacity: 0, transform: 'translateY(-8px)', transition: 'opacity 150ms ease, transform 150ms ease' }
    : animPhase === 'pre-enter'
    ? { opacity: 0, transform: 'translateY(8px)' }
    : { opacity: 1, transform: 'translateY(0)', transition: 'opacity 200ms ease, transform 200ms ease' }

  const heroColorClass = isNegative
    ? 'text-danger'
    : displayedMode === 'disponible_real'
    ? 'text-primary'
    : 'text-text-primary'

  return (
    <div className="px-2 py-3">
      <div>
        {/* Toggle label + ARS/USD inline */}
        <div className="flex items-center justify-between mb-1.5">
          <button
            onClick={handleToggle}
            className="flex items-center gap-1.5"
          >
            <span className="type-label text-text-secondary uppercase">
              {mode === 'saldo_vivo' ? 'SALDO VIVO' : 'DISPONIBLE REAL'}
            </span>
            <ArrowsDownUp size={13} weight="light" className="text-text-dim opacity-50" />
          </button>

          <div className="flex items-center gap-2">
            {(['ARS', 'USD'] as const).map((c) => (
              <button
                key={c}
                onClick={() => handleCurrencyToggle(c)}
                className={`rounded text-[11px] font-medium transition-colors ${
                  currency === c
                    ? 'text-primary'
                    : 'text-text-dim opacity-70 hover:opacity-100'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Animated hero number + hint */}
        <div style={heroStyle}>
          <p
            onClick={isTappable ? handleHeroTap : undefined}
            className={`type-hero tabular-nums m-0 ${heroColorClass} ${isTappable ? 'cursor-pointer select-none active:opacity-70' : ''}`}
          >
            {heroValue < 0 ? '−' : ''}
            {formatAmount(Math.abs(heroValue), currency)}
          </p>

          {isTappable && (
            <button
              onClick={handleHeroTap}
              className="mt-2 flex items-center gap-0.5 text-[12px] font-semibold leading-none text-primary"
            >
              Ver detalle
              <CaretRight size={11} weight="light" />
            </button>
          )}
        </div>

      </div>

      <DisponibleRealSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        saldoVivo={disponible}
        gastosTarjeta={gastosTarjeta}
        currency={currency}
        selectedMonth={selectedMonth}
        isProjected={isProjected}
      />
    </div>
  )
}
