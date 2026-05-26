/* global React, TxRow, Icon, Label, fmtARS, Donut, Badge, CategoryIcon, GlassSmartInput, NativeTabBar */

// Gota — Strategy 5 ("Header zone azul")
// Home · Movimientos · Análisis — todos con el MISMO header azul.
// Data fidelity: respeta los módulos que ya existen en la app real
// (hero pills percibidos/tarjeta/pago en Movimientos; "Mayo viene N%
// abajo de tu promedio" + comparación con período anterior + insight
// pill + "Qué movió el mes" con N/D label en Análisis).

const W = 390;
const H = 780;

// =========================================
// StatBar
// =========================================
function StatBar({ light = false }) {
  const c = light ? "#FFFFFF" : "#0D1829";
  return (
    <div style={{
      height: 36, display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 24px", fontSize: 14, fontWeight: 600, color: c,
      fontFamily: "-apple-system, system-ui", flexShrink: 0,
    }}>
      <span>9:41</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <svg width="17" height="11" viewBox="0 0 17 11">
          <rect x="0"   y="7"  width="3" height="4"  rx="0.7" fill="currentColor"/>
          <rect x="4.5" y="5"  width="3" height="6"  rx="0.7" fill="currentColor"/>
          <rect x="9"   y="2.5"width="3" height="8.5"rx="0.7" fill="currentColor"/>
          <rect x="13.5"y="0"  width="3" height="11" rx="0.7" fill="currentColor"/>
        </svg>
        <svg width="25" height="11" viewBox="0 0 25 11">
          <rect x="0.5" y="0.5" width="21" height="10" rx="3" fill="none" stroke="currentColor" strokeOpacity="0.5"/>
          <rect x="2"   y="2"   width="18" height="7"  rx="1.5" fill="currentColor"/>
          <rect x="23"  y="4"   width="2"  height="3"  rx="0.5" fill="currentColor" fillOpacity="0.5"/>
        </svg>
      </div>
    </div>
  );
}

function Shell({ children }) {
  return (
    <div style={{
      width: W, height: H, borderRadius: 44, overflow: "hidden",
      background: "#FFFFFF",
      position: "relative", display: "flex", flexDirection: "column",
      boxShadow: "0 0 0 1px rgba(13,24,41,0.06), 0 30px 60px rgba(13,24,41,0.10)",
      fontFamily: "var(--gota-font-sans)", color: "#0D1829",
    }}>{children}</div>
  );
}

function BlueZone({ children, height }) {
  return (
    <div style={{
      background: `
        radial-gradient(ellipse at 100% 0%, rgba(255,255,255,0.10) 0%, transparent 50%),
        linear-gradient(180deg, #2178A8 0%, #1B6A93 100%)
      `,
      color: "#FFFFFF",
      height,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      flexShrink: 0, position: "relative",
    }}>{children}</div>
  );
}

function BlueHeader({ month = "Mayo 2026", rightSlot }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 20px 0", height: 48,
    }}>
      <button style={{
        width: 36, height: 36, borderRadius: 9999,
        background: "rgba(255,255,255,0.16)",
        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        color: "#fff", border: "1px solid rgba(255,255,255,0.22)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
      }}>F</button>
      <div style={{
        fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)",
        letterSpacing: "-0.01em",
      }}>{month}</div>
      {rightSlot || (
        <button style={{
          width: 36, height: 36, borderRadius: 9999,
          background: "rgba(255,255,255,0.16)",
          backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.22)",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}>
          <i className="ph-bold ph-plus" style={{ fontSize: 16, color: "#fff" }} />
        </button>
      )}
    </div>
  );
}

function WhiteZone({ children, overlap = false, padBottom = 200, padX = 18 }) {
  return (
    <div style={{
      flex: 1, minHeight: 0, overflow: "auto",
      padding: `0 ${padX}px ${padBottom}px`,
      marginTop: overlap ? -24 : 16,
      position: "relative",
    }}>{children}</div>
  );
}

