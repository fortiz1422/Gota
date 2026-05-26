/* global React, Card, Icon, Label, Meta, CategoryIcon, fmt, fmtARS, mask, hexAlpha, Badge */
// Gota — Redesigned modules (PWA → Native exploration, May 2026)
// New: MonthHeader · HeroCard · NativeTabBar · GlassSmartInput · SectionHeader
// All follow existing tokens from colors_and_type.css

const { useState: useStateN } = React;

// =====================================
// MonthHeader — Avatar | Month label centered | Plus
// Adds context (which month) without a sheet/picker — pure label.
// Same row layout as today, just fills the empty center.
// =====================================

const MonthHeader = ({ month = "Mayo 2026", initials = "F", onAvatar, onAdd }) => (
  <header style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "8px 20px 0", height: 48,
  }}>
    <button onClick={onAvatar} aria-label="Cuenta" style={{
      width: 36, height: 36, borderRadius: 9999,
      background: "var(--theme-avatar-grad, linear-gradient(135deg, #2178A8 0%, #1B7E9E 100%))",
      color: "#fff", border: 0, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 14, fontWeight: 700, fontFamily: "inherit",
      letterSpacing: "-0.02em",
      boxShadow: "0 1px 3px rgba(13,24,41,0.10)",
    }}>{initials}</button>

    <div style={{
      fontFamily: "var(--gota-font-display)",
      fontSize: 14, fontWeight: 600,
      color: "var(--gota-text-secondary)",
      letterSpacing: "-0.01em",
    }}>{month}</div>

    <button onClick={onAdd} aria-label="Agregar" style={{
      width: 36, height: 36, borderRadius: 9999,
      background: "var(--gota-primary-soft)",
      border: "1px solid rgba(33,120,168,0.14)",
      color: "var(--gota-primary)",
      cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <Icon name="plus" weight="bold" size={16} color="#2178A8" />
    </button>
  </header>
);

// =====================================
// HeroCard — elevated surface unifying Saldo Vivo + Disponible Real + Compromisos
// Top section: white surface, the Saldo Vivo hero
// Bottom section: bg-secondary, the commitments summary (inner border-t)
// =====================================

const HeroCard = ({
  saldo = 124500.80, usd = 96.40,
  disponibleReal = 96200,
  compromisos = { total: 320000, aPagar: 180000, enCurso: 140000, count: 2, nextDue: "12 may" },
  hidden = false, onToggle,
  showCompromisos = true,
}) => {
  const [intP, decP] = saldo.toFixed(2).split(".");
  const total = Math.max(compromisos.total, 1);
  const ratioPagar = (compromisos.aPagar / total) * 100;
  const ratioEnCurso = (compromisos.enCurso / total) * 100;

  return (
    <div style={{
      background: "var(--gota-surface-module)",
      borderRadius: 22,
      boxShadow: "0 4px 12px rgba(13,24,41,0.08), 0 1px 2px rgba(13,24,41,0.04)",
      border: "1px solid rgba(33,120,168,0.06)",
      overflow: "hidden",
    }}>
      {/* TOP: Saldo Vivo */}
      <div style={{ padding: "20px 20px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Label>SALDO VIVO</Label>
          <button onClick={onToggle} aria-label="Ocultar" style={{
            background: "transparent", border: 0, padding: 4, cursor: "pointer",
            display: "flex", alignItems: "center",
          }}>
            <Icon name={hidden ? "eye-slash" : "eye"} size={16} color="#90A4B0" />
          </button>
        </div>

        <div style={{
          marginTop: 10,
          fontFamily: "var(--gota-font-display)",
          fontSize: 40, fontWeight: 800,
          letterSpacing: "-0.03em", lineHeight: 1,
          color: "var(--gota-text-primary)",
          fontVariantNumeric: "tabular-nums",
        }}>
          {hidden ? "$ ••••••" : (
            <>
              $ {Number(intP).toLocaleString("es-AR")}
              <span style={{ color: "var(--gota-text-muted)", fontWeight: 500, fontSize: 30 }}>,{decP}</span>
            </>
          )}
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 14, fontSize: 12, color: "#90A4B0" }}>
          <span><span style={{ color: "var(--gota-primary)", fontWeight: 700 }}>ARS</span>{"  "}{hidden ? "******" : Number(intP).toLocaleString("es-AR")}</span>
          <span style={{ color: "#C8D5DE" }}>|</span>
          <span><span style={{ color: "var(--gota-primary)", fontWeight: 700 }}>USD</span>{"  "}{hidden ? "****" : usd.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</span>
        </div>

        {/* Disponible real */}
        <button style={{
          marginTop: 16, paddingTop: 14,
          borderTop: "1px solid var(--gota-separator)",
          display: "flex", alignItems: "center", gap: 12,
          width: "100%", background: "transparent", border: 0,
          borderTopWidth: 1, borderTopStyle: "solid", borderTopColor: "var(--gota-separator)",
          cursor: "pointer", textAlign: "left", fontFamily: "inherit", padding: "14px 0 0",
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 9999,
            background: "var(--gota-primary-soft)",
            border: "1px solid rgba(33,120,168,0.18)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Icon name="wallet" weight="regular" size={19} color="#2178A8" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, color: "var(--gota-text-secondary)", fontWeight: 500 }}>Disponible real</div>
            <div style={{ fontSize: 11, color: "var(--gota-text-dim)", marginTop: 2 }}>Ya descuenta deuda y consumos</div>
          </div>
          <div style={{
            fontSize: 16, fontWeight: 800, color: "var(--gota-text-primary)",
            fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em",
          }}>{hidden ? "$ ******" : fmtARS(disponibleReal)}</div>
          <Icon name="caret-right" weight="bold" size={12} color="#B8C9D4" />
        </button>
      </div>

      {/* BOTTOM: Compromisos — bg-secondary, inner border-t */}
      {showCompromisos && (
        <button style={{
          background: "var(--gota-bg-tertiary)",
          padding: "16px 20px",
          width: "100%",
          border: 0, borderTop: "1px solid rgba(33,120,168,0.08)",
          cursor: "pointer", textAlign: "left", fontFamily: "inherit",
          display: "block",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 9999,
              background: "rgba(255,255,255,0.72)",
              border: "1px solid rgba(33,120,168,0.14)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Icon name="credit-card" weight="regular" size={19} color="#2178A8" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: "var(--gota-text-secondary)", fontWeight: 500 }}>Compromisos en tarjetas</div>
              <div style={{ fontSize: 11, color: "var(--gota-text-dim)", marginTop: 2 }}>
                {compromisos.count} vencimientos · próximo {compromisos.nextDue}
              </div>
            </div>
            <div style={{
              fontSize: 16, fontWeight: 800, color: "var(--gota-text-primary)",
              fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em",
            }}>{hidden ? "$ ******" : fmtARS(compromisos.total)}</div>
            <Icon name="caret-right" weight="bold" size={12} color="#B8C9D4" />
          </div>

          <div style={{
            marginTop: 12, height: 6, borderRadius: 3,
            background: "rgba(33,120,168,0.10)",
            display: "flex", overflow: "hidden",
          }}>
            <div style={{ width: `${ratioPagar}%`, background: "var(--gota-warning)" }} />
            <div style={{ width: `${ratioEnCurso}%`, background: "var(--gota-primary)" }} />
          </div>

          <div style={{
            marginTop: 10, display: "flex", justifyContent: "space-between",
            fontSize: 12, color: "var(--gota-text-secondary)",
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 9999, background: "var(--gota-warning)" }} />
              A pagar <span style={{ fontWeight: 700, color: "var(--gota-text-primary)", fontVariantNumeric: "tabular-nums" }}>{hidden ? "******" : fmtARS(compromisos.aPagar)}</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 9999, background: "var(--gota-primary)" }} />
              En curso <span style={{ fontWeight: 700, color: "var(--gota-text-primary)", fontVariantNumeric: "tabular-nums" }}>{hidden ? "******" : fmtARS(compromisos.enCurso)}</span>
            </span>
          </div>
        </button>
      )}
    </div>
  );
};

// =====================================
// SectionHeader — "Últimos movimientos" + "Ver todos →"
// =====================================

const SectionHeader = ({ title, action = "Ver todos", onAction }) => (
  <div style={{
    display: "flex", alignItems: "baseline", justifyContent: "space-between",
    padding: "0 4px 12px",
  }}>
    <h3 style={{
      margin: 0, fontFamily: "var(--gota-font-display)",
      fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em",
      color: "var(--gota-text-primary)",
    }}>{title}</h3>
    <button onClick={onAction} style={{
      background: "transparent", border: 0, padding: 0,
      fontFamily: "inherit", fontSize: 13, fontWeight: 600,
      color: "var(--gota-primary)", cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 3,
    }}>
      {action}
      <Icon name="caret-right" weight="bold" size={10} color="currentColor" />
    </button>
  </div>
);

// =====================================
// GlassSmartInput — collapsed state more reconocible
// Glass pill, placeholder visible, ✦ sparkle indicator on the right,
// arrow becomes the affordance once typing.
// =====================================

const GlassSmartInput = ({ placeholder = "¿Qué gastaste?", value: initialValue = "", onSubmit, sparkle = true }) => {
  const [v, setV] = useStateN(initialValue);
  const hasText = v.trim().length > 0;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "8px 8px 8px 18px", minHeight: 48,
      background: "rgba(255,255,255,0.78)",
      border: "1px solid rgba(255,255,255,0.90)",
      backdropFilter: "blur(20px) saturate(180%)",
      WebkitBackdropFilter: "blur(20px) saturate(180%)",
      borderRadius: 9999,
      boxShadow: "0 4px 16px rgba(13,24,41,0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
    }}>
      <input
        value={v} onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1, border: 0, outline: "none", background: "transparent",
          fontSize: 15, fontWeight: 500, color: "var(--gota-text-primary)",
          fontFamily: "inherit", minWidth: 0,
        }}
      />
      {/* Sparkle indicator (IA) — when no text */}
      {sparkle && !hasText && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "5px 10px 5px 8px", borderRadius: 9999,
          background: "var(--gota-primary-soft)",
          color: "var(--gota-primary)",
          fontSize: 11, fontWeight: 600,
        }}>
          <Icon name="sparkle" weight="bold" size={11} color="currentColor" />
          IA
        </div>
      )}
      <button onClick={() => onSubmit && onSubmit(v)} aria-label="Enviar" style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 32, height: 32, borderRadius: 9999,
        background: hasText ? "var(--gota-primary)" : "rgba(15,30,60,0.06)",
        border: 0, cursor: "pointer", flexShrink: 0,
      }}>
        <Icon name="arrow-right" weight="bold" size={14} color={hasText ? "#fff" : "#90A4B0"} />
      </button>
    </div>
  );
};

