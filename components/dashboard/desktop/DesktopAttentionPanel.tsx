'use client'

import { CreditCard, PencilSimple, Receipt } from '@phosphor-icons/react'
import { BLUE, CARD_STYLE, LABEL_STYLE } from './desktop-ui'
import type { AttentionSignal } from './desktop-dashboard-model'

type Money = (n: number, currency?: 'ARS' | 'USD') => string

const TONE: Record<AttentionSignal['tone'], { color: string; bg: string }> = {
  high: { color: '#A61E1E', bg: 'rgba(166,30,30,0.09)' },
  medium: { color: '#B84A12', bg: 'rgba(184,74,18,0.10)' },
  low: { color: BLUE, bg: 'rgba(33,120,168,0.09)' },
}

function signalIcon(id: string): typeof CreditCard {
  if (id.startsWith('closing-') || id.startsWith('due-')) return CreditCard
  if (id.startsWith('extra-')) return Receipt
  return PencilSimple
}

export function DesktopAttentionPanel({ signals, money }: { signals: AttentionSignal[]; money: Money }) {
  return (
    <div style={{ ...CARD_STYLE, padding: '24px 26px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: signals.length > 0 ? 4 : 14 }}>
        <span style={LABEL_STYLE}>Atención ahora</span>
        {signals.length > 0 && (
          <span style={{ minWidth: 22, height: 22, padding: '0 7px', borderRadius: 9999, background: 'rgba(33,120,168,0.09)', color: BLUE, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {signals.length}
          </span>
        )}
      </div>

      {signals.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0D1829' }}>No hay señales urgentes.</p>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#4A6070', lineHeight: 1.55 }}>
            Gota va a marcarte algo cuando cambie tu margen, tus vencimientos o tu ritmo.
          </p>
        </div>
      ) : (
        <div>
          {signals.map((signal, i) => {
            const tone = TONE[signal.tone]
            const IconCmp = signalIcon(signal.id)
            return (
              <div key={signal.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 13, padding: '15px 0', borderTop: i > 0 ? '1px solid rgba(33,120,168,0.07)' : 'none' }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, marginTop: 1, background: tone.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconCmp weight="light" size={18} color={tone.color} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0D1829', lineHeight: 1.35 }}>{signal.title}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#90A4B0', flexShrink: 0, whiteSpace: 'nowrap' }}>{signal.dateLabel}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: '#4A6070', marginTop: 3, lineHeight: 1.45 }}>{signal.detail}</div>
                  {signal.amount !== undefined && (
                    <div style={{ fontSize: 12.5, color: '#4A6070', marginTop: 4 }}>
                      <strong style={{ color: '#0D1829', fontVariantNumeric: 'tabular-nums' }}>{money(signal.amount, signal.currency)}</strong>
                      {signal.amountCaption ? ` ${signal.amountCaption}` : ''}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
