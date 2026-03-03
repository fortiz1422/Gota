import { formatAmount, formatCompact } from '@/lib/format'
import { Wallet, CreditCard } from 'lucide-react'
import type { DashboardData } from '@/types/database'

interface Props {
  data: DashboardData['saldo_vivo']
  currency: 'ARS' | 'USD'
  gastosTarjeta?: number
}

export function SaldoVivo({ data, currency, gastosTarjeta = 0 }: Props) {
  if (!data) {
    return (
      <div className="px-2 py-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
          Disponible
        </p>
        <p className="mt-2 text-sm text-text-tertiary">
          Configurá tu ingreso mensual para ver cuánto te queda disponible.
        </p>
      </div>
    )
  }

  const saldoInicial = (data.saldo_inicial as number | undefined) ?? 0
  const disponible = saldoInicial + data.ingresos - data.gastos_percibidos - data.pago_tarjetas
  const isNegative = disponible < 0

  return (
    <div className="relative px-2 py-6">
      {/* Bioluminescent glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -20,
          left: -30,
          width: 280,
          height: 200,
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 0,
          background: isNegative
            ? 'radial-gradient(ellipse, rgba(239,68,68,0.14) 0%, transparent 70%)'
            : 'radial-gradient(ellipse, rgba(56,189,248,0.14) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Hero number */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#7B98B8',
            marginBottom: 6,
          }}
        >
          Disponible
        </p>
        <p
          style={{
            fontSize: 46,
            fontWeight: 900,
            letterSpacing: '-0.04em',
            color: isNegative ? '#f87171' : '#f0f9ff',
            lineHeight: 1,
            margin: 0,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {isNegative ? '−' : ''}
          {formatAmount(Math.abs(disponible), currency)}
        </p>

        {/* Twin Pills */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          {/* Percibidos */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 14px',
              borderRadius: 9999,
              background: 'rgba(148,210,255,0.05)',
              border: '1px solid rgba(148,210,255,0.15)',
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                flexShrink: 0,
                background: 'rgba(148,210,255,0.08)',
                border: '1px solid rgba(148,210,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Wallet size={13} style={{ color: '#7B98B8' }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: '#7B98B8',
                  lineHeight: 1,
                  marginBottom: 4,
                }}
              >
                Percibidos
              </p>
              <p
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: '#f0f9ff',
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatCompact(data.gastos_percibidos, currency)}
              </p>
            </div>
          </div>

          {/* Tarjeta */}
          {gastosTarjeta > 0 && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 9999,
                background: 'rgba(148,210,255,0.05)',
                border: '1px solid rgba(148,210,255,0.15)',
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: 'rgba(148,210,255,0.08)',
                  border: '1px solid rgba(148,210,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CreditCard size={13} style={{ color: '#7B98B8' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color: '#7B98B8',
                    lineHeight: 1,
                    marginBottom: 4,
                  }}
                >
                  Tarjeta
                </p>
                <p
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: '#f0f9ff',
                    letterSpacing: '-0.02em',
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatCompact(gastosTarjeta, currency)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
