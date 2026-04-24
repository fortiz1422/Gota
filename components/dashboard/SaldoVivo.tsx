'use client'

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { CaretRight, Eye, EyeSlash } from '@phosphor-icons/react'
import { formatAmount } from '@/lib/format'
import { DisponibleRealSheet } from './DisponibleRealSheet'
import type { DashboardData, HeroBalanceMode } from '@/types/database'

interface Props {
  data: DashboardData['saldo_vivo']
  currency: 'ARS' | 'USD'
  heroBalanceMode: HeroBalanceMode
  heroBreakdown: Record<'ARS' | 'USD', number>
  availableBreakdown: Record<'ARS' | 'USD', number>
  valuationRate?: number | null
  valuationDate?: string | null
  gastosTarjeta?: number
  transferAdjustment?: number
  capitalInstrumentos?: number
  onBreakdownOpen?: () => void
  selectedMonth?: string
  isProjected?: boolean
  amountsVisible: boolean
  onToggleAmounts: () => void
}

function maskAmount(currency: 'ARS' | 'USD') {
  return currency === 'USD' ? 'USD ****' : '$ ******'
}

function breakdownLine(amountsVisible: boolean, heroBreakdown: Record<'ARS' | 'USD', number>) {
  if (!amountsVisible) {
    return {
      ars: maskAmount('ARS'),
      usd: maskAmount('USD'),
    }
  }

  return {
    ars: formatAmount(heroBreakdown.ARS, 'ARS').replace(/^\$\s*/, ''),
    usd: formatAmount(heroBreakdown.USD, 'USD').replace(/^USD\s*/, ''),
  }
}

function resolveHeroValues({
  mode,
  defaultCurrency,
  heroBreakdown,
  availableBreakdown,
  rate,
}: {
  mode: HeroBalanceMode
  defaultCurrency: 'ARS' | 'USD'
  heroBreakdown: Record<'ARS' | 'USD', number>
  availableBreakdown: Record<'ARS' | 'USD', number>
  rate: number | null
}) {
  if (mode === 'combined_ars' && rate && rate > 0) {
    return {
      displayCurrency: 'ARS' as const,
      heroValue: heroBreakdown.ARS + heroBreakdown.USD * rate,
      availableValue: availableBreakdown.ARS + availableBreakdown.USD * rate,
    }
  }

  if (mode === 'combined_usd' && rate && rate > 0) {
    return {
      displayCurrency: 'USD' as const,
      heroValue: heroBreakdown.USD + heroBreakdown.ARS / rate,
      availableValue: availableBreakdown.USD + availableBreakdown.ARS / rate,
    }
  }

  const resolvedCurrency = defaultCurrency
  return {
    displayCurrency: resolvedCurrency,
    heroValue: heroBreakdown[resolvedCurrency],
    availableValue: availableBreakdown[resolvedCurrency],
  }
}

export function SaldoVivo({
  data,
  currency,
  heroBalanceMode,
  heroBreakdown,
  availableBreakdown,
  valuationRate = null,
  onBreakdownOpen,
  selectedMonth = '',
  isProjected = false,
  amountsVisible,
  onToggleAmounts,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false)

  if (!data) {
    return (
      <div className="px-1 py-2">
        <p className="type-label text-text-secondary">Saldo Vivo</p>
        <p className="mt-3 text-[28px] font-extrabold tracking-[-0.03em] text-text-primary">
          $ ******
        </p>
        <p className="mt-3 max-w-[24rem] text-sm text-text-secondary">
          Configura una cuenta y tu saldo inicial para ver el estado financiero del mes.
        </p>
      </div>
    )
  }

  const { displayCurrency, heroValue, availableValue } = resolveHeroValues({
    mode: heroBalanceMode,
    defaultCurrency: currency,
    heroBreakdown,
    availableBreakdown,
    rate: valuationRate,
  })

  const isNegative = heroValue < 0
  const heroStyle: CSSProperties = {
    transition: 'opacity 180ms ease, transform 180ms ease',
  }
  const availableDebt = Math.max(0, heroValue - availableValue)
  const showValuationFallback =
    (heroBalanceMode === 'combined_ars' || heroBalanceMode === 'combined_usd') &&
    (!valuationRate || valuationRate <= 0)
  const breakdown = breakdownLine(amountsVisible, heroBreakdown)

  return (
    <div className="px-1 py-2">
      <div className="flex items-center justify-between">
        <span className="type-label text-text-secondary">Saldo Vivo</span>
        <button
          type="button"
          onClick={onToggleAmounts}
          aria-label={amountsVisible ? 'Ocultar montos' : 'Mostrar montos'}
          className="flex h-8 w-8 items-center justify-center rounded-full text-text-dim transition-colors hover:bg-bg-secondary hover:text-text-secondary"
        >
          {amountsVisible ? (
            <Eye size={16} weight="regular" />
          ) : (
            <EyeSlash size={16} weight="regular" />
          )}
        </button>
      </div>

      <button
        type="button"
        onClick={onBreakdownOpen}
        disabled={!onBreakdownOpen}
        className={`mt-3 block text-left ${onBreakdownOpen ? 'cursor-pointer active:opacity-80' : ''}`}
      >
        <p
          className={`type-hero m-0 tabular-nums ${isNegative ? 'text-danger' : 'text-text-primary'}`}
          style={heroStyle}
        >
          {amountsVisible
            ? `${heroValue < 0 ? '−' : ''}${formatAmount(Math.abs(heroValue), displayCurrency)}`
            : maskAmount(displayCurrency)}
        </p>
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 type-meta">
        <span className="text-text-dim">
          <span className="font-semibold text-primary">ARS</span>{' '}
          <span>{breakdown.ars}</span>
        </span>
        <span className="text-text-dim">|</span>
        <span className="text-text-dim">
          <span className="font-semibold text-primary">USD</span>{' '}
          <span>{breakdown.usd}</span>
        </span>
      </div>

      {showValuationFallback && (
        <p className="mt-1 type-meta text-text-dim">
          Sin cotizacion disponible. Se muestra tu moneda principal.
        </p>
      )}

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="mt-5 flex w-full items-start justify-between gap-3 border-t border-[color:var(--color-separator)] pt-4 text-left transition-opacity hover:opacity-90"
      >
        <div>
          <p className="type-body text-text-secondary">Disponible real</p>
          <p className="mt-1 type-meta text-text-dim">
            Ya descuenta deuda y consumos en tarjeta.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="type-body-lg tabular-nums text-text-primary">
            {amountsVisible ? formatAmount(availableValue, displayCurrency) : maskAmount(displayCurrency)}
          </span>
          <CaretRight size={13} weight="bold" className="mt-0.5 text-text-dim" />
        </div>
      </button>

      <DisponibleRealSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        saldoVivo={heroValue}
        gastosTarjeta={availableDebt}
        currency={displayCurrency}
        selectedMonth={selectedMonth}
        isProjected={isProjected}
      />
    </div>
  )
}
