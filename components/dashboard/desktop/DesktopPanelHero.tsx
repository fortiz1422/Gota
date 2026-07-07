'use client'

import { CARD_STYLE, currencySymbol, LABEL_STYLE, MAXW } from './desktop-ui'
import type { DesktopHeroStats } from './desktop-dashboard-model'

type Money = (n: number, currency?: 'ARS' | 'USD') => string

/** Champion: Saldo Vivo en blanco sobre la blue-zone, como en mobile. */
export function SaldoVivoBlueHero({
  greeting,
  stats,
  heroBreakdown,
  viewCurrency,
  hidden,
}: {
  greeting: React.ReactNode
  stats: DesktopHeroStats
  heroBreakdown: Record<'ARS' | 'USD', number>
  viewCurrency: 'ARS' | 'USD'
  hidden: boolean
}) {
  const [saldoInt, saldoDec] = stats.saldoVivo.toFixed(2).split('.')

  return (
    <div style={{ maxWidth: MAXW, margin: '0 auto', padding: '22px 40px 56px' }}>
      <p style={{ margin: '0 0 26px', fontSize: 14, color: 'rgba(255,255,255,0.72)' }}>{greeting}</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.11em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.68)' }}>
          Tu Saldo Vivo
        </span>
        <span
          className="header-glass"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 9999, color: '#FFFFFF', fontSize: 11, fontWeight: 600 }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 9999, background: '#7FE0A8' }} />
          En tiempo real
        </span>
      </div>

      <div
        style={{
          fontSize: 68,
          fontWeight: 800,
          letterSpacing: '-0.05em',
          lineHeight: 0.95,
          color: '#FFFFFF',
          fontVariantNumeric: 'tabular-nums',
          marginBottom: 12,
        }}
      >
        {hidden ? (
          '$ ••••••'
        ) : (
          <>
            <span style={{ fontSize: 24, fontWeight: 600, color: 'rgba(255,255,255,0.55)', verticalAlign: '0.55em', marginRight: 6 }}>
              {currencySymbol(viewCurrency)}
            </span>
            {Number(saldoInt).toLocaleString('es-AR')}
            <span style={{ fontSize: 34, color: 'rgba(255,255,255,0.42)', fontWeight: 600 }}>,{saldoDec}</span>
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13, color: 'rgba(255,255,255,0.62)' }}>
        <span>La foto viva de tu plata, hoy.</span>
        <span style={{ color: 'rgba(255,255,255,0.28)' }}>·</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ color: '#FFFFFF', fontWeight: 700 }}>ARS</span>{' '}
          {hidden ? '••••••' : Math.round(heroBreakdown.ARS).toLocaleString('es-AR')}
        </span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ color: '#FFFFFF', fontWeight: 700 }}>USD</span>{' '}
          {hidden ? '••••' : heroBreakdown.USD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  )
}

/** Barra de propiedad: el total es el Saldo Vivo; el segmento azul es lo disponible,
 *  el segmento rayado es lo que ya tiene destino. Vive en la zona blanca para que
 *  el azul conserve su significado. */
function OwnershipBar({ pctAvailable, hidden }: { pctAvailable: number; hidden: boolean }) {
  return (
    <div
      aria-hidden
      style={{
        display: 'flex',
        height: 10,
        borderRadius: 6,
        overflow: 'hidden',
        background: 'rgba(33,120,168,0.08)',
      }}
    >
      {hidden ? (
        <div style={{ width: '100%', background: 'rgba(33,120,168,0.16)' }} />
      ) : (
        <>
          {pctAvailable > 0 && (
            <div style={{ width: `${pctAvailable * 100}%`, background: 'linear-gradient(90deg, #2178A8, #1B6A93)' }} />
          )}
          {pctAvailable < 1 && (
            <div
              style={{
                flex: 1,
                background:
                  'repeating-linear-gradient(135deg, rgba(74,96,112,0.32) 0px, rgba(74,96,112,0.32) 4px, rgba(74,96,112,0.10) 4px, rgba(74,96,112,0.10) 8px)',
              }}
            />
          )}
        </>
      )}
    </div>
  )
}

/** Subhéroe: card blanca que solapa la blue-zone y explica cómo se reparte el Saldo Vivo. */
export function DisponibleRelationCard({
  stats,
  hidden,
  money,
}: {
  stats: DesktopHeroStats
  hidden: boolean
  money: Money
}) {
  const hasGap = stats.brecha > 0.5
  const pctAvailable =
    stats.saldoVivo > 0 ? Math.min(Math.max(stats.disponibleReal / stats.saldoVivo, 0), 1) : 0
  const disponibleNegativo = stats.disponibleReal < 0

  return (
    <section style={{ ...CARD_STYLE, padding: '24px 26px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ ...LABEL_STYLE, marginBottom: 16 }}>Cómo se reparte hoy</div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {stats.saldoVivo > 0 && <OwnershipBar pctAvailable={hasGap ? pctAvailable : 1} hidden={hidden} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 28, marginTop: 22 }}>
        {/* Subhero: Disponible real */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: 'linear-gradient(135deg, #2178A8, #1B6A93)', flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#4A6070' }}>
              Disponible real
            </span>
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: '-0.035em',
              color: disponibleNegativo ? '#B84A12' : '#1B6A93',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              marginBottom: 8,
            }}
          >
            {money(stats.disponibleReal)}
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: '#90A4B0', lineHeight: 1.5 }}>
            {disponibleNegativo
              ? 'Tus consumos de tarjeta superan tu saldo de hoy.'
              : 'Libre para usar sin pisar compromisos.'}
          </p>
        </div>

        {/* Explicación de la brecha: ya tiene destino */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                flexShrink: 0,
                background:
                  'repeating-linear-gradient(135deg, rgba(74,96,112,0.45) 0px, rgba(74,96,112,0.45) 2px, rgba(74,96,112,0.12) 2px, rgba(74,96,112,0.12) 4px)',
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#4A6070' }}>
              Ya tiene destino
            </span>
          </div>
          {hasGap ? (
            <>
              <div style={{ fontSize: 25, fontWeight: 700, letterSpacing: '-0.025em', color: '#4A6070', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginBottom: 8, marginTop: 8 }}>
                {money(stats.brecha)}
              </div>
              <p style={{ margin: 0, fontSize: 12.5, color: '#90A4B0', lineHeight: 1.5 }}>
                Consumos de tarjeta que todavía no pagaste.
              </p>
            </>
          ) : (
            <p style={{ margin: '5px 0 0', fontSize: 12.5, color: '#90A4B0', lineHeight: 1.5 }}>
              Hoy nada de tu Saldo Vivo está comprometido: todo está disponible.
            </p>
          )}
        </div>
      </div>
      </div>
    </section>
  )
}
