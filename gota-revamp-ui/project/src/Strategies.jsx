/* global React, MonthHeader, GlassSmartInput, NativeTabBar, TxRow, Icon, Label, fmtARS, NDBar, BottomZoneHome, HeroCard, SectionHeader */

// Gota — Surface strategies (azul fiel, jerarquía resuelta)
// 4 estrategias estructurales que respetan #2178A8 sin pelear bg vs card.

const PHONE_W_S = 390;
const PHONE_H_S = 780;

function SB() {
  return (
    <div style={{
      height: 36, display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 24px", fontSize: 14, fontWeight: 600,
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

const TX_S = [
  { type: "expense",  category: "Restaurantes",  description: "Café con Lu",   subtitle: "Restaurantes · 12 may", amount: 2500 },
  { type: "income",   category: "Sueldo",        description: "Sueldo mayo",   subtitle: "Sueldo · 10 may",       amount: 850000 },
  { type: "expense",  category: "Supermercado",  description: "Coto",          subtitle: "Supermercado · 09 may", amount: 18450 },
  { type: "transfer",                            description: "Galicia → MP",  subtitle: "Para gastos · 08 may",  amount: 50000 },
];

// =====================================
// STRATEGY 1 — Neutral canvas + blue accent (Microsoft Fluent / Apple Wallet)
// Bg = neutro gris-frío SIN azul. El azul vive en accent puntual.
// =====================================

const S1_Neutral = () => (
  <div style={{
    width: PHONE_W_S, height: PHONE_H_S, borderRadius: 44, overflow: "hidden",
    background: "#F4F5F7", // neutral cool gray, no blue tint
    position: "relative", display: "flex", flexDirection: "column",
    boxShadow: "0 0 0 1px rgba(13,24,41,0.06), 0 30px 60px rgba(13,24,41,0.10)",
    fontFamily: "var(--gota-font-sans)", color: "#0D1829",
  }}>
    <SB />
    <MonthHeader month="Mayo 2026" initials="F" />
    <div style={{ padding: "16px 18px 200px", overflow: "auto", flex: 1 }}>
      <HeroCard
        saldo={124500.80} usd={96.40} disponibleReal={96200}
        compromisos={{ total: 320000, aPagar: 180000, enCurso: 140000, count: 2, nextDue: "20 may" }}
      />
      <div style={{ marginTop: 24 }}>
        <SectionHeader title="Últimos movimientos" action="Ver todos" />
        <div style={{
          background: "#FFFFFF", borderRadius: 18,
          boxShadow: "0 1px 3px rgba(13,24,41,0.05)",
          padding: "2px 16px", border: "1px solid rgba(13,24,41,0.05)",
        }}>
          {TX_S.map((tx, i) => <TxRow key={i} tx={tx} last={i === TX_S.length - 1} />)}
        </div>
      </div>
    </div>
    <BottomZoneHome active="home" tabVariant="topbar" />
  </div>
);

// =====================================
// STRATEGY 2 — Inverted: blue canvas, white islands (BBVA / Cash App style)
// El azul ES el lienzo. Las cards son blancas, dramaticamente flotantes.
// =====================================

const S2_Inverted = () => (
  <div style={{
    width: PHONE_W_S, height: PHONE_H_S, borderRadius: 44, overflow: "hidden",
    background: "linear-gradient(180deg, #2178A8 0%, #1B6A93 50%, #15577B 100%)",
    position: "relative", display: "flex", flexDirection: "column",
    boxShadow: "0 0 0 1px rgba(13,24,41,0.06), 0 30px 60px rgba(13,24,41,0.10)",
    fontFamily: "var(--gota-font-sans)", color: "#FFFFFF",
  }}>
    <div style={{ color: "#FFFFFF" }}><SB /></div>
    {/* Header con texto claro */}
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 20px 0", height: 48,
    }}>
      <button style={{
        width: 36, height: 36, borderRadius: 9999,
        background: "rgba(255,255,255,0.18)",
        backdropFilter: "blur(12px)",
        color: "#fff", border: "1px solid rgba(255,255,255,0.20)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700,
      }}>F</button>
      <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.80)", letterSpacing: "-0.01em" }}>
        Mayo 2026
      </div>
      <button style={{
        width: 36, height: 36, borderRadius: 9999,
        background: "rgba(255,255,255,0.18)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.20)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <i className="ph-bold ph-plus" style={{ fontSize: 16, color: "#fff" }} />
      </button>
    </div>

    {/* Hero — sin card, integrado al canvas */}
    <div style={{ padding: "24px 22px 16px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(255,255,255,0.70)" }}>
        SALDO VIVO
      </div>
      <div style={{
        marginTop: 10, fontFamily: "var(--gota-font-display)",
        fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1,
        color: "#FFFFFF", fontVariantNumeric: "tabular-nums",
      }}>
        $ 124.500<span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 500, fontSize: 30 }}>,80</span>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 14, fontSize: 12, color: "rgba(255,255,255,0.70)" }}>
        <span><span style={{ color: "#fff", fontWeight: 700 }}>ARS</span> 124.500</span>
        <span style={{ opacity: 0.5 }}>|</span>
        <span><span style={{ color: "#fff", fontWeight: 700 }}>USD</span> 96,40</span>
      </div>
    </div>

    {/* White islands */}
    <div style={{ padding: "8px 18px 200px", overflow: "auto", flex: 1 }}>
      <div style={{
        background: "#FFFFFF", borderRadius: 22,
        boxShadow: "0 8px 24px rgba(8,40,70,0.20)",
        padding: 18, color: "#0D1829",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 9999,
            background: "var(--gota-primary-soft)", border: "1px solid rgba(33,120,168,0.18)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="ph ph-wallet" style={{ fontSize: 19, color: "#2178A8" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: "#4A6070", fontWeight: 500 }}>Disponible real</div>
            <div style={{ fontSize: 11, color: "#90A4B0", marginTop: 2 }}>Ya descuenta deuda y consumos</div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0D1829", fontVariantNumeric: "tabular-nums" }}>
            $ 96.200
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between",
          padding: "0 4px 10px",
        }}>
          <h3 style={{
            margin: 0, fontFamily: "var(--gota-font-display)",
            fontSize: 16, fontWeight: 700, color: "#FFFFFF",
          }}>Últimos movimientos</h3>
          <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>Ver todos ›</span>
        </div>
        <div style={{
          background: "#FFFFFF", borderRadius: 18,
          boxShadow: "0 6px 18px rgba(8,40,70,0.16)",
          padding: "2px 16px", color: "#0D1829",
        }}>
          {TX_S.map((tx, i) => <TxRow key={i} tx={tx} last={i === TX_S.length - 1} />)}
        </div>
      </div>
    </div>

    {/* TabBar glass sobre azul */}
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      background: "rgba(255,255,255,0.96)",
      backdropFilter: "blur(20px) saturate(180%)",
      borderTop: "1px solid rgba(255,255,255,0.40)",
      padding: "10px 16px 22px",
      color: "#0D1829",
    }}>
      <GlassSmartInput placeholder="¿Qué gastaste?" />
      <div style={{ height: 6 }} />
      <NativeTabBar variant="topbar" active="home" integrated />
    </div>
  </div>
);

