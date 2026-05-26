/* global React, HomeScreen */
// Gota — Palette exploration
// 5 atmospheric directions for the same Home composition.
// Each scopes CSS custom properties to a wrapper and passes Phone bg.

const PALETTES = [
  {
    id: "ocean",
    name: "A · Ocean Calm",
    tagline: "La actual, refinada",
    desc: "El punto de partida: canvas celeste suave, cards blancas, accent ocean. Sereno, pero el blanco se diluye contra el bg.",
    bg: "linear-gradient(180deg, #F8FBFD 0%, #EEF4F8 100%)",
    swatches: ["#F8FBFD", "#EEF4F8", "#FFFFFF", "#2178A8"],
    vars: {
      "--theme-avatar-grad": "linear-gradient(135deg, #2178A8 0%, #1B7E9E 100%)",
      "--gota-primary": "#2178A8",
      "--gota-primary-soft": "rgba(33,120,168,0.09)",
      "--gota-surface-module": "#FFFFFF",
      "--gota-bg-tertiary": "#EEF4F8",
      "--gota-separator": "rgba(33,120,168,0.07)",
      "--gota-text-primary": "#0D1829",
      "--gota-text-secondary": "#4A6070",
      "--gota-text-dim": "#90A4B0",
      "--gota-text-muted": "#B8C9D4",
    },
  },
  {
    id: "linen",
    name: "B · Linen Warm",
    tagline: "Editorial, antiestéril",
    desc: "Canvas warm off-white tipo Linear / Stripe Press. El blanco del card se separa por temperatura, no por brillo. Calidez sin perder sobriedad.",
    bg: "linear-gradient(180deg, #F6F1E8 0%, #EDE6D8 100%)",
    swatches: ["#F6F1E8", "#EDE6D8", "#FFFFFF", "#1A5F8A"],
    vars: {
      "--theme-avatar-grad": "linear-gradient(135deg, #1A5F8A 0%, #0F4D74 100%)",
      "--gota-primary": "#1A5F8A",
      "--gota-primary-soft": "rgba(26,95,138,0.10)",
      "--gota-surface-module": "#FFFFFF",
      "--gota-bg-tertiary": "#F3ECDC",
      "--gota-separator": "rgba(60,45,20,0.08)",
      "--gota-text-primary": "#1E1A12",
      "--gota-text-secondary": "#5A5142",
      "--gota-text-dim": "#9A8F7E",
      "--gota-text-muted": "#C9BFAE",
    },
  },
  {
    id: "granite",
    name: "C · Granite Crisp",
    tagline: "Alto contraste, mobile-native",
    desc: "Canvas gris neutro tipo Nubank-light. Cards blancas que se despegan claramente. El accent se intensifica para no perderse.",
    bg: "linear-gradient(180deg, #EEF1F4 0%, #DEE3E9 100%)",
    swatches: ["#EEF1F4", "#DEE3E9", "#FFFFFF", "#0E6F8C"],
    vars: {
      "--theme-avatar-grad": "linear-gradient(135deg, #0E6F8C 0%, #08566F 100%)",
      "--gota-primary": "#0E6F8C",
      "--gota-primary-soft": "rgba(14,111,140,0.10)",
      "--gota-surface-module": "#FFFFFF",
      "--gota-bg-tertiary": "#F1F3F6",
      "--gota-separator": "rgba(30,40,55,0.08)",
      "--gota-text-primary": "#0A1421",
      "--gota-text-secondary": "#475260",
      "--gota-text-dim": "#8993A0",
      "--gota-text-muted": "#B6BEC9",
    },
  },
  {
    id: "deep",
    name: "D · Deep Ocean",
    tagline: "Dimensional, Revolut-light",
    desc: "Canvas azul más saturado, cards blancas brillantes con sombra más profunda. El accent se oscurece. Más volumen, más app, más confianza.",
    bg: "linear-gradient(180deg, #D6E3EE 0%, #B7CCDD 100%)",
    swatches: ["#D6E3EE", "#B7CCDD", "#FFFFFF", "#0F5C8C"],
    vars: {
      "--theme-avatar-grad": "linear-gradient(135deg, #0F5C8C 0%, #0B4368 100%)",
      "--gota-primary": "#0F5C8C",
      "--gota-primary-soft": "rgba(15,92,140,0.11)",
      "--gota-surface-module": "#FFFFFF",
      "--gota-bg-tertiary": "#E4ECF3",
      "--gota-separator": "rgba(15,40,70,0.10)",
      "--gota-text-primary": "#0A1828",
      "--gota-text-secondary": "#3F5567",
      "--gota-text-dim": "#7B8E9F",
      "--gota-text-muted": "#A8B7C6",
    },
  },
  {
    id: "carbon",
    name: "E · Carbon Light",
    tagline: "Monocromo + accent",
    desc: "Tipo N26 / Monzo light. Canvas cream, texto casi negro, cards blancas, el azul aparece solo en acciones y datos. Muy poco saturado, muy nativo iOS.",
    bg: "linear-gradient(180deg, #F7F5F0 0%, #ECE8DF 100%)",
    swatches: ["#F7F5F0", "#ECE8DF", "#FFFFFF", "#1B1B1F"],
    vars: {
      "--theme-avatar-grad": "linear-gradient(135deg, #1B1B1F 0%, #0A0A0C 100%)",
      "--gota-primary": "#1B5E89",
      "--gota-primary-soft": "rgba(27,94,137,0.09)",
      "--gota-surface-module": "#FFFFFF",
      "--gota-bg-tertiary": "#F4F1E9",
      "--gota-separator": "rgba(20,18,12,0.07)",
      "--gota-text-primary": "#1B1B1F",
      "--gota-text-secondary": "#4F4D4A",
      "--gota-text-dim": "#9A9690",
      "--gota-text-muted": "#C8C3BA",
    },
  },
];