function BZ({ active = "home", showInput = false }) {
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      background: "rgba(255,255,255,0.94)",
      backdropFilter: "blur(20px) saturate(180%)",
      WebkitBackdropFilter: "blur(20px) saturate(180%)",
      borderTop: "1px solid rgba(33,120,168,0.08)",
      boxShadow: "0 -1px 0 rgba(255,255,255,0.6) inset, 0 -8px 24px rgba(13,24,41,0.04)",
      padding: showInput ? "10px 16px 22px" : "6px 16px 22px",
    }}>
      {showInput && <><GlassSmartInput placeholder="¿Qué gastaste?" /><div style={{ height: 6 }} /></>}
      <NativeTabBar variant="topbar" active={active} integrated />
    </div>
  );
}

function SH({ title, action }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", justifyContent: "space-between",
      padding: "0 4px 12px",
    }}>
      <h3 style={{
        margin: 0, fontFamily: "var(--gota-font-display)",
        fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em",
        color: "#0D1829",
      }}>{title}</h3>
      {action && (
        <button style={{
          background: "transparent", border: 0, padding: 0,
          fontFamily: "inherit", fontSize: 13, fontWeight: 600,
          color: "#2178A8", cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 3,
        }}>
          {action}
          <i className="ph-bold ph-caret-right" style={{ fontSize: 10 }} />
        </button>
      )}
    </div>
  );
}

function WCard({ children, padding = 18, style }) {
  return (
    <div style={{
      background: "#FFFFFF", borderRadius: 18,
      boxShadow: "0 4px 14px rgba(8,40,70,0.06), 0 1px 2px rgba(13,24,41,0.04)",
      border: "1px solid rgba(13,24,41,0.04)",
      padding, ...style,
    }}>{children}</div>
  );
}

// =========================================
// HOME (unchanged from previous version, kept here)
// =========================================
const TX_S5 = [
  { type: "expense",  category: "Restaurantes",  description: "Café con Lu",   subtitle: "Restaurantes · 12 may", amount: 2500 },
  { type: "income",   category: "Sueldo",        description: "Sueldo mayo",   subtitle: "Sueldo · 10 may",       amount: 850000 },
  { type: "expense",  category: "Supermercado",  description: "Coto",          subtitle: "Supermercado · 09 may", amount: 18450 },
  { type: "transfer",                            description: "Galicia → MP",  subtitle: "Para gastos · 08 may",  amount: 50000 },
];

const S5_Home = () => (
  <Shell>
    <BlueZone height={236}>
      <StatBar light />
      <BlueHeader />
      <div style={{ padding: "16px 22px 0" }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.09em",
          textTransform: "uppercase", color: "rgba(255,255,255,0.72)",
        }}>SALDO VIVO
          <i className="ph ph-eye" style={{ fontSize: 13, marginLeft: 8, opacity: 0.6, verticalAlign: "middle" }} />
        </div>
        <div style={{
          marginTop: 10, fontFamily: "var(--gota-font-display)",
          fontSize: 42, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1,
          color: "#FFFFFF", fontVariantNumeric: "tabular-nums",
        }}>
          $ 124.500<span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 500, fontSize: 32 }}>,80</span>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 14, fontSize: 12, color: "rgba(255,255,255,0.72)" }}>
          <span><span style={{ color: "#fff", fontWeight: 700 }}>ARS</span> 124.500</span>
          <span style={{ opacity: 0.4 }}>|</span>
          <span><span style={{ color: "#fff", fontWeight: 700 }}>USD</span> 96,40</span>
        </div>
      </div>
    </BlueZone>

    <WhiteZone overlap>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <WCard>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 9999,
              background: "rgba(33,120,168,0.09)", border: "1px solid rgba(33,120,168,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <i className="ph ph-wallet" style={{ fontSize: 19, color: "#2178A8" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: "#4A6070", fontWeight: 500 }}>Disponible real</div>
              <div style={{ fontSize: 11, color: "#90A4B0", marginTop: 2 }}>Ya descuenta deuda y consumos</div>
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#0D1829", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>
              $ 96.200
            </div>
            <i className="ph-bold ph-caret-right" style={{ fontSize: 11, color: "#B8C9D4", marginLeft: 6 }} />
          </div>
        </WCard>

        <WCard>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 9999,
              background: "rgba(184,74,18,0.10)", border: "1px solid rgba(184,74,18,0.20)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <i className="ph ph-credit-card" style={{ fontSize: 19, color: "#B84A12" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: "#4A6070", fontWeight: 500 }}>Compromisos en tarjetas</div>
              <div style={{ fontSize: 11, color: "#90A4B0", marginTop: 2 }}>2 vencimientos · próximo 20 may</div>
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#0D1829", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}>
              $ 320.000
            </div>
            <i className="ph-bold ph-caret-right" style={{ fontSize: 11, color: "#B8C9D4", marginLeft: 6 }} />
          </div>
          <div style={{
            marginTop: 14, height: 6, borderRadius: 3,
            background: "rgba(33,120,168,0.08)", display: "flex", overflow: "hidden",
          }}>
            <div style={{ width: "56%", background: "#E89A4C" }} />
            <div style={{ width: "44%", background: "#2178A8" }} />
          </div>
          <div style={{
            marginTop: 10, display: "flex", justifyContent: "space-between",
            fontSize: 11, color: "#4A6070",
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: 9999, background: "#E89A4C" }} />
              A pagar <span style={{ fontWeight: 700, color: "#0D1829", fontVariantNumeric: "tabular-nums" }}>$ 180.000</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: 9999, background: "#2178A8" }} />
              En curso <span style={{ fontWeight: 700, color: "#0D1829", fontVariantNumeric: "tabular-nums" }}>$ 140.000</span>
            </span>
          </div>
        </WCard>
      </div>

      <div style={{ marginTop: 22 }}>
        <SH title="Últimos movimientos" action="Ver todos" />
        <WCard padding="2px 16px">
          {TX_S5.map((tx, i) => <TxRow key={i} tx={tx} last={i === TX_S5.length - 1} />)}
        </WCard>
      </div>
    </WhiteZone>

    <BZ active="home" showInput />
  </Shell>
);

