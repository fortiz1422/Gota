'use client'

import { ArrowRight } from '@phosphor-icons/react'
import type { CompromisosData } from '@/lib/analytics/computeCompromisos'
import { BLUE, CARD_STYLE, LABEL_STYLE } from './desktop-ui'
import type { NavId } from './desktop-chrome'
import type { DesktopHeroStats } from './desktop-dashboard-model'

type Money = (n: number, currency?: 'ARS' | 'USD') => string

/** Explica la brecha entre Saldo Vivo y Disponible Real con el mismo total del hero. */
export function DesktopCommitmentsPanel({
  stats,
  compromisos,
  money,
  onNav,
}: {
  stats: DesktopHeroStats
  compromisos: CompromisosData | null
  money: Money
  onNav: (id: NavId) => void
}) {
  const hasGap = stats.brecha > 0.5
  const hasDetail = compromisos !== null

  const rows = hasDetail
    ? [
        {
          key: 'pagar',
          label: 'Resúmenes por pagar',
          sub: 'Ciclos ya cerrados, con vencimiento por delante.',
          amount: stats.compromisosProximos,
          color: BLUE,
        },
        {
          key: 'curso',
          label: 'Tarjeta en curso',
          sub: 'Consumos del ciclo actual, todavía sin cerrar.',
          amount: stats.tarjetaEnCurso,
          color: '#1B7E9E',
        },
        {
          key: 'resto',
          label: 'Otros consumos de tarjeta',
          sub: 'Sin ciclo asignado todavía.',
          amount: stats.reservas,
          color: '#90A4B0',
        },
      ].filter((row) => row.amount > 0.5)
    : []

  const rowsTotal = rows.reduce((sum, row) => sum + row.amount, 0)
  const detailMismatch = hasDetail && hasGap && Math.abs(rowsTotal - stats.brecha) > Math.max(1, stats.brecha * 0.01)

  const pendingSubsTotal =
    compromisos?.tarjetas.reduce(
      (sum, card) => sum + card.pendingSubs.reduce((subSum, sub) => subSum + sub.amount, 0),
      0,
    ) ?? 0

  return (
    <div style={{ ...CARD_STYLE, padding: '24px 26px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={LABEL_STYLE}>Ya tiene destino</span>
        <button
          type="button"
          onClick={() => onNav('tarjetas')}
          style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: BLUE, fontFamily: 'inherit' }}
        >
          Ver tarjetas <ArrowRight size={11} />
        </button>
      </div>

      {!hasGap ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0D1829' }}>Hoy no hay plata comprometida.</p>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#4A6070', lineHeight: 1.55 }}>
            Tu Saldo Vivo y tu Disponible Real son lo mismo: no tenés consumos de tarjeta pendientes.
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.035em', color: '#0D1829', fontVariantNumeric: 'tabular-nums' }}>
              {money(stats.brecha)}
            </span>
            <span style={{ fontSize: 13, color: '#90A4B0' }}>separado de tu Disponible Real</span>
          </div>
          <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#4A6070', lineHeight: 1.5 }}>
            Es la diferencia entre tu Saldo Vivo y lo que podés usar hoy.
          </p>

          {rows.length > 0 && (
            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2, marginBottom: 6, background: 'rgba(33,120,168,0.06)' }}>
              {rows.map((row) => (
                <div key={row.key} style={{ flex: row.amount / rowsTotal, background: row.color }} />
              ))}
            </div>
          )}

          {!hasDetail ? (
            <p style={{ margin: '10px 0 0', fontSize: 13, color: '#4A6070', lineHeight: 1.55 }}>
              El detalle por tarjeta todavía no está disponible.
            </p>
          ) : (
            <div>
              {rows.map((row, i) => (
                <div key={row.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 0', borderBottom: i < rows.length - 1 ? '1px solid rgba(33,120,168,0.07)' : 'none' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 9999, flexShrink: 0, marginTop: 5, background: row.color }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0D1829' }}>{row.label}</div>
                    <div style={{ fontSize: 11.5, color: '#90A4B0', marginTop: 2 }}>{row.sub}</div>
                  </div>
                  <span style={{ fontSize: 14.5, fontWeight: 700, color: '#0D1829', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {money(row.amount)}
                  </span>
                </div>
              ))}
              {detailMismatch && (
                <p style={{ margin: '10px 0 0', fontSize: 11, color: '#90A4B0', lineHeight: 1.5 }}>
                  El detalle por tarjeta puede diferir levemente del total.
                </p>
              )}
            </div>
          )}

          {pendingSubsTotal > 0.5 && (
            <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px dashed rgba(33,120,168,0.14)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#4A6070' }}>Suscripciones por facturar</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#4A6070', fontVariantNumeric: 'tabular-nums' }}>{money(pendingSubsTotal)}</span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#90A4B0', lineHeight: 1.45 }}>
                Van a sumarse a próximos ciclos; todavía no cuentan acá.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