const ThemedHome = ({ palette }) => (
  <div style={{ ...palette.vars, width: 390, height: 780 }}>
    <HomeScreen tabVariant="topbar" bg={palette.bg} />
  </div>
);

const PaletteCard = ({ palette }) => (
  <div style={{
    width: 230, padding: 18,
    background: "#FFFFFF",
    borderRadius: 18,
    border: "1px solid rgba(13,24,41,0.06)",
    boxShadow: "0 4px 12px rgba(13,24,41,0.06)",
    fontFamily: "var(--gota-font-sans)",
  }}>
    <div style={{
      display: "flex", gap: 6, marginBottom: 12,
      height: 40, borderRadius: 8, overflow: "hidden",
    }}>
      {palette.swatches.map((c, i) => (
        <div key={i} style={{
          flex: i === palette.swatches.length - 1 ? 1.4 : 1,
          background: c,
          border: c === "#FFFFFF" ? "1px solid rgba(13,24,41,0.08)" : "0",
        }} />
      ))}
    </div>
    <div style={{
      fontFamily: "var(--gota-font-display)",
      fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em",
      color: "var(--gota-text-primary)", marginBottom: 2,
    }}>{palette.name}</div>
    <div style={{
      fontSize: 11, fontWeight: 600, color: "var(--gota-primary)",
      textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8,
    }}>{palette.tagline}</div>
    <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--gota-text-secondary)" }}>
      {palette.desc}
    </div>
    <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 4 }}>
      {palette.swatches.map((c, i) => (
        <code key={i} style={{
          fontFamily: "var(--gota-font-mono)", fontSize: 10,
          padding: "2px 6px", borderRadius: 4,
          background: "var(--gota-bg-tertiary)",
          color: "var(--gota-text-secondary)",
        }}>{c}</code>
      ))}
    </div>
  </div>
);

Object.assign(window, { PALETTES, ThemedHome, PaletteCard });
