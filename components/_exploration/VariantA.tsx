// THROWAWAY — Variante A: Fintech Calma / Premium
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

export function VariantA() {
  return (
    <PhoneFrame
      label="Fintech Calma / Premium"
      tag="Variante A"
      tagColor="#1A4A6A"
    >
      {/* Safe area top */}
      <div style={{ paddingTop: 16 }} />

      {/* ── HEADER ────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px 12px',
        }}
      >
        <Avatar />
        {/* Month pill — centered */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: tokens.bgTertiary,
            borderRadius: 20,
            padding: '5px 12px',
            fontSize: 13,
            fontWeight: 600,
            color: tokens.textSecondary,
          }}
        >
          Mayo
          <span style={{ fontSize: 10, color: tokens.textDim, marginLeft: 2 }}>▾</span>
        </div>
        <PlusBtn />
      </div>

      {/* ── HERO CARD (full-width, glass-tinted) ─────────── */}
      <div
        style={{
          margin: '0 16px 20px',
          borderRadius: 22,
          background: 'linear-gradient(145deg, rgba(33,120,168,0.07) 0%, rgba(27,126,158,0.04) 100%)',
          border: '1px solid rgba(33,120,168,0.10)',
          padding: '22px 20px 18px',
        }}
      >
        {/* Label + eye toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
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
            Saldo Vivo
          </span>
          <span style={{ fontSize: 14, color: tokens.textDim }}>◎</span>
        </div>

        {/* Hero number */}
        <div
          style={{
            fontSize: 42,
            fontWeight: 800,
            color: tokens.textPrimary,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: 8,
          }}
        >
          {MOCK_BALANCE}
        </div>

        {/* ARS/USD breakdown pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <span
            style={{
              background: tokens.primarySoft,
              borderRadius: 8,
              padding: '3px 8px',
              fontSize: 11,
              fontWeight: 600,
              color: tokens.primary,
            }}
          >
            ARS 1.240.500
          </span>
          <span
            style={{
              background: 'rgba(27,126,158,0.09)',
              borderRadius: 8,
              padding: '3px 8px',
              fontSize: 11,
              fontWeight: 600,
              color: '#1B7E9E',
            }}
          >
            USD 1.240
          </span>
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: 'rgba(33,120,168,0.10)',
            marginBottom: 14,
          }}
        />

        {/* Disponible Real + Compromisos row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: tokens.textDim,
                marginBottom: 2,
              }}
            >
              Disponible real
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: tokens.success,
              }}
            >
              {MOCK_DISPONIBLE}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: tokens.textDim,
                marginBottom: 2,
              }}
            >
              Compromisos
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 700,
                color: tokens.warning,
              }}
            >
              {MOCK_COMPROMISOS}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: 4,
            borderRadius: 4,
            background: tokens.separator,
            marginTop: 12,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: '21%',
              background: tokens.warning,
              borderRadius: 4,
            }}
          />
        </div>
      </div>

      {/* ── SECTION HEADER ───────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 20px 10px',
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
          Últimos movimientos
        </span>
        <span style={{ fontSize: 12, color: tokens.primary, fontWeight: 600 }}>
          Ver todos →
        </span>
      </div>

      {/* ── MOVEMENTS LIST ───────────────────────────────── */}
      <div style={{ padding: '0 16px' }}>
        {MOCK_MOVEMENTS.map((mv, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '11px 4px',
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
                  fontSize: 14,
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
                  margin: '2px 0 0',
                  fontSize: 12,
                  color: tokens.textDim,
                }}
              >
                {mv.cat} · {mv.date}
              </p>
            </div>
            <span
              style={{
                fontSize: 14,
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
      {/* SmartInput (collapsed) */}
      <div style={{ flex: 1 }} />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(16px)',
          borderTop: `1px solid ${tokens.separator}`,
          paddingBottom: 24,
        }}
      >
        {/* SmartInput pill */}
        <div style={{ padding: '10px 16px 6px' }}>
          <div
            style={{
              background: 'rgba(190,225,248,0.28)',
              border: '1px solid rgba(255,255,255,0.90)',
              borderRadius: 16,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 14, color: tokens.textDim, flex: 1 }}>
              ¿Qué gastaste?
            </span>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: tokens.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              ✦
            </div>
          </div>
        </div>

        {/* TabBar — pills on active */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-around',
            padding: '4px 20px 0',
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
                gap: 4,
                padding: '6px 16px',
                borderRadius: 14,
                background: tab.active ? tokens.primarySoft : 'transparent',
              }}
            >
              <span
                style={{
                  fontSize: 18,
                  color: tab.active ? tokens.primary : tokens.textDim,
                  lineHeight: 1,
                }}
              >
                {tab.icon}
              </span>
              <span
                style={{
                  fontSize: 11,
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
