// THROWAWAY — Variante C: Híbrida Sobria con Foco en Acción
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

export function VariantC() {
  return (
    <PhoneFrame
      label="Híbrida Sobria · Foco en Acción"
      tag="Variante C"
      tagColor="#4A1A6A"
    >
      {/* Safe area top */}
      <div style={{ paddingTop: 16 }} />

      {/* ── HEADER ────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px 16px',
        }}
      >
        <Avatar />
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: tokens.textSecondary,
          }}
        >
          Mayo 2026
        </span>
        <PlusBtn />
      </div>

      {/* ── HERO CARD: balance prominente, elevado ────────── */}
      <div
        style={{
          margin: '0 16px',
          borderRadius: 20,
          background: '#FFFFFF',
          boxShadow: '0 4px 16px rgba(13,24,41,0.09)',
          padding: '18px 20px 14px',
          marginBottom: 8,
        }}
      >
        {/* Label */}
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

        {/* Hero number + eye */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            margin: '6px 0 6px',
          }}
        >
          <div
            style={{
              fontSize: 38,
              fontWeight: 800,
              color: tokens.textPrimary,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
            }}
          >
            {MOCK_BALANCE}
          </div>
          <span style={{ fontSize: 14, color: tokens.textDim, marginTop: 4 }}>◎</span>
        </div>

        {/* ARS / USD inline */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            marginBottom: 14,
          }}
        >
          <span
            style={{ fontSize: 11, fontWeight: 600, color: tokens.primary }}
          >
            ARS
          </span>
          <span style={{ fontSize: 11, color: tokens.textDim }}>1.240.500</span>
          <span style={{ fontSize: 11, color: tokens.separator }}>|</span>
          <span
            style={{ fontSize: 11, fontWeight: 600, color: tokens.primary }}
          >
            USD
          </span>
          <span style={{ fontSize: 11, color: tokens.textDim }}>1.240</span>
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: tokens.separator,
            marginBottom: 12,
          }}
        />

        {/* Disponible Real row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(33,120,168,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
              }}
            >
              👛
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 500,
                  color: tokens.textSecondary,
                }}
              >
                Disponible real
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: tokens.textDim,
                }}
              >
                Descuenta deuda y tarjeta
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: tokens.textPrimary,
              }}
            >
              {MOCK_DISPONIBLE}
            </span>
            <span style={{ fontSize: 11, color: tokens.textDim }}>›</span>
          </div>
        </div>
      </div>

      {/* ── COMPROMISOS: barra debajo del card ───────────── */}
      <div
        style={{
          margin: '0 16px 16px',
          background: tokens.bgSecondary,
          borderRadius: '0 0 12px 12px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${tokens.separator}`,
          borderLeft: `1px solid ${tokens.separator}`,
          borderRight: `1px solid ${tokens.separator}`,
        }}
      >
        <span style={{ fontSize: 12, color: tokens.textSecondary }}>
          Compromisos tarjetas
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: tokens.warning,
          }}
        >
          {MOCK_COMPROMISOS} ›
        </span>
      </div>

      {/* ── SECTION HEADER ───────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 20px 8px',
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
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(20px)',
          paddingBottom: 20,
        }}
      >
        {/* SmartInput: glass pill con separación visual */}
        <div style={{ padding: '10px 16px 6px' }}>
          <div
            style={{
              background: 'rgba(190,225,248,0.28)',
              border: '1px solid rgba(255,255,255,0.90)',
              borderRadius: 16,
              padding: '11px 14px',
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
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: tokens.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              ✦
            </div>
          </div>
        </div>

        {/* TabBar: indicador top-bar sobre activo (patrón iOS nativo) */}
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
                gap: 4,
                padding: '2px 12px 4px',
                position: 'relative',
              }}
            >
              {/* Top bar indicador */}
              <div
                style={{
                  position: 'absolute',
                  top: -6,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: tab.active ? 28 : 0,
                  height: 2,
                  borderRadius: 1,
                  background: tokens.primary,
                  transition: 'width 0.2s ease',
                }}
              />
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
