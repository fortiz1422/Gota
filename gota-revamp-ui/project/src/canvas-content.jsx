/* global React, ReactDOM,
   DesignCanvas, DCSection, DCArtboard, DCPostIt,
   MonthHeader, HeroCard, SectionHeader, GlassSmartInput,
   NativeTabBar, BottomZoneHome, FixedBottomZone,
   HomeScreen, MovimientosScreen, AnalisisScreen, Phone,
   TxRow, Icon, Label, fmtARS, NDBar,
   PALETTES, ThemedHome, PaletteCard,
   S1_Neutral, S2_Inverted, S3_Monochromatic, S4_Cardless, S5_Header,
   S5_Home, S5_Movimientos, S5_Analisis,
   S5_Menu, S5_Explorar, S5_Insights, S5_Presupuesto, S5_Metas */

const PHONE_W = 390;
const PHONE_H = 780;

// =====================================
// HomeAntes — the CURRENT state, reproduced from the brief's diagnostic.
// Hero sin framing · sin contexto de mes · SmartInput gris · TabBar minimal
// =====================================

const TX_SAMPLE_LITE = [
  { type: "expense",  category: "Restaurantes",  description: "Café con Lu",   subtitle: "Restaurantes · 12 may", amount: 2500 },
  { type: "income",   category: "Sueldo",        description: "Sueldo mayo",   subtitle: "Sueldo · 10 may",       amount: 850000 },
  { type: "expense",  category: "Supermercado",  description: "Coto",          subtitle: "Supermercado · 09 may", amount: 18450 },
  { type: "transfer",                            description: "Galicia → MP",  subtitle: "Para gastos · 08 may",  amount: 50000 },
  { type: "expense",  category: "Suscripciones", description: "Spotify",       subtitle: "Suscripciones · 07 may",amount: 4999 },
];

function StatusBar() {
  return (
    <div style={{
      height: 36, display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 24px", fontSize: 14, fontWeight: 600, color: "#0D1829",
      fontFamily: "-apple-system, system-ui", flexShrink: 0,
    }}>
      <span>9:41</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <svg width="17" height="11" viewBox="0 0 17 11">
          <rect x="0"   y="7"  width="3" height="4"  rx="0.7" fill="#0D1829"/>
          <rect x="4.5" y="5"  width="3" height="6"  rx="0.7" fill="#0D1829"/>
          <rect x="9"   y="2.5"width="3" height="8.5"rx="0.7" fill="#0D1829"/>
          <rect x="13.5"y="0"  width="3" height="11" rx="0.7" fill="#0D1829"/>
        </svg>
        <svg width="25" height="11" viewBox="0 0 25 11">
          <rect x="0.5" y="0.5" width="21" height="10" rx="3" fill="none" stroke="#0D1829" strokeOpacity="0.5"/>
          <rect x="2"   y="2"   width="18" height="7"  rx="1.5" fill="#0D1829"/>
          <rect x="23"  y="4"   width="2"  height="3"  rx="0.5" fill="#0D1829" fillOpacity="0.5"/>
        </svg>
      </div>
    </div>
  );
}

