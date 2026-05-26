/* global React, Card, Icon, Label, Meta, CategoryIcon, fmt, fmtARS, mask, hexAlpha, Badge */
// Gota — App-level molecules: list rows, balance hero, account chips,
// SmartInput, donuts, bars. Faithfully matches the live components.

const { useState, useRef, useEffect, useMemo } = React;

// =====================================
// SmartInput — natural-language expense capture
// =====================================

const SmartInput = ({ value: initialValue = "", placeholder = "cafe 2500", onSubmit }) => {
  const [v, setV] = useState(initialValue);
  const hasText = v.trim().length > 0;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "11px 10px 11px 18px",
      background: "rgba(255,255,255,0.78)",
      border: hasText ? "1px solid rgba(33,120,168,0.35)" : "1px solid rgba(255,255,255,0.70)",
      backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      borderRadius: 9999,
      boxShadow: "0 4px 20px rgba(15,30,60,0.07)",
    }}>
      <input
        value={v} onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1, border: 0, outline: "none", background: "transparent",
          fontSize: 15, color: "#0D1829", fontFamily: "inherit", minWidth: 0,
        }}
      />
      <button onClick={() => onSubmit && onSubmit(v)} aria-label="enviar" style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 34, height: 34, borderRadius: 9999,
        background: hasText ? "#2178A8" : "rgba(15,30,60,0.06)",
        border: 0, cursor: "pointer",
      }}>
        <Icon name="arrow-right" weight="bold" size={14} color={hasText ? "#fff" : "#90A4B0"} />
      </button>
    </div>
  );
};

// =====================================
// AccountChip — account selector pill
// =====================================

const ACCOUNT_BRANDS = {
  "Galicia":        { color: "#FF6900" },
  "Mercado Pago":   { color: "#00B1EA" },
  "Brubank":        { color: "#7C3AED" },
  "Naranja X":      { color: "#FF6900" },
  "Efectivo":       { color: "#1A7A42" },
  "Santander":      { color: "#EC0000" },
};

const AccountChip = ({ name, active, onClick }) => {
  const brand = ACCOUNT_BRANDS[name] || { color: "#2178A8" };
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "8px 14px 8px 10px", borderRadius: 9999,
      background: active ? "#fff" : "rgba(255,255,255,0.50)",
      border: active ? "1px solid rgba(33,120,168,0.20)" : "1px solid rgba(255,255,255,0.70)",
      color: "#0D1829", fontSize: 13, fontWeight: active ? 600 : 500,
      fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
      boxShadow: active ? "0 1px 6px rgba(0,0,0,0.07)" : "none",
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: 9999, background: brand.color,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontSize: 10, fontWeight: 800, letterSpacing: "-0.02em",
      }}>{name[0]}</span>
      {name}
    </button>
  );
};

// =====================================
// Saldo Vivo Hero — one-number focal point
// =====================================

const HeroBalance = ({ totalARS = 124500.80, usd = 96.40, hidden = false, onToggle }) => {
  const [int, dec] = (totalARS).toFixed(2).split(".");
  return (
    <Card glass="1" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Label>SALDO VIVO</Label>
        <button onClick={onToggle} aria-label="ocultar" style={{
          background: "transparent", border: 0, padding: 4, cursor: "pointer",
        }}>
          <Icon name={hidden ? "eye-slash" : "eye"} size={16} color="#90A4B0" />
        </button>
      </div>
      <div style={{
        marginTop: 10, fontFamily: "var(--gota-font-display)",
        fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1,
        color: "#0D1829", fontVariantNumeric: "tabular-nums",
      }}>
        {hidden ? "$ ••••••" : (
          <>
            $ {Number(int).toLocaleString("es-AR")}
            <span style={{ color: "#B8C9D4", fontWeight: 500, fontSize: 32 }}>,{dec}</span>
          </>
        )}
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 14, fontSize: 12, color: "#90A4B0" }}>
        <span><span style={{ color: "#2178A8", fontWeight: 600 }}>ARS</span> {hidden ? "******" : Number(int).toLocaleString("es-AR")}</span>
        <span>|</span>
        <span><span style={{ color: "#2178A8", fontWeight: 600 }}>USD</span> {hidden ? "****" : usd.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
      </div>
    </Card>
  );
};

// =====================================
// Disponible Real — sub-pill under hero
// =====================================

