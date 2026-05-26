/* global React */
// Gota — Mobile App UI components (high-fidelity recreation)
// Source: components/dashboard/*, components/navigation/TabBar.tsx, ui/*

const { useState, useRef, useEffect, useMemo } = React;

// =====================================
// Atoms
// =====================================

const Icon = ({ name, weight = "regular", size = 18, color = "currentColor", style }) => (
  <i
    className={`ph${weight === "regular" ? "" : "-" + weight} ph-${name}`}
    style={{ fontSize: size, color, lineHeight: 1, ...style }}
  />
);

const Label = ({ children, style }) => (
  <span style={{
    fontSize: 11, fontWeight: 700, letterSpacing: "0.09em",
    textTransform: "uppercase", color: "var(--gota-text-secondary)", ...style
  }}>{children}</span>
);

const Meta = ({ children, style }) => (
  <span style={{ fontSize: 12, color: "var(--gota-text-dim)", ...style }}>{children}</span>
);

// Money formatter — Argentine style with optional masking
const fmtARS = (n) => "$ " + Math.round(n).toLocaleString("es-AR");
const fmtUSD = (n) => "USD " + Math.round(n).toLocaleString("es-AR");
const fmt = (n, ccy) => (ccy === "USD" ? fmtUSD(n) : fmtARS(n));
const mask = (ccy) => (ccy === "USD" ? "USD ****" : "$ ******");

// =====================================
// Category icons (subset of CategoryIcon.tsx)
// =====================================

const CATEGORY_MAP = {
  "Supermercado":              { icon: "shopping-cart", color: "#1A7A42" },
  "Restaurantes":              { icon: "fork-knife",    color: "#2D8B5A" },
  "Delivery":                  { icon: "motorcycle",    color: "#2D8B5A" },
  "Casa/Mantenimiento":        { icon: "wrench",        color: "#2178A8" },
  "Servicios del Hogar":       { icon: "lightning",     color: "#1B7E9E" },
  "Auto/Combustible":          { icon: "gas-pump",      color: "#B84A12" },
  "Transporte":                { icon: "bus",           color: "#C4601A" },
  "Salud":                     { icon: "heart",         color: "#1B7E9E" },
  "Farmacia":                  { icon: "pill",          color: "#0E8A7A" },
  "Educación":                 { icon: "book-open",     color: "#6D3DB5" },
  "Ropa e Indumentaria":       { icon: "t-shirt",       color: "#7D4EC0" },
  "Cuidado Personal":          { icon: "sparkle",       color: "#8B60C8" },
  "Suscripciones":             { icon: "arrows-clockwise", color: "#2178A8" },
  "Regalos":                   { icon: "gift",          color: "#A0367A" },
  "Entretenimiento":           { icon: "television",    color: "#7D4EC0" },
  "Otros":                     { icon: "tag",           color: "#4A6070" },
  "Pago de Tarjetas":          { icon: "credit-card",   color: "#A61E1E" },
};

function hexAlpha(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const CategoryIcon = ({ category, size = 36, iconSize = 20 }) => {
  const entry = CATEGORY_MAP[category] || CATEGORY_MAP["Otros"];
  return (
    <div style={{
      width: size, height: size, borderRadius: 10,
      background: hexAlpha(entry.color, 0.10),
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <Icon name={entry.icon} weight="light" size={iconSize} color={entry.color} />
    </div>
  );
};

// =====================================
// Buttons & primitives
// =====================================

const PrimaryButton = ({ children, onClick, disabled, style }) => (
  <button onClick={onClick} disabled={disabled} style={{
    width: "100%", padding: 15, background: "#2178A8", color: "#fff",
    border: 0, borderRadius: 14, fontWeight: 700, fontSize: 15,
    fontFamily: "inherit", cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1, transition: "filter 150ms, transform 150ms",
    ...style,
  }}>{children}</button>
);

const SoftButton = ({ children, onClick, style }) => (
  <button onClick={onClick} style={{
    background: "rgba(33,120,168,0.09)", color: "#2178A8",
    border: "1px solid rgba(33,120,168,0.20)", borderRadius: 14,
    padding: "12px 16px", fontWeight: 600, fontSize: 14,
    fontFamily: "inherit", cursor: "pointer", ...style,
  }}>{children}</button>
);

const Chip = ({ active, children, onClick, style }) => (
  <button onClick={onClick} style={{
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "8px 14px", borderRadius: 9999,
    background: active ? "#2178A8" : "#FFFFFF",
    border: active ? "0" : "1px solid rgba(15,30,60,0.10)",
    color: active ? "#fff" : "#4A6070",
    fontSize: 13, fontWeight: active ? 600 : 500,
    fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
    ...style,
  }}>{children}</button>
);

const SegToggle = ({ options, value, onChange, activeColor = "#2178A8" }) => (
  <div style={{
    display: "inline-flex", padding: 4, gap: 4,
    background: "rgba(255,255,255,0.50)",
    border: "1px solid rgba(255,255,255,0.70)",
    borderRadius: 12,
  }}>
    {options.map((opt) => {
      const active = opt.value === value;
      return (
        <button key={opt.value} onClick={() => onChange(opt.value)} style={{
          background: active ? activeColor : "transparent",
          color: active ? "#fff" : "#4A6070",
          border: 0, borderRadius: 9, padding: "8px 14px",
          fontWeight: active ? 600 : 500, fontSize: 13,
          fontFamily: "inherit", cursor: "pointer",
        }}>{opt.label}</button>
      );
    })}
  </div>
);

const Card = ({ children, glass = "1", style, onClick }) => {
  const styles = {
    "1": {
      background: "rgba(255,255,255,0.78)",
      backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
    },
    "2": {
      background: "rgba(190,225,248,0.28)",
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
    },
    "3": {
      background: "rgba(190,225,248,0.28)",
      backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
    },
    "module": {
      background: "#FFFFFF",
      boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
    },
  };
  return (
    <div onClick={onClick} style={{
      borderRadius: 18,
      border: "1px solid rgba(255,255,255,0.70)",
      ...styles[glass],
      ...style,
    }}>{children}</div>
  );
};

const Badge = ({ tone = "success", children }) => {
  const tones = {
    success: { bg: "rgba(26,122,66,0.10)", fg: "#1A7A42" },
    warning: { bg: "rgba(184,74,18,0.10)", fg: "#B84A12" },
    danger:  { bg: "rgba(166,30,30,0.09)", fg: "#A61E1E" },
    primary: { bg: "rgba(33,120,168,0.09)", fg: "#2178A8" },
    neutral: { bg: "rgba(74,96,112,0.10)", fg: "#4A6070" },
  };
  const t = tones[tone] || tones.success;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 10px", borderRadius: 9999,
      background: t.bg, color: t.fg,
      fontSize: 11, fontWeight: 600,
    }}>{children}</span>
  );
};

Object.assign(window, {
  Icon, Label, Meta, Card, Chip, SegToggle, PrimaryButton, SoftButton, Badge,
  CategoryIcon, CATEGORY_MAP, hexAlpha, fmt, fmtARS, fmtUSD, mask,
});
