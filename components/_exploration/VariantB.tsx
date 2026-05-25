// THROWAWAY — Variante B: Nativa Operativa / Densa
// No modifica lógica ni componentes de producción.

import {
  PhoneFrame,
  Avatar,
  PlusBtn,
  CategoryDot,
  MOCK_BALANCE,
  MOCK_DISPONIBLE,
  MOCK_COMPROMISOS,
  MOCK_MOVEMENTS,
  tokens,
} from './shared'

export function VariantB() {
  return (
    <PhoneFrame
      label="Nativa Operativa / Densa"
      tag="Variante B"
      tagColor="#1A4A2A"
    >
      {/* Safe area top */}
      <div style={{ paddingTop: 16 }} />

      {/* ── HEADER: mes + avatar + plus, una sola fila ───── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px 10px',
        }}
      >
        <Avatar size={32} />
        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: tokens.textPrimary,
              letterSpacing: '-0.01em',
            }}
          >
            Mayo 2026
          </span>
        </div>
        <PlusBtn size={32} />
      </div>

      {/* ── HERO COMPACTO: balance + quick stats ─────────── */}
      <div
        style={{
          margin: '0 12px 12px',
          borderRadius: 16,
          background: tokens.bgSecondary,
          border: `1px solid ${tokens.separator}`,
          padding: '14px 16px',
        }}
      >
        {/* Balance row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div>
            <p
              style={{
                margin: '0 0 3px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: tokens.textDim,
              }}
            >
              Saldo Vivo
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 30,
                fontWeight: 800,
                color: tokens.textPrimary,
                letterSpacing: '-0.02em',
              }}
            >
              {MOCK_BALANCE}
            </p>
          </div>
          <span style={{ fontSize: 12, color: tokens.textDim }}>◎</span>
        </div>

        {/* Quick stats: 3 pills */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div
            style={{
              flex: 1,
              background: tokens.successSoft,
              borderRadius: 10,
              padding: '8px 10px',
            }}
          >
            <p
              style={{
                margin: '0 0 2px',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: tokens.success,
              }}
            >
              Ingresos
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 700,
                color: tokens.success,
              }}
            >
              +$850k
            </p>
          </div>
          <div
            style={{
              flex: 1,
              background: tokens.warningSoft,
              borderRadius: 10,
              padding: '8px 10px',
            }}
          >
            <p
              style={{
                margin: '0 0 2px',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: tokens.warning,
              }}
            >
              Gastos
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 700,
                color: tokens.warning,
              }}
            >
              −$62k
            </p>
          </div>
          <div
            style={{
              flex: 1,
              background: 'rgba(33,120,168,0.07)',
              borderRadius: 10,
              padding: '8px 10px',
            }}
          >
            <p
              style={{
                margin: '0 0 2px',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: tokens.primary,
              }}
            >
              Tarjetas
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 700,
                color: tokens.primary,
              }}
            >
              $260k
            </p>
          </div>
        </div>
      </div>

      {/* ── DISPONIBLE + COMPROMISOS (fila compacta) ─────── */}
      <div
        style={{
          margin: '0 12px 12px',
          display: 'flex',
          gap: 8,
        }}
      >
        <div
          style={{
            flex: 1,
            background: tokens.bgSecondary,
            border: `1px solid ${tokens.separator}`,
            borderRadius: 12,
            padding: '10px 12px',
          }}
        >
          <p
            style={{
              margin: '0 0 2px',
              fontSize: 11,
              color: tokens.textDim,
            }}
          >
            Disponible real
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: tokens.success,
            }}
          >
            {MOCK_DISPONIBLE}
          </p>
        </div>
        <div
          style={{
            flex: 1,
            background: tokens.bgSecondary,
            border: `1px solid rgba(184,74,18,0.12)`,
            borderRadius: 12,
            padding: '10px 12px',
          }}
        >
          <p
            style={{
              margin: '0 0 2px',
              fontSize: 11,
              color: tokens.textDim,
            }}
          >
            Compromisos
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: tokens.warning,
            }}
          >
            {MOCK_COMPROMISOS}
          </p>
        </div>
      </div>

      {/* ── SECTION HEADER ───────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 16px 8px',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: tokens.textDim,
          }}
        >
          Recientes
        </span>
        <span style={{ fontSize: 12, color: tokens.primary, fontWeight: 600 }}>
          Ver todos →
        </span>
      </div>

      {/* ── MOVEMENTS LIST (densa) ───────────────────────── */}
      <div style={{ padding: '0 12px' }}>
        {MOCK_MOVEMENTS.map((mv, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 4px',
              borderBottom:
                i < MOCK_MOVEMENTS.length - 1
                  ? `1px solid ${tokens.separator}`
                  : 'none',
            }}
          >
            <CategoryDot color={mv.color} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 600,
                  color: tokens.textPrimary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {mv.label}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: tokens.textDim,
                }}
              >
                {mv.cat} · {mv.date}
              </p>
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: mv.amount.startsWith('+') ? tokens.success : tokens.textPrimary,
                flexShrink: 0,
              }}
            >
              {mv.amount}
            </span>
          </div>
        ))}
      </div>

      {/* ── BOTTOM ZONE ──────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: tokens.bgPrimary,
          borderTop: `1px solid ${tokens.separator}`,
          paddingBottom: 20,
        }}
      >
        {/* SmartInput como barra persistente */}
        <div style={{ padding: '8px 12px 4px' }}>
          <div
            style={{
              background: tokens.bgTertiary,
              borderRadius: 12,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 13, color: tokens.textDim, flex: 1 }}>
              Agregar movimiento…
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: tokens.primary,
                background: tokens.primarySoft,
                padding: '3px 8px',
                borderRadius: 6,
              }}
            >
              + Agregar
            </span>
          </div>
        </div>

        {/* TabBar plana con dot indicador */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-around',
            padding: '6px 20px 0',
          }}
        >
          {[
            { icon: '⌂', label: 'Home', active: true },
            { icon: '≡', label: 'Movimientos', active: false },
            { icon: '◷', label: 'Análisis', active: false },
          ].map((tab) => (
            <div
              key={tab.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '4px 12px',
                position: 'relative',
              }}
            >
              {/* Active dot */}
              {tab.active && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: tokens.primary,
                  }}
                />
              )}
              <span
                style={{
                  fontSize: 19,
                  color: tab.active ? tokens.primary : tokens.textDim,
                  lineHeight: 1,
                }}
              >
                {tab.icon}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: tab.active ? 700 : 400,
                  color: tab.active ? tokens.primary : tokens.textDim,
                }}
              >
                {tab.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  )
}
