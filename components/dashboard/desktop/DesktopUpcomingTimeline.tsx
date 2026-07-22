'use client'

import { ArrowRight } from '@phosphor-icons/react'
import { todayAR } from '@/lib/format'
import { BLUE, CARD_STYLE, LABEL_STYLE } from './desktop-ui'
import type { NavId } from './desktop-chrome'
import type { HorizonEvent } from './desktop-dashboard-model'

type Money = (n: number, currency?: 'ARS' | 'USD') => string

const MAX_EVENTS = 5

/** Cada evento explica su consecuencia sobre la caja, no solo su fecha. */
const KIND_META: Record<
  HorizonEvent['kind'],
  { chip: string; chipColor: string; chipBg: string; consequence: string; sign: '' | '+'; amountCaption?: string; amountColor: string }
> = {
  card: {
    chip: 'Cierre',
    chipColor: BLUE,
    chipBg: 'rgba(33,120,168,0.09)',
    consequence: 'Lo que compres antes entra en este resumen.',
    sign: '',
    amountCaption: 'del ciclo',
    amountColor: '#4A6070',
  },
  due: {
    chip: 'Vencimiento',
    chipColor: '#B84A12',
    chipBg: 'rgba(184,74,18,0.10)',
    consequence: 'Ya está contemplado en tu Disponible Real.',
    sign: '',
    amountCaption: 'a pagar',
    amountColor: '#0D1829',
  },
  income: {
    chip: 'Ingreso',
    chipColor: '#1A7A42',
    chipBg: 'rgba(26,122,66,0.10)',
    consequence: 'Hasta que entre, no mejora la caja de hoy.',
    sign: '+',
    amountCaption: 'estimado',
    amountColor: '#1A7A42',
  },
  instrument: {
    chip: 'Plazo fijo',
    chipColor: '#1A7A42',
    chipBg: 'rgba(26,122,66,0.10)',
    consequence: 'Ese capital vuelve a estar líquido.',
    sign: '+',
    amountColor: '#1A7A42',
  },
  subscription: {
    chip: 'Suscripción',
    chipColor: '#2178A8',
    chipBg: 'rgba(33,120,168,0.09)',
    consequence: 'Es un cobro estimado según su calendario configurado.',
    sign: '',
    amountCaption: 'estimado',
    amountColor: '#0D1829',
  },
  installment: {
    chip: 'Cuota',
    chipColor: '#6D3DB5',
    chipBg: 'rgba(109,61,181,0.10)',
    consequence: 'Es una cuota futura ya programada.',
    sign: '',
    amountCaption: 'programado',
    amountColor: '#0D1829',
  },
}

function daysFromToday(dateStr: string, today: string): number {
  const parse = (s: string) => new Date(`${s}T12:00:00-03:00`).getTime()
  return Math.round((parse(dateStr) - parse(today)) / 86_400_000)
}

function relativeLabel(days: number): string {
  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Mañana'
  return `En ${days} días`
}

export function DesktopUpcomingTimeline({
  events,
  money,
  onNav,
}: {
  events: HorizonEvent[]
  money: Money
  onNav: (id: NavId) => void
}) {
  const today = todayAR()
  const upcoming = events
    .map((event) => ({ event, days: daysFromToday(event.date, today) }))
    .filter(({ days }) => days >= 0 && days <= 30)
    .slice(0, MAX_EVENTS)

  return (
    <section style={{ ...CARD_STYLE, padding: '24px 26px' }}>
      <style>{`
        .timeline-rail { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; }
        .timeline-cell + .timeline-cell { border-left: 1px solid rgba(33,120,168,0.08); }
        @media (max-width: 1180px) {
          .timeline-rail { grid-auto-flow: row; grid-template-columns: 1fr 1fr; }
          .timeline-cell + .timeline-cell { border-left: 0; }
          .timeline-cell { border-top: 1px solid rgba(33,120,168,0.08); }
          .timeline-cell:nth-child(-n+2) { border-top: 0; }
        }
        @media (max-width: 720px) {
          .timeline-rail { grid-template-columns: 1fr; }
          .timeline-cell:nth-child(-n+2) { border-top: 1px solid rgba(33,120,168,0.08); }
          .timeline-cell:first-child { border-top: 0; }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: upcoming.length > 0 ? 18 : 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={LABEL_STYLE}>Próximos 30 días</span>
          <span style={{ fontSize: 12.5, color: '#90A4B0' }}>Lo que va a mover tu caja</span>
        </div>
        <button
          type="button"
          onClick={() => onNav('analisis')}
          style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: BLUE, fontFamily: 'inherit' }}
        >
          Ver agenda <ArrowRight size={11} />
        </button>
      </div>

      {upcoming.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: '#4A6070', lineHeight: 1.55 }}>
          Sin eventos que muevan tu caja en los próximos 30 días.
        </p>
      ) : (
        <div className="timeline-rail">
          {upcoming.map(({ event, days }) => {
            const meta = KIND_META[event.kind]
            const date = new Date(`${event.date}T12:00:00-03:00`)
            const dateLabel = date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '')
            return (
              <div key={event.id} className="timeline-cell" style={{ padding: '2px 18px', display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: days <= 3 ? '#B84A12' : '#90A4B0' }}>
                    {relativeLabel(days)}
                  </span>
                  <span style={{ fontSize: 11, color: '#B8C9D4' }}>· {dateLabel}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0D1829', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {event.title}
                  </span>
                  <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 700, background: meta.chipBg, color: meta.chipColor, flexShrink: 0 }}>
                    {meta.chip}
                  </span>
                </div>
                {event.amount !== undefined && event.amount > 0 && (
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: meta.amountColor, fontVariantNumeric: 'tabular-nums' }}>
                    {meta.sign}
                    {money(event.amount, event.currency ?? 'ARS')}
                    {meta.amountCaption && <span style={{ fontWeight: 500, color: '#90A4B0' }}> {meta.amountCaption}</span>}
                  </div>
                )}
                <p style={{ margin: 0, fontSize: 12, color: '#4A6070', lineHeight: 1.45 }}>{meta.consequence}</p>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
