'use client'

import type { CSSProperties } from 'react'
import { Plus } from '@phosphor-icons/react'
import { formatAmount } from '@/lib/format'
import { CategoryIcon, getCategoryColors } from '@/components/ui/CategoryIcon'

// ─── Design tokens (Zona Azul) ───────────────────────────────
export const BLUE = '#2178A8'

// ─── Layout constants (control room) ─────────────────────────
export const MAXW = 1520

export const CARD_STYLE: CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid rgba(33,120,168,0.08)',
  borderRadius: 18,
  boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
}

export const LABEL_STYLE: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
  color: '#90A4B0',
}

export function currencySymbol(currency: 'ARS' | 'USD') {
  return currency === 'USD' ? 'US$' : '$'
}

export function maskAmount(currency: 'ARS' | 'USD') {
  return currency === 'USD' ? 'USD ****' : '$ ******'
}

/** Money formatter honouring the eye-toggle. */
export function fmtMoney(n: number, currency: 'ARS' | 'USD', hidden: boolean) {
  return hidden ? maskAmount(currency) : formatAmount(n, currency)
}

export const monthName = (month: string) =>
  new Date(`${month}-15T12:00:00-03:00`).toLocaleDateString('es-AR', { month: 'long' })

// ─── Small category square (movimientos / presupuesto / análisis) ──
export function CatSquare({
  category,
  size = 36,
  iconSize = 18,
}: {
  category: string
  size?: number
  iconSize?: number
}) {
  const { colorSoft } = getCategoryColors(category)
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        background: colorSoft,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <CategoryIcon category={category} size={iconSize} />
    </div>
  )
}

// ─── Semantic badge ──────────────────────────────────────────
export function Badge({ tone = 'success', children }: { tone?: 'success' | 'warning' | 'danger' | 'primary' | 'neutral'; children: React.ReactNode }) {
  const tones: Record<string, { bg: string; fg: string }> = {
    success: { bg: 'rgba(26,122,66,0.10)', fg: '#1A7A42' },
    warning: { bg: 'rgba(184,74,18,0.10)', fg: '#B84A12' },
    danger: { bg: 'rgba(166,30,30,0.09)', fg: '#A61E1E' },
    primary: { bg: 'rgba(33,120,168,0.09)', fg: BLUE },
    neutral: { bg: 'rgba(74,96,112,0.10)', fg: '#4A6070' },
  }
  const t = tones[tone] ?? tones.success
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 9999, background: t.bg, color: t.fg, fontSize: 11, fontWeight: 600 }}>
      {children}
    </span>
  )
}

// ─── Page header (non-Panel sections) ────────────────────────
export function PageHeader({
  title,
  sub,
  action,
  onAction,
}: {
  title: string
  sub?: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 27, fontWeight: 700, letterSpacing: '-0.03em', color: '#0D1829' }}>{title}</h1>
        {sub && <p style={{ margin: '8px 0 0', fontSize: 14, color: '#90A4B0' }}>{sub}</p>}
      </div>
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '10px 18px',
            borderRadius: 9999,
            background: BLUE,
            border: 0,
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Plus weight="bold" size={13} />
          {action}
        </button>
      )}
    </div>
  )
}
