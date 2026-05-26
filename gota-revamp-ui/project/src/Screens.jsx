/* global React, MonthHeader, HeroCard, SectionHeader, GlassSmartInput, NativeTabBar, BottomZoneHome, FixedBottomZone, TxRow, Icon, Label, Meta, Card, Badge, CategoryIcon, fmtARS, Donut, NDBar */
// Gota — Redesigned screen compositions.
// Each Screen renders inside <Phone>, which is a static frame
// sized for the design canvas (390 × 780).

// =====================================
// Phone — lightweight device frame for canvas presentation.
// Has status bar, no Dynamic Island chrome (too noisy in canvas).
// Background is the design-system gradient stage.
// =====================================

const PHONE_W = 390;
const PHONE_H = 780;

function StatusBar() {
  return (
    <div style={{
      height: 36, display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 24px",
      fontFamily: "-apple-system, system-ui",
      fontSize: 14, fontWeight: 600, color: "#0D1829",
      flexShrink: 0,
    }}>
      <span>9:41</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* signal */}
        <svg width="17" height="11" viewBox="0 0 17 11">
          <rect x="0"   y="7"  width="3" height="4"  rx="0.7" fill="#0D1829"/>
          <rect x="4.5" y="5"  width="3" height="6"  rx="0.7" fill="#0D1829"/>
          <rect x="9"   y="2.5"width="3" height="8.5"rx="0.7" fill="#0D1829"/>
          <rect x="13.5"y="0"  width="3" height="11" rx="0.7" fill="#0D1829"/>
        </svg>
        {/* battery */}
        <svg width="25" height="11" viewBox="0 0 25 11">
          <rect x="0.5" y="0.5" width="21" height="10" rx="3" fill="none" stroke="#0D1829" strokeOpacity="0.5"/>
          <rect x="2"   y="2"   width="18" height="7"  rx="1.5" fill="#0D1829"/>
          <rect x="23"  y="4"   width="2"  height="3"  rx="0.5" fill="#0D1829" fillOpacity="0.5"/>
        </svg>
      </div>
    </div>
  );
}

function Phone({ children, bg = "linear-gradient(180deg, #F8FBFD 0%, #EEF4F8 100%)" }) {
  return (
    <div style={{
      width: PHONE_W, height: PHONE_H,
      borderRadius: 44, overflow: "hidden",
      background: bg,
      position: "relative",
      boxShadow: "0 0 0 1px rgba(13,24,41,0.06), 0 30px 60px rgba(13,24,41,0.10)",
      fontFamily: "var(--gota-font-sans)",
      color: "var(--gota-text-primary)",
      WebkitFontSmoothing: "antialiased",
      display: "flex", flexDirection: "column",
    }}>
      <StatusBar />
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>{children}</div>
    </div>
  );
}

// =====================================
// Sample data
// =====================================

const TX_SAMPLE = [
  { type: "expense",  category: "Restaurantes",  description: "Café con Lu",   subtitle: "Restaurantes · 12 may", amount: 2500 },
  { type: "income",   category: "Sueldo",        description: "Sueldo mayo",   subtitle: "Sueldo · 10 may",       amount: 850000 },
  { type: "expense",  category: "Supermercado",  description: "Coto",          subtitle: "Supermercado · 09 may", amount: 18450 },
  { type: "transfer",                            description: "Galicia → MP",  subtitle: "Para gastos · 08 may",  amount: 50000 },
  { type: "expense",  category: "Suscripciones", description: "Spotify",       subtitle: "Suscripciones · 07 may",amount: 4999 },
];

const TX_FULL = [
  { day: "Hoy · 13 mayo", items: [
    { type: "expense", category: "Restaurantes", description: "Café con Lu", subtitle: "Restaurantes · Efectivo", amount: 2500 },
    { type: "expense", category: "Transporte",   description: "SUBE",         subtitle: "Transporte · Débito",     amount: 850 },
  ]},
  { day: "Ayer · 12 mayo", items: [
    { type: "income",  category: "Sueldo",      description: "Sueldo mayo",  subtitle: "Galicia · Transferencia", amount: 850000 },
    { type: "expense", category: "Supermercado",description: "Coto",         subtitle: "Galicia · Débito",        amount: 18450 },
    { type: "transfer",                         description: "Galicia → MP", subtitle: "Para gastos del finde",   amount: 50000 },
  ]},
  { day: "Domingo · 11 mayo", items: [
    { type: "expense", category: "Suscripciones",description: "Spotify",     subtitle: "Familiar · Tarjeta",      amount: 4999 },
    { type: "expense", category: "Delivery",     description: "Rappi",       subtitle: "Pedidos Ya · MP",         amount: 12300 },
    { type: "expense", category: "Farmacia",     description: "Farmacity",   subtitle: "Salud · Débito",          amount: 8200 },
  ]},
];

