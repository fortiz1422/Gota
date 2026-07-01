'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Bank,
  Bell,
  CalendarBlank,
  CaretDown,
  ChartBar,
  ChartLineUp,
  CreditCard,
  Eye,
  EyeSlash,
  Gear,
  House,
  ArrowsLeftRight,
  Sparkle,
  Target,
  Wallet,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { addMonths } from '@/lib/dates'
import { BLUE, LABEL_STYLE, MAXW, SIDEBAR_W } from './desktop-ui'

export type NavId =
  | 'inicio'
  | 'movimientos'
  | 'cuentas'
  | 'tarjetas'
  | 'presupuestos'
  | 'metas'
  | 'instrumentos'
  | 'analisis'

type CotizacionApiData = {
  rate: number
}

const NAV_MAIN: Array<{ id: NavId; label: string; icon: Icon }> = [
  { id: 'inicio', label: 'Inicio', icon: House },
  { id: 'movimientos', label: 'Movimientos', icon: ArrowsLeftRight },
  { id: 'cuentas', label: 'Cuentas', icon: Bank },
  { id: 'tarjetas', label: 'Tarjetas', icon: CreditCard },
  { id: 'presupuestos', label: 'Presupuestos', icon: Wallet },
  { id: 'metas', label: 'Metas', icon: Target },
  { id: 'instrumentos', label: 'Instrumentos', icon: ChartLineUp },
  { id: 'analisis', label: 'Análisis', icon: ChartBar },
]

// ─── Sidebar ─────────────────────────────────────────────────
export function DesktopSidebar({
  active,
  onNav,
  userName,
  avatarInitial,
  onOpenSettings,
}: {
  active: NavId
  onNav: (id: NavId) => void
  userName: string
  avatarInitial: string
  onOpenSettings: () => void
}) {
  const navBtn = (item: { id: NavId; label: string; icon: Icon }) => {
    const isActive = item.id === active
    const IconCmp = item.icon
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onNav(item.id)}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          padding: '10px 14px 10px 18px',
          borderRadius: 11,
          background: isActive ? 'rgba(33,120,168,0.10)' : 'transparent',
          border: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 14,
          fontWeight: isActive ? 700 : 500,
          color: isActive ? BLUE : '#4A6070',
          transition: 'background 140ms, color 140ms',
        }}
      >
        {isActive && (
          <span style={{ position: 'absolute', left: 0, top: 9, bottom: 9, width: 3, borderRadius: 3, background: BLUE }} />
        )}
        <IconCmp weight={isActive ? 'fill' : 'regular'} size={19} color={isActive ? BLUE : '#90A4B0'} />
        {item.label}
      </button>
    )
  }

  return (
    <aside
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: SIDEBAR_W,
        background: '#FFFFFF',
        borderRight: '1px solid rgba(33,120,168,0.10)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 60,
      }}
    >
      {/* Logo */}
      <Link
        href="/web"
        style={{ padding: '24px 24px 22px', display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}
      >
        <span style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-0.045em', color: '#0D1829' }}>
          gota<span style={{ color: BLUE }}>.</span>
        </span>
      </Link>

      {/* Main nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 12px', flex: 1, overflowY: 'auto' }}>
        <div style={{ ...LABEL_STYLE, fontSize: 10, padding: '6px 18px 8px' }}>General</div>
        {NAV_MAIN.slice(0, 4).map(navBtn)}
        <div style={{ ...LABEL_STYLE, fontSize: 10, padding: '18px 18px 8px' }}>Planificación</div>
        {NAV_MAIN.slice(4).map(navBtn)}
      </nav>

      {/* Footer: config + user */}
      <div style={{ padding: '12px', borderTop: '1px solid rgba(33,120,168,0.08)' }}>
        <button
          type="button"
          onClick={onOpenSettings}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            width: '100%',
            padding: '10px 14px 10px 18px',
            borderRadius: 11,
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 500,
            color: '#4A6070',
          }}
        >
          <Gear size={19} color="#90A4B0" />
          Configuración
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            width: '100%',
            padding: '10px 12px',
            marginTop: 4,
            borderRadius: 11,
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
            fontFamily: 'inherit',
            textAlign: 'left',
          }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 9999,
              flexShrink: 0,
              background: 'linear-gradient(135deg, #2178A8 0%, #1B7E9E 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {avatarInitial}
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0D1829', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userName}
            </span>
            <span style={{ display: 'block', fontSize: 11, color: '#90A4B0' }}>Plan Personal</span>
          </span>
        </button>
      </div>
    </aside>
  )
}