const HomeAntes = () => (
  <div style={{
    width: PHONE_W, height: PHONE_H, borderRadius: 44, overflow: "hidden",
    background: "#FFFFFF",
    boxShadow: "0 0 0 1px rgba(13,24,41,0.06), 0 30px 60px rgba(13,24,41,0.10)",
    position: "relative", display: "flex", flexDirection: "column",
    fontFamily: "var(--gota-font-sans)", color: "var(--gota-text-primary)",
  }}>
    <StatusBar />

    {/* Header — avatar | empty | + (no month) */}
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 22px 0", height: 48,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9999,
        background: "linear-gradient(135deg, #2178A8 0%, #1B7E9E 100%)",
        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700,
      }}>F</div>
      <div />
      <button style={{
        width: 36, height: 36, borderRadius: 9999,
        background: "var(--gota-primary-soft)", border: "1px solid rgba(33,120,168,0.14)",
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
      }}>
        <i className="ph-bold ph-plus" style={{ fontSize: 16, color: "#2178A8" }} />
      </button>
    </div>

    {/* Saldo Vivo — flotando sin contenedor */}
    <div style={{ padding: "20px 22px 0" }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: "0.09em",
        textTransform: "uppercase", color: "var(--gota-text-secondary)",
      }}>SALDO VIVO</div>
      <div style={{
        marginTop: 10, fontFamily: "var(--gota-font-display)",
        fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1,
        color: "var(--gota-text-primary)", fontVariantNumeric: "tabular-nums",
      }}>
        $ 124.500<span style={{ color: "#B8C9D4", fontWeight: 500, fontSize: 32 }}>,80</span>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 14, fontSize: 12, color: "#90A4B0" }}>
        <span><span style={{ color: "#2178A8", fontWeight: 600 }}>ARS</span> 124.500</span>
        <span>|</span>
        <span><span style={{ color: "#2178A8", fontWeight: 600 }}>USD</span> 96,40</span>
      </div>

      {/* Disponible real - border-t */}
      <div style={{
        marginTop: 18, paddingTop: 14, display: "flex", alignItems: "center", gap: 12,
        borderTop: "1px solid var(--gota-separator)",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 9999,
          background: "var(--gota-primary-soft)", border: "1px solid rgba(33,120,168,0.20)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className="ph ph-wallet" style={{ fontSize: 22, color: "#2178A8" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, color: "var(--gota-text-secondary)" }}>Disponible real</div>
          <div style={{ fontSize: 11, color: "var(--gota-text-dim)", marginTop: 1 }}>Ya descuenta deuda y consumos.</div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--gota-text-primary)" }}>$ 96.200</div>
      </div>

      {/* Commitments — same border-t treatment, same visual weight */}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--gota-separator)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 9999,
            background: "var(--gota-primary-soft)", border: "1px solid rgba(33,120,168,0.20)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="ph ph-credit-card" style={{ fontSize: 22, color: "#2178A8" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: "var(--gota-text-secondary)" }}>Compromisos en tarjetas</div>
            <div style={{ fontSize: 11, color: "var(--gota-text-dim)", marginTop: 1 }}>2 vencimientos · próximo 20 may</div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--gota-text-primary)" }}>$ 320.000</div>
        </div>
        <div style={{
          marginTop: 12, height: 6, borderRadius: 3,
          background: "var(--gota-separator)", overflow: "hidden", display: "flex",
        }}>
          <div style={{ width: "56%", background: "var(--gota-warning)" }} />
          <div style={{ width: "44%", background: "var(--gota-primary)" }} />
        </div>
      </div>
    </div>

    {/* Ultimos5 — sin section header */}
    <div style={{ marginTop: 24, padding: "0 22px 200px", overflow: "auto", flex: 1 }}>
      {TX_SAMPLE_LITE.map((tx, i) => (
        <TxRow key={i} tx={tx} last={i === TX_SAMPLE_LITE.length - 1} />
      ))}
    </div>

    {/* BottomZone — minimal SmartInput + minimal TabBar */}
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      background: "rgba(255,255,255,0.97)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      borderTop: "1px solid var(--gota-separator)",
      padding: "10px 16px 22px",
    }}>
      {/* SmartInput gris colapsado */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "9px 12px", borderRadius: 14,
        background: "rgba(15,30,60,0.04)",
        border: "1px solid rgba(15,30,60,0.06)",
      }}>
        <span style={{ flex: 1, fontSize: 15, color: "#B8C9D4" }}>cafe 2500</span>
        <div style={{
          width: 32, height: 32, borderRadius: 9999,
          background: "rgba(15,30,60,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className="ph-bold ph-arrow-right" style={{ fontSize: 13, color: "#90A4B0" }} />
        </div>
      </div>

      {/* TabBar minimal */}
      <div style={{ display: "flex", marginTop: 10 }}>
        {[
          { label: "Home",          icon: "house",        active: true  },
          { label: "Movimientos",   icon: "list-bullets", active: false },
          { label: "Análisis",      icon: "chart-bar",    active: false },
        ].map(t => (
          <div key={t.label} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            padding: "8px 6px",
          }}>
            <i className={t.active ? `ph-bold ph-${t.icon}` : `ph ph-${t.icon}`} style={{
              fontSize: 18, color: t.active ? "#2178A8" : "#90A4B0",
            }} />
            <span style={{
              fontSize: 12,
              fontWeight: t.active ? 700 : 400,
              color: t.active ? "#2178A8" : "#90A4B0",
            }}>{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// =====================================
// Close-ups: TabBar A vs B
// =====================================

const TabBarCloseup = ({ variant, label }) => (
  <div style={{
    width: 360, height: 220, borderRadius: 24, overflow: "hidden",
    background: "linear-gradient(180deg, #F8FBFD 0%, #EEF4F8 100%)",
    boxShadow: "0 0 0 1px rgba(13,24,41,0.06), 0 18px 36px rgba(13,24,41,0.08)",
    position: "relative", display: "flex", flexDirection: "column",
    fontFamily: "var(--gota-font-sans)",
  }}>
    {/* fake content */}
    <div style={{ flex: 1, padding: 22, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--gota-text-secondary)" }}>
        VARIANTE
      </div>
      <div style={{
        fontFamily: "var(--gota-font-display)",
        fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--gota-text-primary)",
        marginTop: 4,
      }}>{label}</div>
    </div>

    <div style={{
      background: "rgba(255,255,255,0.92)",
      backdropFilter: "blur(20px) saturate(180%)",
      WebkitBackdropFilter: "blur(20px) saturate(180%)",
      borderTop: "1px solid rgba(33,120,168,0.08)",
      padding: "8px 12px 22px",
    }}>
      <NativeTabBar variant={variant} active="home" integrated />
    </div>
  </div>
);

// =====================================
// SmartInput close-ups
// =====================================

const SmartInputCloseup = ({ kind }) => (
  <div style={{
    width: 360, height: 220, borderRadius: 24,
    background: "linear-gradient(180deg, #F8FBFD 0%, #EEF4F8 100%)",
    boxShadow: "0 0 0 1px rgba(13,24,41,0.06), 0 18px 36px rgba(13,24,41,0.08)",
    position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between",
    padding: 22, boxSizing: "border-box",
    fontFamily: "var(--gota-font-sans)",
  }}>
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--gota-text-secondary)" }}>
        SMARTINPUT · {kind === "antes" ? "ANTES" : "DESPUÉS"}
      </div>
      <div style={{ fontSize: 12, color: "var(--gota-text-dim)", marginTop: 4 }}>
        {kind === "antes"
          ? "Estado colapsado: se lee como nav, no como input"
          : "Glass pill + placeholder + badge IA visible"}
      </div>
    </div>

    {kind === "antes" ? (
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px", borderRadius: 14,
        background: "rgba(15,30,60,0.04)",
        border: "1px solid rgba(15,30,60,0.06)",
      }}>
        <span style={{ flex: 1, fontSize: 15, color: "#B8C9D4" }}>cafe 2500</span>
        <div style={{
          width: 32, height: 32, borderRadius: 9999,
          background: "rgba(15,30,60,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className="ph-bold ph-arrow-right" style={{ fontSize: 13, color: "#90A4B0" }} />
        </div>
      </div>
    ) : (
      <GlassSmartInput placeholder="¿Qué gastaste?" />
    )}
  </div>
);

// =====================================
// HeroCard close-up
// =====================================

const HeroCardCloseup = () => (
  <div style={{
    width: 380, padding: 18,
    background: "linear-gradient(180deg, #F8FBFD 0%, #EEF4F8 100%)",
    borderRadius: 22,
    boxShadow: "0 0 0 1px rgba(13,24,41,0.06), 0 18px 36px rgba(13,24,41,0.08)",
    fontFamily: "var(--gota-font-sans)",
  }}>
    <HeroCard
      saldo={124500.80}
      usd={96.40}
      disponibleReal={96200}
      compromisos={{ total: 320000, aPagar: 180000, enCurso: 140000, count: 2, nextDue: "20 may" }}
    />
  </div>
);

// =====================================
// Header close-up
// =====================================

const HeaderCloseup = () => (
  <div style={{
    width: 380, padding: "0 0 18px",
    background: "linear-gradient(180deg, #F8FBFD 0%, #EEF4F8 100%)",
    borderRadius: 22,
    boxShadow: "0 0 0 1px rgba(13,24,41,0.06), 0 18px 36px rgba(13,24,41,0.08)",
    overflow: "hidden",
    fontFamily: "var(--gota-font-sans)",
  }}>
    <StatusBar />
    <MonthHeader month="Mayo 2026" initials="F" />
    <div style={{ padding: "18px 20px 0", fontSize: 12, color: "var(--gota-text-dim)" }}>
      Avatar · "Mayo 2026" · botón +. Texto centrado: 14/600/text-secondary. Sin pill, sin caret — el selector de mes se mantiene como sheet desde el avatar o como tap en el label.
    </div>
  </div>
);

// =====================================
// Note card (post-it alternative, more designerly)
// =====================================

const Note = ({ title, children, w = 360 }) => (
  <div style={{
    width: w, padding: "20px 22px",
    background: "#FFFFFF",
    borderRadius: 18,
    border: "1px solid rgba(13,24,41,0.06)",
    boxShadow: "0 4px 12px rgba(13,24,41,0.06)",
    fontFamily: "var(--gota-font-sans)",
    color: "var(--gota-text-primary)",
  }}>
    <div style={{
      fontFamily: "var(--gota-font-display)",
      fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em",
      color: "var(--gota-text-primary)", marginBottom: 10,
    }}>{title}</div>
    <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--gota-text-secondary)" }}>
      {children}
    </div>
  </div>
);

// =====================================
// CANVAS
// =====================================

function App() {
  return (
    <DesignCanvas
      title="Gota — Visual redesign exploration"
      subtitle="PWA → Native feel · Mayo 2026"
    >
      {/* SECTION −0.5 — Flujos secundarios */}
      <DCSection
        id="s5-flujos"
        title="Flujos secundarios — Menú · Explorar · Insights · Presupuesto · Metas"
        subtitle="Mismo sistema. Sub-vistas con back-button en el header azul; bottom sheets con drag handle para overlays."
      >
        <DCArtboard id="s5-menu" label="Menú · CuentaSheet (bottom sheet desde avatar)" width={390} height={780}>
          <S5_Menu />
        </DCArtboard>
        <DCArtboard id="s5-explorar" label="Explorar · modal puente con badge de alertas" width={390} height={780}>
          <S5_Explorar />
        </DCArtboard>
        <DCArtboard id="s5-insights" label="Insights · Estado del mes · Fuga · Hábitos · Compromisos" width={390} height={780}>
          <S5_Insights />
        </DCArtboard>
        <DCArtboard id="s5-presupuesto" label="Presupuesto · Disponible + 3 status pills · categorías con dual-bar" width={390} height={780}>
          <S5_Presupuesto />
        </DCArtboard>
        <DCArtboard id="s5-metas" label="Metas · activas con pace + CTAs · completadas opacas" width={390} height={780}>
          <S5_Metas />
        </DCArtboard>

        <DCPostIt id="flujo-system" width={300} color="#dcefff">
          <strong>Patrón de navegación.</strong><br /><br />
          • <strong>Bottom sheets</strong> (Menú, Explorar) emergen sobre la pantalla con dim + blur del fondo. Drag-handle visible. Fondo del sheet en gris-azulado <code>#F4F7FA</code> para que las cards blancas tengan luz propia.<br /><br />
          • <strong>Sub-vistas de Análisis</strong> (Insights, Presupuesto, Metas) reemplazan el header del Análisis. El azul ahora trae back-button glass + título. Mismo TabBar abajo: el usuario sigue "en" Análisis.
        </DCPostIt>

        <DCPostIt id="flujo-menu" width={300}>
          <strong>Menú.</strong><br /><br />
          Cards agrupadas en secciones (Configuración · Preferencias · Seguridad). Counters numéricos a la derecha de cada item — patrón iOS. Card de usuario arriba con avatar generado + email + plan. CTA destructiva en texto suave abajo de todo (no botón rojo: confirma la jerarquía).
        </DCPostIt>

        <DCPostIt id="flujo-explorar" width={300}>
          <strong>Explorar.</strong><br /><br />
          Tres opciones con icono cuadrado coloreado (no circular: marca que son <em>destinos</em>, no acciones). El badge "3" sobre Presupuesto traduce las alertas (1 pasado + 1 al límite + 1 sobrado = 3 cosas para mirar). Subtítulos con data real, no descriptions genéricas.
        </DCPostIt>

        <DCPostIt id="flujo-insights" width={300} color="#fef9d4">
          <strong>Insights.</strong><br /><br />
          4 cards apiladas. Mismo grid: icono · label uppercase color-coded · caret right. Estado del mes muestra el neto (verde si +). Fuga Silenciosa visualiza con dots de opacidad escalonada. Hábitos muestra el grid 7×4 estilo GitHub. Compromisos repite la barra dual de Home — consistencia de vocabulario.
        </DCPostIt>

        <DCPostIt id="flujo-presu" width={300} color="#e0f5e0">
          <strong>Presupuesto.</strong><br /><br />
          Summary card con "Disponible" en hero (lo positivo primero) + "Gastado" en chip secundario + 3 status pills semánticas. Lista de categorías con <strong>dual-progress bar</strong>: la barra coloreada = % usado, el tick gris vertical = expected pace. El delta entre los dos comunica si te adelantás o atrasás, sin gritar.
        </DCPostIt>

        <DCPostIt id="flujo-metas" width={300} color="#ffe6dc">
          <strong>Metas.</strong><br /><br />
          Cada meta en su card. Emoji + nombre + badge de status. Progress bar con color del pace (behind en naranja, on_track en azul). Pace line: "Vas en ritmo" o "Necesitás $X/mes" (el dato accionable). Dos CTAs: Detalle terciario + Aportar primary. Completadas debajo del divider con opacity 72% — visibles pero archivadas.
        </DCPostIt>
      </DCSection>

      {/* SECTION 0 — Strategy 5 aplicada */}
      <DCSection
        id="s5-app"
        title="Estrategia 5 aplicada — Home · Movimientos · Análisis"
        subtitle="Zona azul arriba con la métrica principal; zona blanca abajo respira el contenido secundario. Mismo gesto en las 3 rutas."
      >
        <DCArtboard id="s5-home" label="Home · Saldo Vivo arriba · Disponible Real + Compromisos abajo" width={390} height={780}>
          <S5_Home />
        </DCArtboard>
        <DCArtboard id="s5-mov" label="Movimientos · 3-pills hero · filtros Todos/Gastos/Ingresos/Tarjetas · día-grouped" width={390} height={780}>
          <S5_Movimientos />
        </DCArtboard>
        <DCArtboard id="s5-ana" label="Análisis · Mes+Explorar · hero narrativo · comparación período · Qué movió el mes" width={390} height={780}>
          <S5_Analisis />
        </DCArtboard>

        <DCPostIt id="s5-system" width={300} color="#dcefff">
          <strong>Header azul compartido.</strong><br /><br />
          Las 3 pantallas usan el mismo gesto: zona azul arriba (gradient #2178A8 → #1B6A93, radius 28 abajo), zona blanca abajo. La métrica principal de cada pantalla vive sobre azul:<br /><br />
          • <strong>Home:</strong> Saldo Vivo<br />
          • <strong>Movimientos:</strong> solo header (el "metric" son los 3 pills que cuelgan abajo)<br />
          • <strong>Análisis:</strong> insight narrativo + $ del mes + sparkline + delta
        </DCPostIt>

        <DCPostIt id="s5-data" width={300} color="#e0f5e0">
          <strong>Data preservada.</strong><br /><br />
          <strong>Movimientos:</strong> 3 hero pills (Percibidos · Tarjeta · Pago Tarjeta), filtros Todos/Gastos/Ingresos/<strong>Tarjetas</strong> + funnel, lista agrupada por día con cuotas ("Cuota 1/3"), subtítulo "Categoría · fecha".<br /><br />
          <strong>Análisis:</strong> mes-picker + Explorar pill con badge, headline "Mayo viene 34% abajo de tu promedio" con highlight verde, $ total + sparkline + delta, segmented Percibidos/Todo el gasto, comparación Abr vs May, "Qué movió el mes" + insight orange, categorías con %, transacciones, promedio, barra y label N/D.
        </DCPostIt>

        <DCPostIt id="s5-detail" width={300}>
          <strong>Detalles finos.</strong><br /><br />
          • El "34% abajo" en Análisis usa <em>highlight inline</em> verde menta translúcido — el dato vive dentro de la oración, no como pill aparte. Más conversacional.<br /><br />
          • El badge "1" del botón Explorar tiene border azul (color del bg) — patrón iOS notif.<br /><br />
          • Los hero pills de Movimientos comparten card pero se separan con divisores hairline verticales: una sola "isla" con tres datos.
        </DCPostIt>
      </DCSection>

      {/* SECTION −1 — Estrategia estructural (azul fiel) */}
      <DCSection
        id="estrategia"
        title="Estrategias de superficie — mantener el azul de Gota"
        subtitle="El problema no es el shade, es el contrato bg vs card. 5 estrategias estructurales que respetan #2178A8."
      >
        <DCArtboard id="s1" label="1 · Neutral canvas + accent (Microsoft, Apple Wallet)" width={390} height={780}>
          <S1_Neutral />
        </DCArtboard>
        <DCArtboard id="s2" label="2 · Invertido — azul es canvas (BBVA, Cash App)" width={390} height={780}>
          <S2_Inverted />
        </DCArtboard>
        <DCArtboard id="s3" label="3 · Monocromático tonal (Linear, Stripe)" width={390} height={780}>
          <S3_Monochromatic />
        </DCArtboard>
        <DCArtboard id="s4" label="4 · Cardless (Mercury, Brex, Apple Health)" width={390} height={780}>
          <S4_Cardless />
        </DCArtboard>
        <DCArtboard id="s5" label="5 · Header zone azul (PayPal, Mercury)" width={390} height={780}>
          <S5_Header />
        </DCArtboard>
      </DCSection>

      <DCSection
        id="estrategia-notas"
        title="Estrategias — análisis"
        subtitle="Qué hace cada una, qué resigna, dónde brilla."
      >
        <DCPostIt id="s1n" width={280} color="#fef9d4">
          <strong>1 · Neutral + accent.</strong><br />
          <em>Inspiración:</em> Microsoft Fluent, Apple Wallet.<br /><br />
          Bg es gris-frío puro (#F4F5F7), <strong>sin azul</strong>. Cards blancas que se despegan claro. El ocean blue brilla porque ya no compite con la atmósfera — vive en el avatar, accents, datos, CTAs.<br /><br />
          + Más legible.<br />
          + El azul de Gota se siente <em>más</em> azul, no menos.<br />
          – Pierde el aire "agua" del nombre.
        </DCPostIt>
        <DCPostIt id="s2n" width={280} color="#dcefff">
          <strong>2 · Invertido.</strong><br />
          <em>Inspiración:</em> BBVA app, Cash App, app del Itaú.<br /><br />
          El azul de Gota <strong>ES</strong> el lienzo. Cards blancas flotan dramaticamente. Saldo Vivo se lee sobre azul, en blanco — mucho más confidente.<br /><br />
          + La identidad del azul es inconfundible.<br />
          + Muy "app", muy nativo.<br />
          – Más pesado visualmente. Requiere status bar light. Empuja al dark-mode-feel sin ser dark.
        </DCPostIt>
        <DCPostIt id="s3n" width={280} color="#e0f5e0">
          <strong>3 · Monocromático.</strong><br />
          <em>Inspiración:</em> Linear, Stripe Dashboard, Things 3.<br /><br />
          Bg y cards en la <strong>misma familia tonal</strong>. La card es más <em>luminosa</em> que el bg (no más blanca). Jerarquía por luminosidad + sombra interior + glow, no por color shift.<br /><br />
          + Coherencia total. Nada se pelea.<br />
          + Premium, sofisticado, calmo.<br />
          – Sutil — requiere shadows y inset highlights bien calibrados o se aplana.
        </DCPostIt>
        <DCPostIt id="s4n" width={280} color="#ffe6dc">
          <strong>4 · Cardless.</strong><br />
          <em>Inspiración:</em> Mercury Bank, Brex, Apple Health, Things 3.<br /><br />
          <strong>No hay cards.</strong> Solo bg casi-blanco (#FAFBFC) y contenido sobre él. La jerarquía la hace la tipografía, el espacio, y divisores hairline. El azul se concentra en el dato.<br /><br />
          + Limpio extremo. Mucho aire.<br />
          + Editorial, sin chrome.<br />
          – Pierde el framing del hero (lo que pediste resolver al inicio). Funciona si el hero es <em>tipográficamente</em> imponente.
        </DCPostIt>
        <DCPostIt id="s5n" width={280} color="#dcefff">
          <strong>5 · Header zone azul.</strong><br />
          <em>Inspiración:</em> PayPal, Mercury, Revolut Premium tier.<br /><br />
          La parte superior es <strong>azul Gota puro</strong> (header + Saldo Vivo en blanco sobre azul). Abajo, blanco puro con cards y listas. El azul vive en un sector.<br /><br />
          + Combina lo mejor de invertido y blanco. El Saldo Vivo respira en su propio territorio.<br />
          + Comunica "esta es tu plata" cromáticamente.<br />
          – El gesto es fuerte; requiere comprometerse con la zonificación en todas las rutas.
        </DCPostIt>

        <DCPostIt id="reco-final" width={320} color="#e0f5e0">
          <strong>Mi lectura.</strong><br /><br />
          Si querés <em>mantener el espíritu Gota tal cual</em> (sereno, calmo, conversacional) y resolver el contraste: <strong>3 · Monocromático</strong>.<br /><br />
          Si querés <em>dar un salto identitario</em> y que Gota se vea distinto de un home-banking más: <strong>5 · Header zone</strong>. Es el más "Nubank-equivalent en azul" — el patrón que probablemente tenías en la cabeza al pedir la referencia.<br /><br />
          <strong>2 · Invertido</strong> es la apuesta más audaz, pero cambia mucho el tono. Vale la pena explorarla si querés que la app se sienta más "premium fintech" y menos "PWA financiera".
        </DCPostIt>
      </DCSection>

      {/* Section 0 — Paleta (kept) */}
      <DCSection
        id="paleta"
        title="Direcciones de paleta"
        subtitle="Mismo Home, 5 atmósferas distintas. El celeste vs blanco actual tiene poco contraste — exploremos más."
      >
        {PALETTES.map(p => (
          <DCArtboard key={p.id} id={`pal-${p.id}`} label={p.name} width={390} height={780}>
            <ThemedHome palette={p} />
          </DCArtboard>
        ))}
      </DCSection>

      <DCSection
        id="paleta-cards"
        title="Paletas — referencia"
        subtitle="Swatches, tono y notas de cada dirección"
      >
        {PALETTES.map(p => (
          <DCArtboard key={p.id} id={`palcard-${p.id}`} label={p.name} width={270} height={260}>
            <PaletteCard palette={p} />
          </DCArtboard>
        ))}
        <DCPostIt id="paleta-reco" width={300} color="#e0f5e0">
          <strong>Sugerencia.</strong> Si la app busca diferenciarse del montón de fintechs, <strong>B · Linen Warm</strong> es la apuesta más fuerte: rompe la asociación visual con bancos sin perder seriedad. Si la prioridad es legibilidad pura y velocidad de lectura, <strong>C · Granite Crisp</strong>. <strong>D · Deep Ocean</strong> mantiene la identidad actual pero resuelve el problema de contraste que mencionaste.
        </DCPostIt>
        <DCPostIt id="paleta-pregunta" width={260}>
          <strong>¿Qué probás?</strong><br /><br />
          1. Mirá los 5 phones en la fila de arriba.<br />
          2. Decime cuál(es) te enganchan.<br />
          3. Profundizamos en 1-2 con micro-variaciones (intensidad del bg, accent shift, sombra de cards).
        </DCPostIt>
      </DCSection>

      {/* Intro post-it */}
      <DCSection
        id="intro"
        title="Punto de partida"
        subtitle="Resumen del diagnóstico y dirección"
      >
        <DCPostIt id="brief" width={300}>
          <strong>Problema.</strong> La app funciona, pero se siente web — sin jerarquía de superficie, sin contexto de mes, con un SmartInput que se lee como barra de navegación, y con un TabBar sin indicador nativo.
          <br /><br />
          <strong>Norte.</strong> Nubank · N26 · Revolut en light — sobrio, con calidez. Cero gamification, cero stoic-bro.
        </DCPostIt>
        <DCPostIt id="alcance" width={300} color="#dcefff">
          <strong>Alcance.</strong> Solo capa visual. No se toca lógica, estructura de componentes ni flujos de datos. Tokens existentes; foco en surface hierarchy, contexto y affordances.
        </DCPostIt>
        <DCPostIt id="reco" width={300} color="#e0f5e0">
          <strong>Recomendación.</strong> TabBar con <em>top-bar indicator</em> (2px sobre el icono). Más cercano al patrón iOS Wallet / N26 / Revolut, no compite con el accent en el contenido, y permite reusar el mismo gesto visual en lectura larga sin "encerrar" el item.
        </DCPostIt>
      </DCSection>

      {/* Section 1 — Home antes vs después */}
      <DCSection
        id="home"
        title="Home — Antes vs Después"
        subtitle="Hero card · contexto de mes · SmartInput reconocible · section header · TabBar nativo"
      >
        <DCArtboard id="home-antes" label="Antes · estado actual" width={PHONE_W} height={PHONE_H}>
          <HomeAntes />
        </DCArtboard>
        <DCArtboard id="home-topbar" label="Después · TabBar top-bar indicator (recomendado)" width={PHONE_W} height={PHONE_H}>
          <HomeScreen tabVariant="topbar" />
        </DCArtboard>
        <DCArtboard id="home-pill" label="Después · TabBar pill background" width={PHONE_W} height={PHONE_H}>
          <HomeScreen tabVariant="pill" />
        </DCArtboard>
      </DCSection>

      {/* Section 2 — otras rutas */}
      <DCSection
        id="rutas"
        title="Otras rutas — consistencia visual"
        subtitle="Mismo shell, mismo TabBar. La diferencia Home vs. no-Home desaparece."
      >
        <DCArtboard id="movimientos" label="Movimientos" width={PHONE_W} height={PHONE_H}>
          <MovimientosScreen tabVariant="topbar" />
        </DCArtboard>
        <DCArtboard id="analisis" label="Análisis" width={PHONE_W} height={PHONE_H}>
          <AnalisisScreen tabVariant="topbar" />
        </DCArtboard>
      </DCSection>

      {/* Section 3 — TabBar decision */}
      <DCSection
        id="tabbar"
        title="Decisión TabBar"
        subtitle="A: indicador superior (recomendado) · B: pill background"
      >
        <DCArtboard id="tb-current" label="Estado actual — solo bold + color" width={360} height={220}>
          <TabBarCloseup variant="minimal" label="Minimal (hoy)" />
        </DCArtboard>
        <DCArtboard id="tb-a" label="A · Top-bar indicator" width={360} height={220}>
          <TabBarCloseup variant="topbar" label="Top-bar 2px" />
        </DCArtboard>
        <DCArtboard id="tb-b" label="B · Pill background" width={360} height={220}>
          <TabBarCloseup variant="pill" label="Pill soft" />
        </DCArtboard>

        <DCPostIt id="tb-pro-a" width={280} color="#e0f5e0">
          <strong>A · Top-bar (recomendado).</strong><br />
          + Patrón iOS Wallet / N26 / Revolut.<br />
          + Indicador es <em>tipográfico-geométrico</em>, no decorativo. No agrega chrome a la fila.<br />
          + Permite densidad: el item activo no "engorda".<br />
          – Requiere el shell glass para que el 2px se lea contra el fondo.
        </DCPostIt>
        <DCPostIt id="tb-pro-b" width={280}>
          <strong>B · Pill.</strong><br />
          + Lectura inmediata; muy "Android".<br />
          + Bueno si se sumara una 4ª tab en el futuro.<br />
          – Compite visualmente con el accent primary en el contenido (CTAs, montos en azul).<br />
          – En Home, el pill queda muy pegado al SmartInput, doble pill apilado.
        </DCPostIt>
      </DCSection>

      {/* Section 4 — Componentes */}
      <DCSection
        id="comps"
        title="Componentes — decisiones"
        subtitle="Header con mes · Hero card · SmartInput reconocible"
      >
        <DCArtboard id="hd" label="Header con mes" width={380} height={120}>
          <HeaderCloseup />
        </DCArtboard>
        <DCArtboard id="hero" label="Hero card unificado" width={380} height={360}>
          <HeroCardCloseup />
        </DCArtboard>
        <DCArtboard id="si-antes" label="SmartInput · antes" width={360} height={220}>
          <SmartInputCloseup kind="antes" />
        </DCArtboard>
        <DCArtboard id="si-despues" label="SmartInput · después" width={360} height={220}>
          <SmartInputCloseup kind="despues" />
        </DCArtboard>
      </DCSection>

      {/* Section 5 — Oportunidades */}
      <DCSection
        id="oportunidades"
        title="Oportunidades que vi en el recorrido"
        subtitle="Cosas que no me pediste, pero las dejo señaladas."
      >
        <Note title="Shell unificado (Home y rutas)" w={360}>
          Hoy la BottomZone de Home y el TabBar fijo del resto usan recetas distintas. Propuesta: <strong>una sola receta de glass</strong> (rgba 92% blanco + blur 20 + saturate 180 + border-top sutil) que se aplica al contenedor inferior siempre. En Home tiene el SmartInput dentro; en otras rutas, solo el TabBar. Misma altura percibida, misma luz.
        </Note>
        <Note title="Rhythm de superficie" w={360}>
          Tres niveles, no más: <strong>canvas</strong> (bg-base #F8FBFD) → <strong>card flotante</strong> (white + shadow-md, radius 22) → <strong>card inerte</strong> (white + shadow-sm, radius 18). El hero usa flotante; las listas y N/D usan inerte. El compromisos vive <em>dentro</em> del hero, con bg-tertiary, ganando jerarquía sin un card nuevo.
        </Note>
        <Note title="Sparkle como afordancia de IA" w={360}>
          El SmartInput colapsado lleva una mini-pill <code>✦ IA</code> a la derecha del placeholder. No es chrome — desaparece al tipear y el botón se llena con primary. Comunica que la entrada es conversacional sin agregar copy.
        </Note>
        <Note title="Density y iconografía" w={360}>
          Subir el peso de los iconos del TabBar de <em>regular/bold</em> a <strong>regular/fill</strong>: regular en inactivos, fill en el activo. El delta es más legible en mobile que el peso. (Phosphor soporta <code>fill</code> nativo.)
        </Note>
        <Note title="Tipografía de hero" w={360}>
          Los decimales del Saldo Vivo siguen al 80% del peso y al 75% del tamaño — ya estaba en el tokens, pero hoy no se aplica en la UI activa. Devolverlo: el número se lee como cifra, no como dato técnico.
        </Note>
        <Note title="Movimientos · agrupado por día" w={360}>
          La ruta Movimientos pide un header propio ("Movimientos · 22 este mes") + chips de filtro flotantes (Todos / Gastos / Ingresos / Transfers). Cada grupo de día queda en su propio card-inerte. Más nativo que una lista cardless infinita.
        </Note>
        <Note title="Análisis · KPI hero" w={360}>
          Replicar la estructura del Home (hero card elevado) en Análisis: el monto total gastado del mes en hero + delta vs. mes anterior + barra N/D dentro del mismo card. Un patrón, dos rutas — la app se siente del mismo equipo.
        </Note>
        <Note title="Estados vacíos (futuro)" w={360}>
          Cuando no hay datos, evitar copys de bienvenida. Seguir el principio del design system: explicar la próxima acción. "Configurá tu primera cuenta para que Saldo Vivo tenga base real." con un solo CTA primary.
        </Note>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
