'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { formatAmount, formatCompact } from '@/lib/format'
import { Wallet, CreditCard, ArrowsDownUp, CaretRight } from '@phosphor-icons/react'
import { DisponibleRealSheet } from './DisponibleRealSheet'
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
  const disponible = saldoInicial + data.ingresos + (data.rendimientos ?? 0) - data.gastos_percibidos - data.pago_tarjetas + transferAdjustment - capitalInstrumentos
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
    <div className="relative px-2 py-6">
      {/* Bioluminescent glow */}
      <div
        aria-hidden
        className={`absolute -top-5 -left-[30px] w-[280px] h-[200px] rounded-full pointer-events-none z-0 blur-2xl ${isNegative ? 'glow-negative' : 'glow-positive'}`}
      />

      <div className="relative z-10">
        {/* Toggle label */}
        <button
          onClick={handleToggle}
          className="flex items-center gap-1.5 mb-1.5"
        >
          <span className="type-label text-text-label uppercase">
            {mode === 'saldo_vivo' ? (isProjected ? 'SALDO INICIAL PROYECTADO' : 'SALDO VIVO') : 'DISPONIBLE REAL'}
          </span>
          <ArrowsDownUp size={13} weight="light" className="text-text-dim opacity-50" />
        </button>

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
              className={`flex items-center gap-0.5 mt-1 text-[11px] font-semibold leading-none ${displayedMode === 'disponible_real' ? 'text-primary' : 'text-text-dim'}`}
            >
              Ver detalle
              <CaretRight size={11} weight="light" />
            </button>
          )}
        </div>

        {/* Twin Pills */}
        <div className="flex gap-2.5 mt-5">
          {/* Percibidos */}
          <div className="flex-1 flex items-center gap-3 px-3.5 py-3 rounded-full"
            style={{
              background: 'rgba(255,255,255,0.38)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.70)',
            }}>
            <div className="w-[30px] h-[30px] rounded-full shrink-0 bg-primary/8 border border-border-ocean flex items-center justify-center">
              <Wallet size={13} weight="duotone" className="text-text-label" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-text-label leading-none mb-1">
                Percibidos
              </p>
              <p className="type-amount text-text-primary tabular-nums">
                {formatCompact(data.gastos_percibidos + data.pago_tarjetas, currency)}
              </p>
            </div>
          </div>

          {/* Tarjeta */}
          {gastosTarjeta > 0 && (
            <div className="flex-1 flex items-center gap-3 px-3.5 py-3 rounded-full"
            style={{
              background: 'rgba(255,255,255,0.38)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.70)',
            }}>
              <div className="w-[30px] h-[30px] rounded-full shrink-0 bg-primary/8 border border-border-ocean flex items-center justify-center">
                <CreditCard size={13} weight="duotone" className="text-text-label" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-text-label leading-none mb-1">
                  Tarjeta
                </p>
                <p className="type-amount text-text-primary tabular-nums">
                  {formatCompact(gastosTarjeta, currency)}
                </p>
              </div>
            </div>
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