// ─── Period (month) selector ─────────────────────────────────
function formatMonthLabel(ym: string): string {
  const raw = new Date(`${ym}-15T12:00:00-03:00`).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  const normalized = raw.replace(' de ', ' ')
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function MonthSelector({ selectedMonth, onSelectMonth }: { selectedMonth: string; onSelectMonth: (month: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const current = selectedMonth.substring(0, 7)
  const months = Array.from({ length: 12 }, (_, i) => addMonths(current, -i))

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '7px 12px',
          borderRadius: 9999,
          background: open ? 'rgba(33,120,168,0.10)' : '#FFFFFF',
          border: '1px solid rgba(33,120,168,0.14)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 700,
          color: '#0D1829',
          whiteSpace: 'nowrap',
        }}
      >
        <CalendarBlank size={15} color={BLUE} />
        {formatMonthLabel(current)}
        <CaretDown weight="bold" size={11} color="#90A4B0" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 140ms' }} />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 200,
            maxHeight: 320,
            overflowY: 'auto',
            background: '#FFFFFF',
            border: '1px solid rgba(33,120,168,0.14)',
            borderRadius: 14,
            boxShadow: '0 12px 32px rgba(13,24,41,0.12)',
            padding: 6,
            zIndex: 70,
          }}
        >
          {months.map((m) => {
            const active = m === current
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setOpen(false)
                  if (m !== current) onSelectMonth(m)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 10,
                  background: active ? 'rgba(33,120,168,0.10)' : 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? BLUE : '#4A6070',
                  textAlign: 'left',
                }}
              >
                {formatMonthLabel(m)}
                {active && <span style={{ width: 6, height: 6, borderRadius: 9999, background: BLUE }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Topbar (utility bar inside main column) ─────────────────
export function DesktopTopbar({
  greeting,
  hidden,
  onToggleHidden,
  quote,
  selectedMonth,
  onSelectMonth,
}: {
  greeting: React.ReactNode
  hidden: boolean
  onToggleHidden: () => void
  quote: CotizacionApiData | null
  selectedMonth: string
  onSelectMonth: (month: string) => void
}) {
  const [val, setVal] = useState('')
  const hasText = val.trim().length > 0
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(248,251,253,0.86)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(33,120,168,0.08)',
      }}
    >
      <div style={{ maxWidth: MAXW, margin: '0 auto', padding: '0 40px', height: 64, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 14, color: '#4A6070' }}>{greeting}</div>

        {/* SmartInput */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 6px 6px 16px',
            background: '#FFFFFF',
            border: hasText ? '1px solid rgba(33,120,168,0.32)' : '1px solid rgba(33,120,168,0.12)',
            borderRadius: 9999,
            width: 300,
            transition: 'border-color 150ms',
            flexShrink: 0,
          }}
        >
          <input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="café 2500 hoy…"
            aria-label="Carga rápida con IA"
            style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontSize: 13, color: '#0D1829', fontFamily: 'inherit' }}
          />
          {!hasText && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 9999,
                background: 'rgba(33,120,168,0.08)',
                color: BLUE,
                fontSize: 11,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              <Sparkle weight="bold" size={10} />
              IA
            </span>
          )}
          <button
            type="button"
            aria-label="Enviar"
            style={{
              width: 28,
              height: 28,
              borderRadius: 9999,
              flexShrink: 0,
              background: hasText ? BLUE : 'rgba(15,30,60,0.06)',
              border: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowRight weight="bold" size={12} color={hasText ? '#fff' : '#90A4B0'} />
          </button>
        </div>

        <MonthSelector selectedMonth={selectedMonth} onSelectMonth={onSelectMonth} />

        {quote && (
          <span style={{ fontSize: 12, color: '#90A4B0', whiteSpace: 'nowrap', flexShrink: 0 }}>
            ARS · USD <span style={{ color: BLUE, fontWeight: 700 }}>{quote.rate.toLocaleString('es-AR')}</span>
          </span>
        )}

        <button
          type="button"
          onClick={onToggleHidden}
          title={hidden ? 'Mostrar montos' : 'Ocultar montos'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 12px',
            borderRadius: 9999,
            flexShrink: 0,
            background: hidden ? 'rgba(33,120,168,0.10)' : 'transparent',
            border: '1px solid rgba(33,120,168,0.14)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 12,
            fontWeight: 600,
            color: hidden ? BLUE : '#90A4B0',
          }}
        >
          {hidden ? <EyeSlash size={15} /> : <Eye size={15} />}
          {hidden ? 'Oculto' : 'Visible'}
        </button>

        <button
          type="button"
          aria-label="Notificaciones"
          style={{ position: 'relative', background: 'transparent', border: 0, cursor: 'pointer', padding: 7, display: 'flex', flexShrink: 0 }}
        >
          <Bell size={17} color="#90A4B0" />
        </button>
      </div>
    </header>
  )
}
