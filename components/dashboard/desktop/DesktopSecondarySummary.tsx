'use client'

import { ArrowRight } from '@phosphor-icons/react'
import { BLUE, CARD_STYLE, LABEL_STYLE } from './desktop-ui'
import type { NavId } from './desktop-chrome'

type Money = (n: number, currency?: 'ARS' | 'USD') => string

/** Ritmo observado del mes: solo lo percibido a hoy, sin compromisos futuros. */
export function DesktopSecondarySummary({
  ingresosMes,
  gastosMes,
  money,
  onNav,
}: {
  ingresosMes: number
  gastosMes: number
  money: Money
  onNav: (id: NavId) => void
}) {
  const resultado = ingresosMes - gastosMes
  const stats = [
    { key: 'ingresos', label: 'Ingresos del mes', value: ingresosMes > 0 ? `+${money(ingresosMes)}` : money(ingresosMes), color: ingresosMes > 0 ? '#1A7A42' : '#0D1829', note: 'lo que ya entró' },
    { key: 'gastos', label: 'Gasto percibido', value: money(gastosMes), color: '#0D1829', note: 'lo que ya salió, a hoy' },
    {
      key: 'resultado',
      label: 'Resultado',
      value: money(resultado),
      color: resultado >= 0 ? '#1A7A42' : '#B84A12',
      note: resultado >= 0 ? 'ingresos menos gastos' : 'salió más de lo que entró',
    },
  ]

  return (
    <section style={{ ...CARD_STYLE, padding: '24px 26px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={LABEL_STYLE}>Ritmo del mes</span>
          <span style={{ fontSize: 12.5, color: '#90A4B0' }}>Observado a hoy · no incluye compromisos futuros</span>
        </div>
        <button
          type="button"
          onClick={() => onNav('analisis')}
          style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: BLUE, fontFamily: 'inherit' }}
        >
          Ver análisis <ArrowRight size={11} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
        {stats.map((stat, i) => (
          <div key={stat.key} style={{ paddingLeft: i > 0 ? 24 : 0, borderLeft: i > 0 ? '1px solid rgba(33,120,168,0.08)' : 'none' }}>
            <div style={{ ...LABEL_STYLE, fontSize: 10, marginBottom: 8 }}>{stat.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em', color: stat.color, fontVariantNumeric: 'tabular-nums' }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: '#90A4B0', marginTop: 3 }}>{stat.note}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
