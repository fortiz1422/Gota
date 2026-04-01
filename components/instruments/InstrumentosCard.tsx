'use client'

import { useRouter } from 'next/navigation'
import { TrendUp, CaretRight } from '@phosphor-icons/react'
import { formatCompact } from '@/lib/format'
import type { Instrument } from '@/types/database'

interface Props {
  instruments: Instrument[]
  currency: 'ARS' | 'USD'
}

function calcDailyYield(instruments: Instrument[], currency: 'ARS' | 'USD'): number {
  return instruments
    .filter((i) => i.currency === currency && i.rate != null)
    .reduce((sum, i) => {
      // PF: TNA / 365. FCI: tasa mensual / 30 (aproximación)
      const daily =
        i.type === 'plazo_fijo'
          ? i.amount * (i.rate! / 100 / 365)
          : i.amount * (i.rate! / 100 / 30)
      return sum + daily
    }, 0)
}

export function InstrumentosCard({ instruments, currency }: Props) {
  const router = useRouter()
  const filtered = instruments.filter((i) => i.currency === currency)

  if (filtered.length === 0) return null

  const total = filtered.reduce((sum, i) => sum + i.amount, 0)
  const dailyYield = calcDailyYield(filtered, currency)

  return (
    <button
      onClick={() => router.push('/instrumentos')}
      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-card text-left active:scale-[0.99] transition-transform"
      style={{
        background: 'rgba(255,255,255,0.50)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.70)',
      }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: 'rgba(184,74,18,0.18)' }}
      >
        <TrendUp weight="duotone" size={20} className="text-warning" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-text-label leading-none mb-1">
          En instrumentos
        </p>
        <div className="flex items-baseline gap-2">
          <p className="type-amount text-text-primary tabular-nums">
            {formatCompact(total, currency)}
          </p>
          {dailyYield > 0 && (
            <p className="text-[11px] font-semibold text-success tabular-nums">
              +{formatCompact(dailyYield, currency)} hoy
            </p>
          )}
        </div>
      </div>

      <CaretRight size={16} weight="light" className="text-text-disabled shrink-0" />
    </button>
  )
}
