'use client'

import { useEffect, useRef, useState } from 'react'
import { CalendarBlank, CaretDown, Eye, EyeSlash } from '@phosphor-icons/react'
import { addMonths } from '@/lib/dates'
import { BLUE, MAXW } from './desktop-ui'

export type NavId =
  | 'inicio'
  | 'movimientos'
  | 'tarjetas'
  | 'presupuestos'
  | 'metas'
  | 'instrumentos'
  | 'analisis'

type CotizacionApiData = {
  rate: number
}

const NAV_ITEMS: Array<{ id: NavId; label: string }> = [
  { id: 'inicio', label: 'Panel' },
  { id: 'movimientos', label: 'Movimientos' },
  { id: 'tarjetas', label: 'Tarjetas' },
  { id: 'presupuestos', label: 'Presupuestos' },
  { id: 'metas', label: 'Metas' },
  { id: 'instrumentos', label: 'Instrumentos' },
  { id: 'analisis', label: 'Análisis' },
]

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
          background: open ? 'rgba(255,255,255,0.26)' : 'rgba(255,255,255,0.14)',
          border: '1px solid rgba(255,255,255,0.24)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 700,
          color: '#FFFFFF',
          whiteSpace: 'nowrap',
        }}
      >
        <CalendarBlank size={15} color="rgba(255,255,255,0.85)" />
        {formatMonthLabel(current)}
        <CaretDown weight="bold" size={11} color="rgba(255,255,255,0.65)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 140ms' }} />
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

// ─── Topnav: wordmark + navegación + contexto (mes, USD, ojo, avatar) ──
// Se renderiza sobre la blue-zone (S5): texto blanco y pills header-glass.
export function DesktopTopnav({
  active,
  onNav,
  hidden,
  onToggleHidden,
  quote,
  selectedMonth,
  onSelectMonth,
  avatarInitial,
  onOpenSettings,
}: {
  active: NavId
  onNav: (id: NavId) => void
  hidden: boolean
  onToggleHidden: () => void
  quote: CotizacionApiData | null
  selectedMonth: string
  onSelectMonth: (month: string) => void
  avatarInitial: string
  onOpenSettings: () => void
}) {
  return (
    <header>
      <style>{`
        @media (max-width: 1320px) { .topnav-quote { display: none !important; } }
        @media (max-width: 1180px) { .topnav-nav { gap: 0 !important; } .topnav-nav button { padding: 0 8px !important; } }
      `}</style>
      <div style={{ maxWidth: MAXW, margin: '0 auto', padding: '0 40px', height: 64, display: 'flex', alignItems: 'stretch', gap: 24 }}>
        <button
          type="button"
          onClick={() => onNav('inicio')}
          style={{ display: 'flex', alignItems: 'center', background: 'transparent', border: 0, cursor: 'pointer', padding: 0, fontFamily: 'inherit', flexShrink: 0 }}
        >
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.045em', color: '#FFFFFF' }}>
            gota<span style={{ color: 'rgba(255,255,255,0.55)' }}>.</span>
          </span>
        </button>

        <nav className="topnav-nav" style={{ display: 'flex', alignItems: 'stretch', gap: 4, minWidth: 0, overflowX: 'auto' }}>
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === active
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNav(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 11px',
                  background: 'transparent',
                  border: 0,
                  borderBottom: isActive ? '2px solid #FFFFFF' : '2px solid transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 13.5,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.72)',
                  whiteSpace: 'nowrap',
                  transition: 'color 140ms',
                }}
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <MonthSelector selectedMonth={selectedMonth} onSelectMonth={onSelectMonth} />

          {quote && (
            <span className="topnav-quote" style={{ fontSize: 12, color: 'rgba(255,255,255,0.68)', whiteSpace: 'nowrap' }}>
              USD oficial <span style={{ color: '#FFFFFF', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{quote.rate.toLocaleString('es-AR')}</span>
            </span>
          )}

          <button
            type="button"
            onClick={onToggleHidden}
            aria-label={hidden ? 'Mostrar montos' : 'Ocultar montos'}
            title={hidden ? 'Mostrar montos' : 'Ocultar montos'}
            style={{
              width: 34,
              height: 34,
              borderRadius: 9999,
              background: hidden ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.24)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: hidden ? '#FFFFFF' : 'rgba(255,255,255,0.82)',
            }}
          >
            {hidden ? <EyeSlash size={16} /> : <Eye size={16} />}
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Configuración"
            title="Configuración"
            style={{
              width: 34,
              height: 34,
              borderRadius: 9999,
              flexShrink: 0,
              background: 'rgba(255,255,255,0.16)',
              border: '1px solid rgba(255,255,255,0.34)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: 'inherit',
            }}
          >
            {avatarInitial}
          </button>
        </div>
      </div>
    </header>
  )
}