// =====================================
// NativeTabBar — two variants
// variant="topbar"  → 2px indicator above active icon (iOS Wallet pattern)
// variant="pill"    → primary-soft pill background around active item
// variant="minimal" → current state (for the comparison artboards)
// =====================================

const TAB_ITEMS = [
  { id: "home", icon: "house", label: "Inicio" },
  { id: "mov",  icon: "list-bullets", label: "Movimientos" },
  { id: "ana",  icon: "chart-bar", label: "Análisis" },
];

const NativeTabBar = ({
  variant = "topbar",
  active = "home",
  onChange,
  integrated = false,
  showInput = false,
}) => {
  const items = TAB_ITEMS;

  const TabItem = ({ id, icon, label }) => {
    const isActive = id === active;
    const color = isActive ? "var(--gota-primary)" : "var(--gota-text-dim)";

    if (variant === "pill") {
      return (
        <button onClick={() => onChange?.(id)} style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          padding: "8px 6px", margin: "0 2px",
          background: isActive ? "var(--gota-primary-soft)" : "transparent",
          borderRadius: 14, border: 0, cursor: "pointer", fontFamily: "inherit",
          transition: "background 200ms",
        }}>
          <Icon name={icon} weight={isActive ? "fill" : "regular"} size={20} color={color} />
          <span style={{
            fontSize: 11, fontWeight: isActive ? 700 : 500,
            color, letterSpacing: "-0.005em",
          }}>{label}</span>
        </button>
      );
    }

    if (variant === "topbar") {
      return (
        <button onClick={() => onChange?.(id)} style={{
          flex: 1, position: "relative",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          padding: "10px 6px 8px",
          background: "transparent", border: 0, cursor: "pointer", fontFamily: "inherit",
        }}>
          <div style={{
            position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
            width: 28, height: 2,
            borderRadius: 2,
            background: isActive ? "var(--gota-primary)" : "transparent",
            transition: "background 200ms",
          }} />
          <Icon name={icon} weight={isActive ? "fill" : "regular"} size={20} color={color} />
          <span style={{
            fontSize: 11, fontWeight: isActive ? 700 : 500,
            color, letterSpacing: "-0.005em",
          }}>{label}</span>
        </button>
      );
    }

    // minimal (current)
    return (
      <button onClick={() => onChange?.(id)} style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        padding: "10px 6px", background: "transparent", border: 0, cursor: "pointer", fontFamily: "inherit",
      }}>
        <Icon name={icon} weight={isActive ? "bold" : "regular"} size={18} color={color} />
        <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 400, color }}>{label}</span>
      </button>
    );
  };

  const inner = (
    <div style={{ display: "flex", alignItems: "stretch" }}>
      {items.map(it => <TabItem key={it.id} {...it} />)}
    </div>
  );

  // Integrated (inside BottomZone on Home): no chrome of its own.
  if (integrated) {
    return <div style={{ paddingTop: 4 }}>{inner}</div>;
  }

  // Fixed standalone (otras rutas) — same glass shell as Home for consistency.
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      background: "rgba(255,255,255,0.92)",
      backdropFilter: "blur(20px) saturate(180%)",
      WebkitBackdropFilter: "blur(20px) saturate(180%)",
      borderTop: "1px solid rgba(33,120,168,0.08)",
      boxShadow: "0 -1px 0 rgba(255,255,255,0.6) inset, 0 -8px 24px rgba(13,24,41,0.04)",
      paddingBottom: 22,
    }}>
      {inner}
    </div>
  );
};

