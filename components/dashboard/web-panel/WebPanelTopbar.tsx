'use client'

import Link from 'next/link'
import type { RefObject } from 'react'
import { Bell, Eye, EyeSlash, Gear, Plus } from '@phosphor-icons/react'
import { addMonths } from '@/lib/dates'
import type { SignalBellTone } from '@/lib/intelligence/signal-center'

const NAV = [
  { label: 'Panel', href: '/web' },
  { label: 'Movimientos', href: '/movimientos' },
  { label: 'Análisis', href: '/analytics' },
  { label: 'Planificar', href: '/analytics?view=budget' },
  { label: 'Compromisos', href: '/analytics?drill=compromisos' },
  { label: 'Patrimonio', href: '/web/settings' },
]

const DOT: Record<Exclude<SignalBellTone, 'none'>, string> = {
  new: '#1B7E9E',
  watch: '#B84A12',
  risk: '#A61E1E',
}

function monthLabel(month: string) {
  const label = new Date(`${month}-15T12:00:00-03:00`).toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })
  const normalized = label.replace(' de ', ' ')
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function WebPanelTopbar({
  selectedMonth,
  quote,
  hidden,
  signalTone,
  avatarInitial,
  signalsButtonRef,
  onSelectMonth,
  onToggleHidden,
  onOpenSignals,
  onOpenSettings,
}: {
  selectedMonth: string
  quote: { rate: number } | null
  hidden: boolean
  signalTone: SignalBellTone
  avatarInitial: string
  signalsButtonRef: RefObject<HTMLButtonElement | null>
  onSelectMonth: (month: string) => void
  onToggleHidden: () => void
  onOpenSignals: () => void
  onOpenSettings: () => void
}) {
  const months = Array.from({ length: 12 }, (_, index) => addMonths(selectedMonth, -index))

  return (
    <header className="sticky top-0 z-40 h-[66px] border-b border-[rgba(33,120,168,.10)] bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-full max-w-[1500px] items-center gap-6 px-6 xl:px-10">
        <Link href="/web" className="shrink-0 text-[23px] font-extrabold tracking-[-.055em] text-primary no-underline">
          gota<span className="text-[#91BDCF]">.</span>
        </Link>
        <nav className="hidden h-full min-w-0 items-stretch lg:flex">
          {NAV.map((item, index) => (
            <Link
              key={item.label}
              href={item.href}
              className={`relative flex items-center px-2.5 text-[12.5px] font-semibold no-underline transition-colors ${index === 0 ? 'text-text-primary after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:bg-primary' : 'text-text-secondary hover:text-text-primary'}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <select
            aria-label="Período"
            value={selectedMonth}
            onChange={(event) => onSelectMonth(event.target.value)}
            className="hidden h-9 rounded-[9px] border border-[rgba(33,120,168,.12)] bg-white px-3 text-xs font-bold text-text-primary sm:block"
          >
            {months.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}
          </select>
          {quote && (
            <span className="hidden whitespace-nowrap text-[11px] text-text-tertiary 2xl:block">
              USD oficial <b className="font-bold text-text-secondary tabular-nums">${quote.rate.toLocaleString('es-AR')}</b>
            </span>
          )}
          <Link
            href="/"
            className="hidden h-9 items-center gap-1.5 rounded-[9px] bg-primary px-3 text-xs font-bold text-white no-underline sm:flex"
          >
            <Plus size={14} /> Registrar
          </Link>
          <button
            type="button"
            onClick={onToggleHidden}
            aria-label={hidden ? 'Mostrar montos' : 'Ocultar montos'}
            className="grid h-9 w-9 place-items-center rounded-[9px] border border-[rgba(33,120,168,.12)] bg-white text-text-secondary"
          >
            {hidden ? <EyeSlash size={17} /> : <Eye size={17} />}
          </button>
          <button
            ref={signalsButtonRef}
            type="button"
            onClick={onOpenSignals}
            aria-label={signalTone === 'none' ? 'Abrir Señales' : 'Abrir Señales, hay novedades'}
            className="relative grid h-9 w-9 place-items-center rounded-[9px] border border-[rgba(33,120,168,.12)] bg-white text-text-secondary"
          >
            <Bell size={17} />
            {signalTone !== 'none' && (
              <span
                aria-hidden="true"
                className="absolute right-[6px] top-[6px] h-[7px] w-[7px] rounded-full ring-2 ring-white"
                style={{ background: DOT[signalTone] }}
              />
            )}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Configuración"
            className="hidden h-9 w-9 place-items-center rounded-[9px] border border-[rgba(33,120,168,.12)] bg-white text-text-secondary sm:grid"
          >
            <Gear size={17} />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Perfil"
            className="grid h-9 w-9 place-items-center rounded-full bg-bg-tertiary text-xs font-extrabold text-primary"
          >
            {avatarInitial}
          </button>
        </div>
      </div>
    </header>
  )
}