// =====================================
// HomeScreen — the new design
// tabVariant: "topbar" | "pill"
// =====================================

const HomeScreen = ({ tabVariant = "topbar", bg }) => (
  <Phone bg={bg}>
    <MonthHeader month="Mayo 2026" initials="F" />

    <div style={{
      padding: "16px 18px 200px",
      overflow: "auto", height: "100%", boxSizing: "border-box",
    }}>
      <HeroCard
        saldo={124500.80}
        usd={96.40}
        disponibleReal={96200}
        compromisos={{ total: 320000, aPagar: 180000, enCurso: 140000, count: 2, nextDue: "20 may" }}
      />

      {/* Filtro N/D — quick context line */}
      <div style={{
        marginTop: 14, padding: "14px 18px",
        background: "rgba(255,255,255,0.78)",
        border: "1px solid rgba(33,120,168,0.07)",
        borderRadius: 18,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--gota-text-secondary)" }}>Necesidad / Deseo</div>
          <div style={{ fontSize: 11, color: "var(--gota-text-dim)" }}>Mes en curso</div>
        </div>
        <NDBar necesidad={412300} deseo={252900} />
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionHeader title="Últimos movimientos" action="Ver todos" />
        <div style={{
          background: "var(--gota-surface-module)",
          borderRadius: 18,
          boxShadow: "0 1px 3px rgba(13,24,41,0.05)",
          padding: "2px 16px",
          border: "1px solid rgba(33,120,168,0.06)",
        }}>
          {TX_SAMPLE.map((tx, i) => (
            <TxRow key={i} tx={tx} last={i === TX_SAMPLE.length - 1} />
          ))}
        </div>
      </div>
    </div>

    <BottomZoneHome active="home" tabVariant={tabVariant} />
  </Phone>
);

// =====================================
// MovimientosScreen — list grouped by day
// =====================================

const MovimientosScreen = ({ tabVariant = "topbar", bg }) => {
  const [filter, setFilter] = React.useState("Todos");
  const filters = ["Todos", "Gastos", "Ingresos", "Transfers"];
  return (
    <Phone bg={bg}>
      <MonthHeader month="Mayo 2026" initials="F" />

      <div style={{ padding: "12px 18px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <h1 style={{
            margin: 0, fontFamily: "var(--gota-font-display)",
            fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em",
            color: "var(--gota-text-primary)",
          }}>Movimientos</h1>
          <div style={{ fontSize: 12, color: "var(--gota-text-dim)" }}>22 este mes</div>
        </div>

        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {filters.map((f) => {
            const active = f === filter;
            return (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "7px 14px", borderRadius: 9999,
                background: active ? "var(--gota-primary)" : "rgba(255,255,255,0.78)",
                color: active ? "#fff" : "var(--gota-text-secondary)",
                border: active ? "0" : "1px solid rgba(33,120,168,0.10)",
                fontSize: 13, fontWeight: active ? 700 : 500,
                fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
                boxShadow: active ? "0 2px 8px rgba(33,120,168,0.20)" : "none",
              }}>{f}</button>
            );
          })}
        </div>
      </div>

      <div style={{
        padding: "16px 18px 140px",
        overflow: "auto", height: "100%", boxSizing: "border-box",
      }}>
        {TX_FULL.map((day, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <div style={{
              display: "flex", alignItems: "baseline", justifyContent: "space-between",
              padding: "0 4px 8px",
            }}>
              <div style={{
                fontSize: 12, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.06em", color: "var(--gota-text-secondary)",
              }}>{day.day}</div>
            </div>
            <div style={{
              background: "var(--gota-surface-module)",
              borderRadius: 18,
              boxShadow: "0 1px 3px rgba(13,24,41,0.05)",
              padding: "2px 16px",
              border: "1px solid rgba(33,120,168,0.06)",
            }}>
              {day.items.map((tx, j) => (
                <TxRow key={j} tx={tx} last={j === day.items.length - 1} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <FixedBottomZone active="mov" tabVariant={tabVariant} />
    </Phone>
  );
};

// =====================================
// AnálisisScreen
// =====================================

const CATS = [
  { name: "Supermercado", color: "#1A7A42", amount: 92400, pct: 32 },
  { name: "Restaurantes", color: "#2D8B5A", amount: 48200, pct: 17 },
  { name: "Transporte",   color: "#C4601A", amount: 32100, pct: 11 },
  { name: "Servicios",    color: "#1B7E9E", amount: 28900, pct: 10 },
  { name: "Suscripciones",color: "#2178A8", amount: 19400, pct: 7  },
];

const AnalisisScreen = ({ tabVariant = "topbar", bg }) => (
  <Phone bg={bg}>
    <MonthHeader month="Mayo 2026" initials="F" />

    <div style={{
      padding: "12px 18px 140px",
      overflow: "auto", height: "100%", boxSizing: "border-box",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{
          margin: 0, fontFamily: "var(--gota-font-display)",
          fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em",
          color: "var(--gota-text-primary)",
        }}>Análisis</h1>
        <button style={{
          padding: "6px 12px", borderRadius: 9999,
          background: "rgba(255,255,255,0.78)",
          border: "1px solid rgba(33,120,168,0.10)",
          fontSize: 12, fontWeight: 600, color: "var(--gota-text-secondary)",
          fontFamily: "inherit", cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          Mayo
          <Icon name="caret-down" weight="bold" size={10} color="currentColor" />
        </button>
      </div>

      {/* Hero KPI card */}
      <div style={{
        background: "var(--gota-surface-module)",
        borderRadius: 22,
        boxShadow: "0 4px 12px rgba(13,24,41,0.08), 0 1px 2px rgba(13,24,41,0.04)",
        border: "1px solid rgba(33,120,168,0.06)",
        padding: "20px",
      }}>
        <Label>GASTASTE EN MAYO</Label>
        <div style={{
          marginTop: 8,
          fontFamily: "var(--gota-font-display)",
          fontSize: 36, fontWeight: 800, letterSpacing: "-0.03em",
          color: "var(--gota-text-primary)", lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}>
          $ 287.400<span style={{ color: "var(--gota-text-muted)", fontWeight: 500, fontSize: 28 }}>,50</span>
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--gota-text-secondary)" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            padding: "3px 8px", borderRadius: 9999,
            background: "var(--gota-success-soft)", color: "var(--gota-success)",
            fontSize: 11, fontWeight: 700,
          }}>
            <Icon name="trend-down" weight="bold" size={10} color="currentColor" />
            12% vs. abril
          </span>
          <span style={{ color: "var(--gota-text-dim)" }}>de $ 850.000 ingresos</span>
        </div>

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--gota-separator)" }}>
          <NDBar necesidad={189800} deseo={97600} />
        </div>
      </div>

      {/* Top categorías */}
      <div style={{ marginTop: 24 }}>
        <SectionHeader title="Por categoría" action="Ver todas" />
        <div style={{
          background: "var(--gota-surface-module)",
          borderRadius: 18,
          boxShadow: "0 1px 3px rgba(13,24,41,0.05)",
          border: "1px solid rgba(33,120,168,0.06)",
          padding: "4px 18px",
        }}>
          {CATS.map((c, i) => (
            <div key={c.name} style={{
              padding: "14px 0",
              borderBottom: i === CATS.length - 1 ? "0" : "1px solid var(--gota-separator)",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <CategoryIcon category={c.name} size={36} iconSize={18} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--gota-text-primary)" }}>{c.name}</div>
                <div style={{ marginTop: 6, height: 5, borderRadius: 3, background: "rgba(33,120,168,0.08)", overflow: "hidden" }}>
                  <div style={{ width: `${c.pct * 2}%`, height: "100%", background: c.color, borderRadius: 3 }} />
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--gota-text-primary)", fontVariantNumeric: "tabular-nums" }}>
                  {fmtARS(c.amount)}
                </div>
                <div style={{ fontSize: 11, color: "var(--gota-text-dim)", marginTop: 2 }}>{c.pct}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compromisos donut card */}
      <div style={{ marginTop: 24 }}>
        <SectionHeader title="Compromisos del mes" action="Detalle" />
        <div style={{
          background: "var(--gota-surface-module)",
          borderRadius: 18,
          boxShadow: "0 1px 3px rgba(13,24,41,0.05)",
          border: "1px solid rgba(33,120,168,0.06)",
          padding: 18,
          display: "flex", alignItems: "center", gap: 18,
        }}>
          <Donut percent={42} size={72} stroke={4} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--gota-text-primary)", letterSpacing: "-0.02em" }}>
              $ 320.000
            </div>
            <div style={{ fontSize: 12, color: "var(--gota-text-secondary)", marginTop: 2 }}>
              de tu sueldo comprometido
            </div>
            <div style={{ marginTop: 8 }}>
              <Badge tone="success">Saludable</Badge>
            </div>
          </div>
        </div>
      </div>
    </div>

    <FixedBottomZone active="ana" tabVariant={tabVariant} />
  </Phone>
);

Object.assign(window, {
  Phone, HomeScreen, MovimientosScreen, AnalisisScreen,
});