// =====================================
// STRATEGY 3 — Monocromatic (Linear / Stripe)
// Bg y cards en la MISMA familia tonal. Card es más LUMINOSA, no más blanca.
// =====================================

const S3_Monochromatic = () => (
  <div style={{
    width: PHONE_W_S, height: PHONE_H_S, borderRadius: 44, overflow: "hidden",
    background: "#EAEEF2", // bg con muy poco azul, casi gris-azulado
    position: "relative", display: "flex", flexDirection: "column",
    boxShadow: "0 0 0 1px rgba(13,24,41,0.06), 0 30px 60px rgba(13,24,41,0.10)",
    fontFamily: "var(--gota-font-sans)", color: "#0D1829",
  }}>
    <SB />
    <MonthHeader month="Mayo 2026" initials="F" />
    <div style={{ padding: "16px 18px 200px", overflow: "auto", flex: 1 }}>
      <div style={{
        background: "#F7F9FB", // card más LUMINOSA que el bg, no más blanca
        borderRadius: 22,
        boxShadow: "0 1px 0 #FFFFFF inset, 0 8px 24px rgba(13,24,41,0.06), 0 1px 2px rgba(13,24,41,0.04)",
        border: "1px solid rgba(255,255,255,0.60)",
        overflow: "hidden",
      }}>
        <div style={{ padding: "20px 20px 18px" }}>
          <Label>SALDO VIVO</Label>
          <div style={{
            marginTop: 10, fontFamily: "var(--gota-font-display)",
            fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1,
            color: "#0D1829", fontVariantNumeric: "tabular-nums",
          }}>
            $ 124.500<span style={{ color: "#B8C9D4", fontWeight: 500, fontSize: 30 }}>,80</span>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 14, fontSize: 12, color: "#90A4B0" }}>
            <span><span style={{ color: "#2178A8", fontWeight: 700 }}>ARS</span> 124.500</span>
            <span>|</span>
            <span><span style={{ color: "#2178A8", fontWeight: 700 }}>USD</span> 96,40</span>
          </div>
          <div style={{
            marginTop: 16, paddingTop: 14, display: "flex", alignItems: "center", gap: 12,
            borderTop: "1px solid rgba(33,120,168,0.10)",
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 9999,
              background: "rgba(33,120,168,0.10)", border: "1px solid rgba(33,120,168,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <i className="ph ph-wallet" style={{ fontSize: 19, color: "#2178A8" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: "#4A6070", fontWeight: 500 }}>Disponible real</div>
              <div style={{ fontSize: 11, color: "#90A4B0", marginTop: 2 }}>Ya descuenta deuda y consumos</div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>$ 96.200</div>
          </div>
        </div>
        <div style={{
          background: "rgba(33,120,168,0.04)", // recess (más oscuro que card)
          padding: "16px 20px",
          borderTop: "1px solid rgba(33,120,168,0.10)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 9999,
              background: "rgba(255,255,255,0.85)", border: "1px solid rgba(33,120,168,0.14)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <i className="ph ph-credit-card" style={{ fontSize: 19, color: "#2178A8" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: "#4A6070", fontWeight: 500 }}>Compromisos en tarjetas</div>
              <div style={{ fontSize: 11, color: "#90A4B0", marginTop: 2 }}>2 vencimientos · próximo 20 may</div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>$ 320.000</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionHeader title="Últimos movimientos" action="Ver todos" />
        <div style={{
          background: "#F7F9FB",
          borderRadius: 18,
          boxShadow: "0 1px 0 #FFFFFF inset, 0 4px 14px rgba(13,24,41,0.05)",
          border: "1px solid rgba(255,255,255,0.60)",
          padding: "2px 16px",
        }}>
          {TX_S.map((tx, i) => <TxRow key={i} tx={tx} last={i === TX_S.length - 1} />)}
        </div>
      </div>
    </div>
    <BottomZoneHome active="home" tabVariant="topbar" />
  </div>
);

// =====================================
// STRATEGY 4 — Cardless on near-white (Mercury / Brex / Apple Wallet)
// Sin cards. Jerarquía por tipografía, peso, espacio, divisores sutiles.
// El azul se concentra en el dato y el accent.
// =====================================

const S4_Cardless = () => (
  <div style={{
    width: PHONE_W_S, height: PHONE_H_S, borderRadius: 44, overflow: "hidden",
    background: "#FAFBFC",
    position: "relative", display: "flex", flexDirection: "column",
    boxShadow: "0 0 0 1px rgba(13,24,41,0.06), 0 30px 60px rgba(13,24,41,0.10)",
    fontFamily: "var(--gota-font-sans)", color: "#0D1829",
  }}>
    <SB />
    <MonthHeader month="Mayo 2026" initials="F" />

    <div style={{ padding: "16px 22px 200px", overflow: "auto", flex: 1 }}>
      <Label>SALDO VIVO</Label>
      <div style={{
        marginTop: 10, fontFamily: "var(--gota-font-display)",
        fontSize: 44, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1,
        color: "#0D1829", fontVariantNumeric: "tabular-nums",
      }}>
        $ 124.500<span style={{ color: "#B8C9D4", fontWeight: 500, fontSize: 32 }}>,80</span>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 14, fontSize: 12, color: "#90A4B0" }}>
        <span><span style={{ color: "#2178A8", fontWeight: 700 }}>ARS</span> 124.500</span>
        <span>|</span>
        <span><span style={{ color: "#2178A8", fontWeight: 700 }}>USD</span> 96,40</span>
      </div>

      {/* Disponible real — fila simple, sin card */}
      <div style={{
        marginTop: 22, paddingTop: 16, display: "flex", alignItems: "center", gap: 12,
        borderTop: "1px solid #E6ECF1",
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 9999,
          background: "rgba(33,120,168,0.09)", border: "1px solid rgba(33,120,168,0.16)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className="ph ph-wallet" style={{ fontSize: 19, color: "#2178A8" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, color: "#4A6070", fontWeight: 500 }}>Disponible real</div>
          <div style={{ fontSize: 11, color: "#90A4B0", marginTop: 2 }}>Ya descuenta deuda y consumos</div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>$ 96.200</div>
      </div>

      {/* Compromisos */}
      <div style={{
        marginTop: 14, paddingTop: 16,
        borderTop: "1px solid #E6ECF1",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 9999,
            background: "rgba(33,120,168,0.09)", border: "1px solid rgba(33,120,168,0.16)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="ph ph-credit-card" style={{ fontSize: 19, color: "#2178A8" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: "#4A6070", fontWeight: 500 }}>Compromisos en tarjetas</div>
            <div style={{ fontSize: 11, color: "#90A4B0", marginTop: 2 }}>2 vencimientos · próximo 20 may</div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>$ 320.000</div>
        </div>
        <div style={{
          marginTop: 12, height: 5, borderRadius: 3,
          background: "rgba(33,120,168,0.10)", overflow: "hidden", display: "flex",
        }}>
          <div style={{ width: "56%", background: "var(--gota-warning)" }} />
          <div style={{ width: "44%", background: "var(--gota-primary)" }} />
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <div style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between",
          padding: "0 0 4px",
        }}>
          <h3 style={{
            margin: 0, fontFamily: "var(--gota-font-display)",
            fontSize: 16, fontWeight: 700, color: "#0D1829",
          }}>Últimos movimientos</h3>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#2178A8" }}>Ver todos ›</span>
        </div>
        <div>
          {TX_S.map((tx, i) => <TxRow key={i} tx={tx} last={i === TX_S.length - 1} />)}
        </div>
      </div>
    </div>
    <BottomZoneHome active="home" tabVariant="topbar" />
  </div>
);

// =====================================
// STRATEGY 5 — Blue header zone (PayPal / Mercury / Stripe Treasury)
// Zona azul arriba (header + hero) — blanco abajo. El azul vive en un sector.
// =====================================

const S5_Header = () => (
  <div style={{
    width: PHONE_W_S, height: PHONE_H_S, borderRadius: 44, overflow: "hidden",
    background: "#FFFFFF",
    position: "relative", display: "flex", flexDirection: "column",
    boxShadow: "0 0 0 1px rgba(13,24,41,0.06), 0 30px 60px rgba(13,24,41,0.10)",
    fontFamily: "var(--gota-font-sans)", color: "#0D1829",
  }}>
    {/* Blue zone */}
    <div style={{
      background: "linear-gradient(180deg, #2178A8 0%, #1E6E9B 100%)",
      color: "#FFFFFF",
      paddingBottom: 28,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
    }}>
      <div style={{ color: "#FFFFFF" }}><SB /></div>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 20px 0", height: 48,
      }}>
        <button style={{
          width: 36, height: 36, borderRadius: 9999,
          background: "rgba(255,255,255,0.18)",
          color: "#fff", border: "1px solid rgba(255,255,255,0.22)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 700,
        }}>F</button>
        <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.80)" }}>Mayo 2026</div>
        <button style={{
          width: 36, height: 36, borderRadius: 9999,
          background: "rgba(255,255,255,0.18)",
          border: "1px solid rgba(255,255,255,0.22)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <i className="ph-bold ph-plus" style={{ fontSize: 16, color: "#fff" }} />
        </button>
      </div>

      <div style={{ padding: "18px 22px 0" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "rgba(255,255,255,0.70)" }}>
          SALDO VIVO
        </div>
        <div style={{
          marginTop: 10, fontFamily: "var(--gota-font-display)",
          fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}>
          $ 124.500<span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 500, fontSize: 30 }}>,80</span>
        </div>
        <div style={{ marginTop: 10, display: "flex", gap: 14, fontSize: 12, color: "rgba(255,255,255,0.70)" }}>
          <span><span style={{ color: "#fff", fontWeight: 700 }}>ARS</span> 124.500</span>
          <span style={{ opacity: 0.5 }}>|</span>
          <span><span style={{ color: "#fff", fontWeight: 700 }}>USD</span> 96,40</span>
        </div>
      </div>
    </div>

    {/* White zone — overlap card */}
    <div style={{ padding: "0 18px 200px", overflow: "auto", flex: 1, marginTop: -20 }}>
      <div style={{
        background: "#FFFFFF", borderRadius: 18,
        boxShadow: "0 6px 18px rgba(8,40,70,0.12)",
        padding: 18,
        border: "1px solid rgba(13,24,41,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 9999,
            background: "rgba(33,120,168,0.09)", border: "1px solid rgba(33,120,168,0.18)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className="ph ph-wallet" style={{ fontSize: 19, color: "#2178A8" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: "#4A6070", fontWeight: 500 }}>Disponible real</div>
            <div style={{ fontSize: 11, color: "#90A4B0", marginTop: 2 }}>Ya descuenta deuda y consumos</div>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>$ 96.200</div>
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <SectionHeader title="Últimos movimientos" action="Ver todos" />
        <div>
          {TX_S.map((tx, i) => <TxRow key={i} tx={tx} last={i === TX_S.length - 1} />)}
        </div>
      </div>
    </div>
    <BottomZoneHome active="home" tabVariant="topbar" />
  </div>
);

Object.assign(window, { S1_Neutral, S2_Inverted, S3_Monochromatic, S4_Cardless, S5_Header });
