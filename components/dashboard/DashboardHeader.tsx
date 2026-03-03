'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { MonthSelectorSheet } from './MonthSelectorSheet'

interface Props {
  month: string             // YYYY-MM
  basePath?: string         // default '/'
  earliestDataMonth?: string  // YYYY-MM — si hay data más vieja que 6 meses, extiende la lista
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
  // Siempre mostramos los últimos 6 meses; si hay data más vieja, extendemos hasta ahí
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
  return months // más reciente primero
}

export function DashboardHeader({ month, basePath = '/', earliestDataMonth }: Props) {
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
      <header style={{ padding: '20px 24px 0' }}>
        <button
          onClick={() => setIsSheetOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <span
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '-0.02em',
            }}
          >
            {monthCap}
          </span>
          <ChevronDown
            size={16}
            style={{ color: '#7B98B8', marginTop: 2, flexShrink: 0 }}
          />
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