const DisponibleReal = ({ amount = 96200, hidden = false, onClick }) => (
  <button onClick={onClick} style={{
    width: "100%", display: "flex", alignItems: "center", gap: 12,
    padding: "12px 14px",
    background: "rgba(255,255,255,0.78)",
    border: "1px solid rgba(33,120,168,0.10)",
    borderRadius: 14, cursor: "pointer", textAlign: "left",
    fontFamily: "inherit",
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: 9999,
      background: "rgba(33,120,168,0.10)",
      border: "1px solid rgba(33,120,168,0.20)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <Icon name="wallet" size={18} color="#2178A8" />
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 14, color: "#4A6070", fontWeight: 500 }}>Disponible real</div>
      <div style={{ fontSize: 11, color: "#90A4B0", marginTop: 1 }}>Descuenta deuda y consumos</div>
    </div>
    <div style={{
      fontSize: 16, fontWeight: 700, color: "#0D1829",
      fontVariantNumeric: "tabular-nums",
    }}>{hidden ? "$ ******" : fmtARS(amount)}</div>
    <Icon name="caret-right" weight="bold" size={12} color="#90A4B0" />
  </button>
);

// =====================================
// Transaction list row — cardless, bordered
// =====================================

const TxRow = ({ tx, last, onClick }) => {
  const isIncome = tx.type === "income";
  const isTransfer = tx.type === "transfer";
  const amountColor = isIncome ? "#1A7A42" : "#0D1829";
  const sign = isIncome ? "+ " : "";
  return (
    <button onClick={onClick} style={{
      width: "100%", display: "flex", alignItems: "center", gap: 12,
      padding: "13px 0",
      borderBottom: last ? "0" : "1px solid rgba(33,120,168,0.07)",
      background: "transparent", border: 0, cursor: "pointer", textAlign: "left",
      fontFamily: "inherit",
      borderTop: 0, borderLeft: 0, borderRight: 0,
    }}>
      {isIncome ? (
        <div style={{
          width: 32, height: 32, borderRadius: 9999,
          background: "rgba(26,122,66,0.10)", border: "1px solid rgba(26,122,66,0.20)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon name="arrow-circle-up" weight="duotone" size={18} color="#1A7A42" />
        </div>
      ) : isTransfer ? (
        <div style={{
          width: 32, height: 32, borderRadius: 9999,
          background: "rgba(27,126,158,0.10)", border: "1px solid rgba(27,126,158,0.20)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon name="arrows-left-right" weight="duotone" size={18} color="#1B7E9E" />
        </div>
      ) : (
        <CategoryIcon category={tx.category} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 500, color: "#0D1829",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{tx.description || tx.category}</div>
        <div style={{ fontSize: 12, color: "#90A4B0", marginTop: 1 }}>
          {tx.subtitle || `${tx.category || ""}${tx.date ? " · " + tx.date : ""}`}
        </div>
      </div>
      <div style={{
        fontSize: 16, fontWeight: 700, color: amountColor,
        fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
      }}>{sign}{fmtARS(tx.amount)}</div>
    </button>
  );
};

// =====================================
// Necesidad / Deseo distribution bar
// =====================================

const NDBar = ({ necesidad = 412300, deseo = 252900 }) => {
  const total = necesidad + deseo;
  const np = total ? (necesidad / total) * 100 : 50;
  const dp = 100 - np;
  return (
    <div>
      <div style={{ display: "flex", gap: 2, height: 6 }}>
        <div style={{ flex: np, background: "#1A7A42", borderRadius: 3 }} />
        <div style={{ flex: dp, background: "#B84A12", borderRadius: 3 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12, color: "#90A4B0" }}>
        <div>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 9999, background: "#1A7A42", marginRight: 6 }} />
          <span style={{ color: "#0D1829", fontWeight: 600 }}>{fmtARS(necesidad)}</span> Necesidad · {Math.round(np)}%
        </div>
        <div>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 9999, background: "#B84A12", marginRight: 6 }} />
          <span style={{ color: "#0D1829", fontWeight: 600 }}>{fmtARS(deseo)}</span> Deseo · {Math.round(dp)}%
        </div>
      </div>
    </div>
  );
};

// =====================================
// Donut — for commitments / progress
// =====================================

const Donut = ({ percent = 42, color = "#2178A8", trackColor = "rgba(33,120,168,0.10)", size = 64, stroke = 3, label }) => (
  <div style={{ position: "relative", width: size, height: size }}>
    <svg viewBox="0 0 36 36" width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx="18" cy="18" r="15.9155" fill="none" stroke={trackColor} strokeWidth={stroke} />
      <circle cx="18" cy="18" r="15.9155" fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${percent} 100`} strokeLinecap="round" />
    </svg>
    <div style={{
      position: "absolute", inset: 0, display: "flex",
      alignItems: "center", justifyContent: "center",
      fontSize: 13, fontWeight: 800, color: "#0D1829",
    }}>{label || `${percent}%`}</div>
  </div>
);

Object.assign(window, {
  SmartInput, AccountChip, ACCOUNT_BRANDS,
  HeroBalance, DisponibleReal, TxRow, NDBar, Donut,
});
