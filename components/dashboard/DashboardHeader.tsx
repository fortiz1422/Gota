'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CaretDown } from '@phosphor-icons/react'
import { MonthSelectorSheet } from './MonthSelectorSheet'

interface Props {
  month: string
  basePath?: string
  earliestDataMonth?: string
  className?: string
}

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
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
  let m = current
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

export function DashboardHeader({ month, basePath = '/', earliestDataMonth, className = 'px-6 pt-5' }: Props) {
  const router = useRouter()
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  const current = getCurrentMonth()
  const months = buildMonthList(current, earliestDataMonth)

  const monthName = new Date(month + '-15').toLocaleDateString('es-AR', { month: 'long' })
  const monthCap = monthName.charAt(0).toUpperCase() + monthName.slice(1)

  const handleSelectMonth = (selected: string) => {
    router.push(selected === current ? basePath : `${basePath}?month=${selected}`)
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