// =========================================
// MOVIMIENTOS — Strategy 5
// Header azul (mismo que Home) → hero card de 3 pills (overlap)
// → fila de filtros (Todos / Gastos / Ingresos / Tarjetas + funnel)
// → lista agrupada por día
// =========================================

const HeroPill = ({ icon, iconColor, iconBg, iconBorder, label, amount, sub, amountColor }) => (
  <div style={{
    flex: 1, padding: "14px 8px 10px",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
    textAlign: "center", minWidth: 0,
  }}>
    <div style={{
      width: 40, height: 40, borderRadius: 9999,
      background: iconBg, border: `1px solid ${iconBorder}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      marginBottom: 4,
    }}>
      <i className={`ph ${icon}`} style={{ fontSize: 20, color: iconColor }} />
    </div>
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.09em",
      textTransform: "uppercase", color: "#4A6070",
      lineHeight: 1.2, minHeight: 24,
    }}>{label}</div>
    <div style={{
      fontFamily: "var(--gota-font-display)",
      fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em",
      color: amountColor, fontVariantNumeric: "tabular-nums", lineHeight: 1,
    }}>{amount}</div>
    <div style={{ fontSize: 10, color: "#90A4B0", lineHeight: 1.3 }}>{sub}</div>
  </div>
);

const TX_DAYS = [
  { day: "Sábado, 23 de mayo", items: [
    { type: "expense", category: "Casa/Mantenimiento", description: "Pintura", subtitle: "Casa/Mantenimiento · 23 may · Cuota 1/3", amount: 42000 },
  ]},
  { day: "Miércoles, 20 de mayo", items: [
    { type: "expense", category: "Auto/Mantenimiento", description: "Auto",     subtitle: "Auto/Mantenimiento · 20 may", amount: 7800 },
    { type: "expense", category: "Supermercado",      description: "Despensa", subtitle: "Supermercado · 20 may",      amount: 10000 },
    { type: "expense", category: "Kiosco y Varios",   description: "Kiosco",   subtitle: "Kiosco y Varios · 20 may",   amount: 7000 },
    { type: "expense", category: "Restaurantes",      description: "Comida oficina", subtitle: "Restaurantes · 20 may", amount: 16000 },
  ]},
];

const S5_Movimientos = () => {
  const filters = [
    { id: "all", label: "Todos", active: true },
    { id: "exp", label: "Gastos" },
    { id: "inc", label: "Ingresos" },
    { id: "trf", label: "Tarjetas" },
  ];
  return (
    <Shell>
      <BlueZone height={120}>
        <StatBar light />
        <BlueHeader />
      </BlueZone>

      <WhiteZone overlap padBottom={140}>
        {/* Hero 3-pills card (overlaps blue) */}
        <WCard padding={0}>
          <div style={{ display: "flex", alignItems: "stretch" }}>
            <HeroPill
              icon="ph-wallet"
              iconColor="#B84A12" iconBg="rgba(184,74,18,0.10)" iconBorder="rgba(184,74,18,0.20)"
              label="PERCIBIDOS"
              amount="$ 2M"
              sub="Gasto directo del mes"
              amountColor="#B84A12"
            />
            <div style={{ width: 1, background: "rgba(33,120,168,0.10)", margin: "16px 0" }} />
            <HeroPill
              icon="ph-credit-card"
              iconColor="#2178A8" iconBg="rgba(33,120,168,0.10)" iconBorder="rgba(33,120,168,0.18)"
              label="TARJETA"
              amount="$ 1.1M"
              sub="Aún sin pagar"
              amountColor="#2178A8"
            />
            <div style={{ width: 1, background: "rgba(33,120,168,0.10)", margin: "16px 0" }} />
            <HeroPill
              icon="ph-arrow-circle-down"
              iconColor="#1A7A42" iconBg="rgba(26,122,66,0.10)" iconBorder="rgba(26,122,66,0.20)"
              label="PAGO TARJETA"
              amount="$ 2.2M"
              sub="Pagos del mes"
              amountColor="#1A7A42"
            />
          </div>
        </WCard>

        {/* Filter chips + funnel */}
        <div style={{
          marginTop: 18, display: "flex", alignItems: "center", gap: 8,
          overflowX: "auto", paddingBottom: 4,
        }}>
          {filters.map(f => (
            <button key={f.id} style={{
              padding: "7px 16px", borderRadius: 9999,
              background: f.active ? "#2178A8" : "#FFFFFF",
              color: f.active ? "#FFFFFF" : "#0D1829",
              border: f.active ? "0" : "1px solid rgba(33,120,168,0.16)",
              fontSize: 13, fontWeight: 700,
              fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
              boxShadow: f.active ? "0 2px 8px rgba(33,120,168,0.22)" : "0 1px 2px rgba(13,24,41,0.04)",
            }}>{f.label}</button>
          ))}
          <button style={{
            marginLeft: "auto",
            width: 36, height: 36, borderRadius: 9999,
            background: "#FFFFFF",
            border: "1px solid rgba(33,120,168,0.16)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}>
            <i className="ph ph-funnel" style={{ fontSize: 16, color: "#2178A8" }} />
          </button>
        </div>

        {/* Day-grouped list */}
        <div style={{ marginTop: 12 }}>
          {TX_DAYS.map((d, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 12, fontWeight: 500,
                color: "#4A6070",
                padding: "10px 4px 8px",
              }}>{d.day}</div>
              <WCard padding="2px 16px">
                {d.items.map((tx, j) => (
                  <TxRow key={j} tx={tx} last={j === d.items.length - 1} />
                ))}
              </WCard>
            </div>
          ))}
        </div>
      </WhiteZone>

      <BZ active="mov" />
    </Shell>
  );
};

// =========================================
// ANÁLISIS — Strategy 5
// Header azul + Mes-picker + Explorar pill (con badge)
// Hero: "Mayo viene 34% abajo de tu promedio" + $3.169.054 + sparkline
// White: segmented Percibidos/Todo el gasto + comparación Abr/-X%/May
// → "Qué movió el mes" + insight pill + categorías con barras N/D
// =========================================

function Sparkline({ width = 84, height = 44 }) {
  // little upward+down curve
  return (
    <svg width={width} height={height} viewBox="0 0 84 44" fill="none">
      <path d="M2 38 L14 28 L26 30 L38 14 L50 22 L62 10 L76 18"
        stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="76" cy="18" r="3.5" fill="#FFFFFF" />
      <circle cx="76" cy="18" r="6" fill="#FFFFFF" fillOpacity="0.25" />
    </svg>
  );
}

const CATEGORIES = [
  { name: "Casa/Mantenimiento", icon: "ph-wrench", color: "#2178A8", tx: 6, avg: 108569, amount: 651414, pct: 21, type: "Necesidad", typeColor: "#2178A8", iconBg: "rgba(33,120,168,0.10)", barColor: "#2178A8" },
  { name: "Supermercado",       icon: "ph-shopping-cart", color: "#1A7A42", tx: 19, sub: "compras este mes", amount: 317486, pct: 10, type: "Mixto", typeColor: "#4A6070", iconBg: "rgba(26,122,66,0.10)", barColor: "#1A7A42" },
  { name: "Alimentos",          icon: "ph-storefront", color: "#1A7A42", tx: 12, sub: "transacciones", amount: 268770, pct: 9, type: "Necesidad", typeColor: "#2178A8", iconBg: "rgba(26,122,66,0.10)", barColor: "#1A7A42" },
];

const S5_Analisis = () => (
  <Shell>
    <BlueZone height={300}>
      <StatBar light />
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 20px 0", height: 48,
      }}>
        {/* Month picker on left */}
        <button style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 14px", borderRadius: 9999,
          background: "rgba(255,255,255,0.16)",
          border: "1px solid rgba(255,255,255,0.22)",
          backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
          color: "#FFFFFF",
          fontFamily: "var(--gota-font-display)",
          fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em",
          cursor: "pointer",
        }}>
          Mayo
          <i className="ph-bold ph-caret-down" style={{ fontSize: 11 }} />
        </button>

        {/* Explorar pill with badge */}
        <button style={{
          position: "relative",
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 14px", borderRadius: 9999,
          background: "rgba(255,255,255,0.16)",
          border: "1px solid rgba(255,255,255,0.22)",
          backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
          color: "#FFFFFF",
          fontSize: 13, fontWeight: 600,
          fontFamily: "inherit", cursor: "pointer",
        }}>
          <i className="ph ph-squares-four" style={{ fontSize: 14 }} />
          Explorar
          <span style={{
            position: "absolute", top: -4, right: -4,
            minWidth: 18, height: 18, padding: "0 5px",
            borderRadius: 9999, background: "#A61E1E",
            color: "#FFFFFF", fontSize: 10, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #2178A8",
          }}>1</span>
        </button>
      </div>

      {/* Hero */}
      <div style={{ padding: "16px 22px 0" }}>
        <div style={{
          fontFamily: "var(--gota-font-display)",
          fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15,
          color: "#FFFFFF",
        }}>
          Mayo viene <span style={{
            background: "rgba(150,220,180,0.30)", padding: "1px 6px", borderRadius: 6,
            color: "#D1F5E0",
          }}>34% abajo</span><br/>de tu promedio
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 10 }}>
          <div>
            <div style={{
              fontFamily: "var(--gota-font-display)",
              fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1,
              color: "#FFFFFF", fontVariantNumeric: "tabular-nums",
            }}>$ 3.169.054</div>
            <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.72)" }}>
              vs ritmo reciente <span style={{ color: "#9CE6B5", fontWeight: 700 }}>-34%</span>
            </div>
          </div>
          <Sparkline />
        </div>
      </div>
    </BlueZone>

    <WhiteZone overlap padBottom={140}>
      {/* Segmented Percibidos / Todo el gasto */}
      <div style={{
        background: "#EDF1F4",
        borderRadius: 9999,
        padding: 4,
        display: "flex",
        boxShadow: "0 2px 6px rgba(13,24,41,0.04)",
      }}>
        <button style={{
          flex: 1, padding: "10px 14px", borderRadius: 9999,
          background: "transparent", border: 0, cursor: "pointer",
          fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: "#4A6070",
        }}>Percibidos</button>
        <button style={{
          flex: 1, padding: "10px 14px", borderRadius: 9999,
          background: "#2178A8", color: "#FFFFFF", border: 0, cursor: "pointer",
          fontFamily: "inherit", fontSize: 14, fontWeight: 700,
          boxShadow: "0 2px 8px rgba(33,120,168,0.22)",
        }}>Todo el gasto</button>
      </div>

      {/* Abril vs Mayo comparison */}
      <div style={{
        marginTop: 18, padding: "16px 18px",
        background: "#FFFFFF", borderRadius: 16,
        border: "1px solid rgba(13,24,41,0.04)",
        boxShadow: "0 1px 2px rgba(13,24,41,0.03)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 12, color: "#90A4B0" }}>Abr</div>
          <div style={{
            fontFamily: "var(--gota-font-display)", fontSize: 22, fontWeight: 800,
            color: "#0D1829", letterSpacing: "-0.02em", marginTop: 2,
            fontVariantNumeric: "tabular-nums",
          }}>$ 5.1M</div>
          <div style={{ fontSize: 11, color: "#90A4B0", marginTop: 2 }}>mes completo</div>
        </div>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        }}>
          <span style={{
            color: "#1A7A42", fontWeight: 800, fontSize: 18, letterSpacing: "-0.02em",
          }}>-38%</span>
          <div style={{ width: 36, height: 1, background: "rgba(33,120,168,0.20)" }} />
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "#90A4B0" }}>May</div>
          <div style={{
            fontFamily: "var(--gota-font-display)", fontSize: 22, fontWeight: 800,
            color: "#0D1829", letterSpacing: "-0.02em", marginTop: 2,
            fontVariantNumeric: "tabular-nums",
          }}>$ 3.2M</div>
          <div style={{ fontSize: 11, color: "#90A4B0", marginTop: 2 }}>al día 26</div>
        </div>
      </div>

      {/* Qué movió el mes + insight pill */}
      <div style={{ marginTop: 24, display: "flex", alignItems: "flex-start", gap: 12 }}>
        <h2 style={{
          margin: 0, fontFamily: "var(--gota-font-display)",
          fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em",
          color: "#0D1829", lineHeight: 1.1, flex: "0 0 auto", maxWidth: "50%",
        }}>Qué movió<br/>el mes</h2>
        <div style={{
          display: "inline-flex", alignItems: "center",
          padding: "9px 14px", borderRadius: 9999,
          background: "rgba(184,74,18,0.10)",
          border: "1px solid rgba(184,74,18,0.16)",
          color: "#B84A12", fontSize: 12, fontWeight: 600, lineHeight: 1.3,
        }}>
          86 gastos chicos explican 70% del mes
        </div>
      </div>

      {/* Categories */}
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        {CATEGORIES.map((c, i) => (
          <div key={i} style={{ padding: "0 4px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 9999, background: c.iconBg,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <i className={`ph ${c.icon}`} style={{ fontSize: 20, color: c.color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0D1829", letterSpacing: "-0.01em" }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: "#90A4B0", marginTop: 2 }}>
                      {c.tx} {c.sub || (c.avg ? `transacciones · promedio ${fmtARS(c.avg)}` : "transacciones")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 2,
                      fontFamily: "var(--gota-font-display)",
                      fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em",
                      color: "#0D1829", fontVariantNumeric: "tabular-nums",
                    }}>
                      {fmtARS(c.amount).replace(",00", "")}
                      <i className="ph-bold ph-caret-right" style={{ fontSize: 11, color: "#B8C9D4", marginLeft: 2 }} />
                    </div>
                    <div style={{ fontSize: 11, color: "#2178A8", fontWeight: 600, marginTop: 2 }}>
                      {c.pct}% del mes
                    </div>
                  </div>
                </div>

                {/* progress bar + N/D label */}
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    flex: 1, height: 5, borderRadius: 3,
                    background: "rgba(33,120,168,0.10)", overflow: "hidden",
                  }}>
                    <div style={{ width: `${Math.min(c.pct * 3, 100)}%`, height: "100%", background: c.barColor, borderRadius: 3 }} />
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: c.typeColor,
                  }}>{c.type}</span>
                </div>
              </div>
            </div>
            {i < CATEGORIES.length - 1 && (
              <div style={{ marginTop: 14, borderBottom: "1px solid rgba(33,120,168,0.08)" }} />
            )}
          </div>
        ))}
      </div>
    </WhiteZone>

    <BZ active="ana" />
  </Shell>
);

Object.assign(window, { S5_Home, S5_Movimientos, S5_Analisis });
