// THROWAWAY — primitivas compartidas para mockups de exploración
import type { CSSProperties, ReactNode } from 'react'

export const MOCK_BALANCE = '$1.240.500'
export const MOCK_BALANCE_USD = 'USD 1.240'
export const MOCK_DISPONIBLE = '$980.200'
export const MOCK_COMPROMISOS = '$260.300'

export const MOCK_MOVEMENTS = [
  { label: 'Mercado Libre', cat: 'Compras', amount: '−$18.400', date: 'Hoy', color: '#B84A12' },
  { label: 'Sueldo Mayo', cat: 'Ingreso', amount: '+$850.000', date: 'Ayer', color: '#1A7A42' },
  { label: 'UberEats', cat: 'Delivery', amount: '−$9.200', date: 'Ayer', color: '#B84A12' },
  { label: 'Transf. Naranja', cat: 'Tarjeta', amount: '−$35.000', date: 'Mié', color: '#2178A8' },
]

interface PhoneFrameProps {
  label: string
  tag: string
  tagColor: string
  children: ReactNode
  accentColor?: string
}

export function PhoneFrame({ label, tag, tagColor, children }: PhoneFrameProps) {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <span
          style={{
            display: 'inline-block',
            background: tagColor,
            color: '#fff',
            borderRadius: 6,
            padding: '3px 10px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          {tag}
        </span>
        <p
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: '#1A2B3C',
          }}
        >
          {label}
        </p>
      </div>

      {/* Phone shell */}
      <div
        style={{
          width: '100%',
          maxWidth: 375,
          margin: '0 auto',
          borderRadius: 44,
          background: '#111',
          padding: '8px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.30), 0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        {/* Dynamic Island */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            paddingTop: 10,
            paddingBottom: 4,
          }}
        >
          <div
            style={{
              width: 120,
              height: 34,
              borderRadius: 20,
              background: '#000',
            }}
          />
        </div>
        {/* Screen */}
        <div
          style={{
            borderRadius: 36,
            overflow: 'hidden',
            background: '#FFFFFF',
            position: 'relative',
            minHeight: 720,
          }}
        >
          {children}
        </div>
        {/* Home indicator */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            paddingTop: 6,
            paddingBottom: 8,
          }}
        >
          <div
            style={{ width: 120, height: 4, borderRadius: 2, background: '#444' }}
          />
        </div>
      </div>
    </div>
  )
}

export const tokens = {
  bgPrimary: '#FFFFFF',
  bgSecondary: '#F8FBFD',
  bgTertiary: '#EEF4F8',
  primary: '#2178A8',
  primarySoft: 'rgba(33,120,168,0.09)',
  success: '#1A7A42',
  successSoft: 'rgba(26,122,66,0.10)',
  warning: '#B84A12',
  warningSoft: 'rgba(184,74,18,0.10)',
  textPrimary: '#0D1829',
  textSecondary: '#4A6070',
  textDim: '#5C7A8A',
  separator: 'rgba(33,120,168,0.07)',
  navBg: 'rgba(255,255,255,0.97)',
}

export function Avatar({ size = 34 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: tokens.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: size * 0.38,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      F
    </div>
  )
}

export function PlusBtn({ size = 34 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: tokens.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: size * 0.5,
        fontWeight: 300,
        flexShrink: 0,
      }}
    >
      +
    </div>
  )
}

export function CategoryDot({ color }: { color: string }) {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: color + '18',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
        }}
      />
    </div>
  )
}