// =====================================
// BottomZoneHome — composite: SmartInput + integrated TabBar
// Same glass treatment regardless of route. Identical visual shell.
// =====================================

const BottomZoneHome = ({ active = "home", onChange, tabVariant = "topbar" }) => (
  <div style={{
    position: "absolute", left: 0, right: 0, bottom: 0,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    borderTop: "1px solid rgba(33,120,168,0.08)",
    boxShadow: "0 -1px 0 rgba(255,255,255,0.6) inset, 0 -8px 24px rgba(13,24,41,0.04)",
    padding: "10px 16px 22px",
  }}>
    <GlassSmartInput placeholder="¿Qué gastaste?" />
    <div style={{ height: 6 }} />
    <NativeTabBar variant={tabVariant} active={active} onChange={onChange} integrated />
  </div>
);

// =====================================
// FixedBottomZone — for non-Home routes (Movimientos / Análisis)
// Same shell as Home so the visual identity carries across.
// =====================================

const FixedBottomZone = ({ active = "mov", onChange, tabVariant = "topbar" }) => (
  <div style={{
    position: "absolute", left: 0, right: 0, bottom: 0,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    borderTop: "1px solid rgba(33,120,168,0.08)",
    boxShadow: "0 -1px 0 rgba(255,255,255,0.6) inset, 0 -8px 24px rgba(13,24,41,0.04)",
    padding: "8px 16px 22px",
  }}>
    <NativeTabBar variant={tabVariant} active={active} onChange={onChange} integrated />
  </div>
);

Object.assign(window, {
  MonthHeader, HeroCard, SectionHeader, GlassSmartInput,
  NativeTabBar, BottomZoneHome, FixedBottomZone, TAB_ITEMS,
});
