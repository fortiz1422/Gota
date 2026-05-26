'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CaretDown } from '@phosphor-icons/react'
import { MonthSelectorSheet } from './MonthSelectorSheet'
import { getCurrentMonth, addMonths } from '@/lib/dates'

interface Props {
  month: string
  basePath?: string
  earliestDataMonth?: string
  className?: string
  viewCurrency?: 'ARS' | 'USD'
  variant?: 'standard' | 'in-header'
}

function buildMonthList(
  current: string,
  earliestDataMonth?: string,
): { value: string; label: string }[] {
  const defaultStart = addMonths(current, -5)
  const start =
    earliestDataMonth && earliestDataMonth < defaultStart
      ? earliestDataMonth
      : defaultStart

  const months: { value: string; label: string }[] = []
  let m = addMonths(current, 3)
  while (m >= start) {
    const raw = new Date(m + '-15').toLocaleDateString('es-AR', {
      month: 'long',
      year: 'numeric',
    })
    months.push({ value: m, label: raw.charAt(0).toUpperCase() + raw.slice(1) })
    m = addMonths(m, -1)
  }
  return months
}

export function DashboardHeader({ month, basePath = '/', earliestDataMonth, className = 'px-6 pt-5', viewCurrency, variant = 'standard' }: Props) {
  const router = useRouter()
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  const current = getCurrentMonth()
  const months = buildMonthList(current, earliestDataMonth)

  const monthLong = new Date(month + '-15').toLocaleDateString('es-AR', { month: 'long' })
  const monthLongCap = monthLong.charAt(0).toUpperCase() + monthLong.slice(1)
  // Abreviar a 3 chars si el nombre supera 6 caracteres (ej: Septiembre → Sep)
  const monthCap =
    monthLongCap.length > 6 ? monthLongCap.slice(0, 3) : monthLongCap

  const handleSelectMonth = (selected: string) => {
    const params = new URLSearchParams()
    if (selected !== current) params.set('month', selected)
    if (viewCurrency && viewCurrency !== 'ARS') params.set('currency', viewCurrency)
    const query = params.toString()
    router.push(query ? `${basePath}?${query}` : basePath)
  }

  if (variant === 'in-header') {
    return (
      <>
        <button
          onClick={() => setIsSheetOpen(true)}
          className="header-glass flex items-center gap-2 rounded-pill px-3.5 py-2 transition-opacity hover:opacity-80 active:opacity-60"
        >
          <span className="text-[16px] font-extrabold tracking-[-0.01em] text-white">
            {monthCap}
          </span>
          <CaretDown size={12} weight="bold" className="shrink-0" style={{ color: 'rgba(255,255,255,0.80)' }} />
        </button>
        <MonthSelectorSheet
          isOpen={isSheetOpen}
          onClose={() => setIsSheetOpen(false)}
          selectedMonth={month}
          onSelectMonth={handleSelectMonth}
          months={months}
        />
      </>
    )
  }

  return (
    <>
      <header className={className}>
        <button
          onClick={() => setIsSheetOpen(true)}
          className="flex items-center gap-1.5 bg-transparent border-0 p-0 cursor-pointer transition-opacity duration-150 hover:opacity-70 active:opacity-50"
        >
          <span className="type-month text-text-primary">{monthCap}</span>
          <CaretDown size={16} weight="bold" className="text-text-label mt-0.5 shrink-0" />
        </button>
      </header>

      <MonthSelectorSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        selectedMonth={month}
        onSelectMonth={handleSelectMonth}
        months={months}
      />
    </>
  )
}
