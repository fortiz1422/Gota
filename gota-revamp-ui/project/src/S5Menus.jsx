/* global React, TxRow, Icon, Label, fmtARS, CategoryIcon, GlassSmartInput, NativeTabBar, Badge */

// Gota — Strategy 5 · Menú · Explorar · Insights · Presupuesto · Metas
// Data fidelity: respeta los módulos del repo real (CuentaSheet,
// ExploreModal, AnalysisView/Insights drills, BudgetsSection, GoalsSection).

const W2 = 390;
const H2 = 780;

// =====================================================
// Shared chrome
// =====================================================

function StatBarM({ light = false }) {
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

function ShellM({ children }) {
  return (
    <div style={{
      width: W2, height: H2, borderRadius: 44, overflow: "hidden",
      background: "#FFFFFF",
      position: "relative", display: "flex", flexDirection: "column",
      boxShadow: "0 0 0 1px rgba(13,24,41,0.06), 0 30px 60px rgba(13,24,41,0.10)",
      fontFamily: "var(--gota-font-sans)", color: "#0D1829",
    }}>{children}</div>
  );
}

function BlueZoneM({ children, height = 120 }) {
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

// Sub-view header — back + title (used in Insights/Presupuesto/Metas)
function SubHeader({ title, onBack }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 20px 0", height: 48,
    }}>
      <button onClick={onBack} style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "8px 14px 8px 8px",
        background: "rgba(255,255,255,0.16)",
        backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.22)",
        borderRadius: 9999,
        color: "#FFFFFF",
        fontSize: 13, fontWeight: 600,
        fontFamily: "inherit", cursor: "pointer",
      }}>
        <i className="ph-bold ph-caret-left" style={{ fontSize: 13 }} />
        Análisis
      </button>
      <h1 style={{
        margin: 0, fontFamily: "var(--gota-font-display)",
        fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: "#FFFFFF",
      }}>{title}</h1>
      <div style={{ width: 36 }} />
    </div>
  );
}

function WhiteZoneM({ children, padTop = 16, padBottom = 140, padX = 18 }) {
  return (
    <div style={{
      flex: 1, minHeight: 0, overflow: "auto",
      padding: `${padTop}px ${padX}px ${padBottom}px`,
      marginTop: -24, position: "relative",
    }}>{children}</div>
  );
}

function BZM({ active }) {
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      background: "rgba(255,255,255,0.94)",
      backdropFilter: "blur(20px) saturate(180%)",
      WebkitBackdropFilter: "blur(20px) saturate(180%)",
      borderTop: "1px solid rgba(33,120,168,0.08)",
      boxShadow: "0 -1px 0 rgba(255,255,255,0.6) inset, 0 -8px 24px rgba(13,24,41,0.04)",
      padding: "6px 16px 22px",
    }}>
      <NativeTabBar variant="topbar" active={active} integrated />
    </div>
  );
}

function CardM({ children, padding = 18, onClick, style }) {
  return (
    <div onClick={onClick} style={{
      background: "#FFFFFF", borderRadius: 18,
      boxShadow: "0 4px 14px rgba(8,40,70,0.06), 0 1px 2px rgba(13,24,41,0.04)",
      border: "1px solid rgba(13,24,41,0.04)",
      padding, cursor: onClick ? "pointer" : "default",
      ...style,
    }}>{children}</div>
  );
}

// =====================================================
// MENÚ — CuentaSheet (bottom sheet desplegado desde Avatar)
// Render: Home detrás (dimmed) + sheet ocupando ~80% bottom
// =====================================================

function MenuRow({ icon, iconColor = "#2178A8", iconBg = "rgba(33,120,168,0.10)", title, meta, last = false, rightSlot }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "14px 18px",
      borderBottom: last ? "0" : "1px solid rgba(13,24,41,0.06)",
      cursor: "pointer",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9999,
        background: iconBg,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <i className={`ph ${icon}`} style={{ fontSize: 16, color: iconColor }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: "#0D1829", fontWeight: 500 }}>{title}</div>
        {meta && <div style={{ fontSize: 11, color: "#90A4B0", marginTop: 1 }}>{meta}</div>}
      </div>
      {rightSlot || <i className="ph-bold ph-caret-right" style={{ fontSize: 12, color: "#B8C9D4" }} />}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      padding: "12px 18px 6px",
      fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
      textTransform: "uppercase", color: "#4A6070",
    }}>{children}</div>
  );
}

const S5_Menu = () => (
  <ShellM>
    {/* Home dimmed in background */}
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 44 }}>
      {/* Reusing a tiny snapshot of S5 home (blue zone visible) */}
      <BlueZoneM height={236}>
        <StatBarM light />
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 20px 0", height: 48,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9999,
            background: "rgba(255,255,255,0.20)", border: "1px solid rgba(255,255,255,0.30)",
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700,
          }}>F</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>Mayo 2026</div>
          <div style={{ width: 36, height: 36 }} />
        </div>
      </BlueZoneM>
      {/* dim overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(13,24,41,0.45)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
      }} />
    </div>

    {/* Bottom sheet */}
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      maxHeight: "82%",
      background: "#F4F7FA",
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      boxShadow: "0 -10px 30px rgba(8,40,70,0.18)",
      overflowY: "auto",
      paddingBottom: 28,
    }}>
      {/* Drag handle */}
      <div style={{
        height: 24, display: "flex", justifyContent: "center", alignItems: "center",
        paddingTop: 6,
      }}>
        <div style={{ width: 38, height: 4, borderRadius: 9999, background: "rgba(13,24,41,0.15)" }} />
      </div>

      {/* Title row */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "0 20px 14px",
      }}>
        <h2 style={{
          margin: 0, fontFamily: "var(--gota-font-display)",
          fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", color: "#0D1829",
        }}>Mi cuenta</h2>
        <button style={{
          width: 30, height: 30, borderRadius: 9999, border: 0,
          background: "rgba(13,24,41,0.06)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
        }}>
          <i className="ph-bold ph-x" style={{ fontSize: 14, color: "#4A6070" }} />
        </button>
      </div>

      {/* User card */}
      <div style={{ padding: "0 18px 14px" }}>
        <CardM padding={16}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 9999,
              background: "linear-gradient(135deg, #2178A8 0%, #1B6A93 100%)",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 700,
            }}>F</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0D1829" }}>facu@ejemplo.com</div>
              <div style={{ fontSize: 11, color: "#90A4B0", marginTop: 1 }}>Usuario · Plan Gratis</div>
            </div>
            <i className="ph-bold ph-caret-right" style={{ fontSize: 12, color: "#B8C9D4" }} />
          </div>
        </CardM>
      </div>

      {/* Configuración */}
      <div style={{ padding: "0 18px 14px" }}>
        <SectionLabel>Configuración</SectionLabel>
        <CardM padding={0}>
          <MenuRow
            icon="ph-bank"
            title="Cuentas"
            meta="3 cuentas conectadas"
            rightSlot={<>
              <span style={{ fontSize: 12, color: "#4A6070", fontWeight: 600, marginRight: 6 }}>3</span>
              <i className="ph-bold ph-caret-right" style={{ fontSize: 12, color: "#B8C9D4" }} />
            </>}
          />
          <MenuRow
            icon="ph-credit-card"
            iconColor="#B84A12" iconBg="rgba(184,74,18,0.10)"
            title="Tarjetas"
            meta="Visa Galicia · Mastercard MP"
            rightSlot={<>
              <span style={{ fontSize: 12, color: "#4A6070", fontWeight: 600, marginRight: 6 }}>2</span>
              <i className="ph-bold ph-caret-right" style={{ fontSize: 12, color: "#B8C9D4" }} />
            </>}
          />
          <MenuRow
            icon="ph-arrows-clockwise"
            iconColor="#1A7A42" iconBg="rgba(26,122,66,0.10)"
            title="Suscripciones"
            meta="Spotify, Netflix, iCloud y 2 más"
            last
            rightSlot={<>
              <span style={{ fontSize: 12, color: "#4A6070", fontWeight: 600, marginRight: 6 }}>5</span>
              <i className="ph-bold ph-caret-right" style={{ fontSize: 12, color: "#B8C9D4" }} />
            </>}
          />
        </CardM>
      </div>

      {/* Preferencias */}
      <div style={{ padding: "0 18px 14px" }}>
        <SectionLabel>Preferencias</SectionLabel>
        <CardM padding={0}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "14px 18px",
            borderBottom: "1px solid rgba(13,24,41,0.06)",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: "#0D1829", fontWeight: 500 }}>Moneda predeterminada</div>
              <div style={{ fontSize: 11, color: "#90A4B0", marginTop: 1 }}>Para nuevos movimientos</div>
            </div>
            <div style={{
              display: "inline-flex", padding: 3, borderRadius: 9999,
              background: "rgba(13,24,41,0.06)",
            }}>
              <button style={{
                padding: "5px 12px", borderRadius: 9999, border: 0,
                background: "#2178A8", color: "#FFFFFF",
                fontSize: 11, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
              }}>ARS</button>
              <button style={{
                padding: "5px 12px", borderRadius: 9999, border: 0,
                background: "transparent", color: "#4A6070",
                fontSize: 11, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
              }}>USD</button>
            </div>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "14px 18px", cursor: "pointer",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: "#0D1829", fontWeight: 500 }}>Saldo Vivo</div>
              <div style={{ fontSize: 11, color: "#90A4B0", marginTop: 1 }}>Modo de cálculo del hero</div>
            </div>
            <span style={{ fontSize: 12, color: "#4A6070", fontWeight: 600 }}>Total ARS</span>
            <i className="ph-bold ph-caret-right" style={{ fontSize: 12, color: "#B8C9D4" }} />
          </div>
        </CardM>
      </div>

      {/* Seguridad */}
      <div style={{ padding: "0 18px 14px" }}>
        <SectionLabel>Seguridad</SectionLabel>
        <CardM padding={0}>
          <MenuRow icon="ph-lock" title="Actualizar contraseña" last />
        </CardM>
      </div>

      {/* Privacidad + Cerrar sesión + Eliminar */}
      <div style={{ padding: "0 18px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{
          padding: "12px 14px",
          background: "rgba(33,120,168,0.06)",
          borderRadius: 12,
          fontSize: 13, color: "#4A6070", lineHeight: 1.5,
        }}>
          <span style={{ color: "#0D1829", fontWeight: 600 }}>Privacidad y datos</span> · SmartInput usa IA para interpretar el texto que escribís y proponer un gasto editable.
        </div>
        <button style={{
          padding: "12px", borderRadius: 12,
          background: "#FFFFFF",
          border: "1px solid rgba(33,120,168,0.16)",
          color: "#0D1829",
          fontSize: 14, fontWeight: 600,
          fontFamily: "inherit", cursor: "pointer",
        }}>Cerrar sesión</button>
        <button style={{
          padding: "10px", border: 0, background: "transparent",
          color: "#A61E1E",
          fontSize: 12, fontWeight: 500,
          fontFamily: "inherit", cursor: "pointer",
        }}>Eliminar cuenta</button>
      </div>
    </div>
  </ShellM>
);

// =====================================================
// EXPLORAR (modal puente desde Análisis)
// =====================================================

function ExploreOption({ icon, iconColor, iconBg, title, meta, badge }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "16px 18px",
      cursor: "pointer",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 14,
        background: iconBg, border: `1px solid ${iconColor}22`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <i className={`ph ${icon}`} style={{ fontSize: 22, color: iconColor }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#0D1829" }}>{title}</span>
          {badge && (
            <span style={{
              minWidth: 18, height: 18, padding: "0 5px",
              borderRadius: 9999, background: "#A61E1E",
              color: "#FFFFFF", fontSize: 10, fontWeight: 800,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>{badge}</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#4A6070", marginTop: 2, lineHeight: 1.4 }}>{meta}</div>
      </div>
      <i className="ph-bold ph-caret-right" style={{ fontSize: 14, color: "#B8C9D4" }} />
    </div>
  );
}

const S5_Explorar = () => (
  <ShellM>
    {/* Faded Análisis behind */}
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 44 }}>
      <BlueZoneM height={300}>
        <StatBarM light />
        <div style={{ padding: "14px 22px 0", paddingTop: 14 }}>
          <div style={{
            fontFamily: "var(--gota-font-display)",
            fontSize: 19, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15,
            color: "rgba(255,255,255,0.85)",
          }}>Mayo viene 34% abajo<br/>de tu promedio</div>
        </div>
      </BlueZoneM>
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(13,24,41,0.45)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
      }} />
    </div>

    {/* Sheet */}
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      background: "#F4F7FA",
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      boxShadow: "0 -10px 30px rgba(8,40,70,0.18)",
      paddingBottom: 28,
    }}>
      <div style={{
        height: 24, display: "flex", justifyContent: "center", alignItems: "center",
        paddingTop: 6,
      }}>
        <div style={{ width: 38, height: 4, borderRadius: 9999, background: "rgba(13,24,41,0.15)" }} />
      </div>
      <div style={{ padding: "0 20px 14px" }}>
        <h2 style={{
          margin: 0, fontFamily: "var(--gota-font-display)",
          fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", color: "#0D1829",
        }}>Explorar tu mes</h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#4A6070" }}>
          Tres lentes para entender qué pasó en mayo.
        </p>
      </div>

      <div style={{ padding: "0 18px 0" }}>
        <CardM padding={0}>
          <ExploreOption
            icon="ph-sparkle"
            iconColor="#2178A8" iconBg="rgba(33,120,168,0.10)"
            title="Insights"
            meta="Estado del mes, fuga silenciosa, mapa de hábitos y compromisos."
          />
          <div style={{ borderTop: "1px solid rgba(13,24,41,0.06)" }} />
          <ExploreOption
            icon="ph-list-checks"
            iconColor="#B84A12" iconBg="rgba(184,74,18,0.10)"
            title="Presupuesto"
            meta="2 categorías pasadas, 1 al límite — necesitan tu mirada."
            badge="3"
          />
          <div style={{ borderTop: "1px solid rgba(13,24,41,0.06)" }} />
          <ExploreOption
            icon="ph-target"
            iconColor="#1A7A42" iconBg="rgba(26,122,66,0.10)"
            title="Metas"
            meta="3 metas activas. Viaje Sur va en ritmo."
          />
        </CardM>
      </div>
    </div>
  </ShellM>
);

// =====================================================
// INSIGHTS (drill desde Explorar)
// 4 cards: Estado del mes, Fuga Silenciosa, Mapa de Hábitos, Compromisos
// =====================================================

function InsightCard({ icon, iconColor, iconBg, label, amount, amountColor = "#0D1829", subtitle, children }) {
  return (
    <CardM padding={18}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9999,
            background: iconBg,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <i className={`ph ${icon}`} style={{ fontSize: 15, color: iconColor }} />
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.09em",
            textTransform: "uppercase", color: iconColor,
          }}>{label}</span>
        </div>
        <i className="ph-bold ph-caret-right" style={{ fontSize: 12, color: "#2178A8" }} />
      </div>
      {amount && (
        <div style={{
          fontFamily: "var(--gota-font-display)",
          fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em",
          color: amountColor, fontVariantNumeric: "tabular-nums", lineHeight: 1,
        }}>{amount}</div>
      )}
      {subtitle && <div style={{ fontSize: 12, color: "#90A4B0", marginTop: 8 }}>{subtitle}</div>}
      {children}
    </CardM>
  );
}

const S5_Insights = () => (
  <ShellM>
    <BlueZoneM height={108}>
      <StatBarM light />
      <SubHeader title="Insights" />
    </BlueZoneM>

    <WhiteZoneM>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Estado del mes */}
        <InsightCard
          icon="ph-arrow-up"
          iconColor="#1A7A42" iconBg="rgba(26,122,66,0.10)"
          label="Estado del mes"
          amount="+$ 192.300"
          amountColor="#1A7A42"
          subtitle="Ahorraste este mes"
        >
          <div style={{ fontSize: 12, color: "#90A4B0", marginTop: 6 }}>
            Entró <span style={{ color: "#0D1829", fontWeight: 700 }}>$ 850.000</span> · Salió <span style={{ color: "#0D1829", fontWeight: 700 }}>$ 657.700</span>
          </div>
        </InsightCard>

        {/* Fuga Silenciosa */}
        <InsightCard
          icon="ph-coins"
          iconColor="#4A6070" iconBg="rgba(74,96,112,0.10)"
          label="Fuga Silenciosa"
          amount="$ 47.820"
          amountColor="#E89A4C"
          subtitle="38 compras menores al Q1 del mes"
        >
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 4 }}>
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: 2,
                background: "#E89A4C", opacity: 0.3 + (i / 24) * 0.55,
              }} />
            ))}
          </div>
        </InsightCard>

        {/* Mapa de Hábitos */}
        <InsightCard
          icon="ph-calendar-dots"
          iconColor="#2178A8" iconBg="rgba(33,120,168,0.10)"
          label="Mapa de Hábitos"
        >
          <div style={{
            marginTop: 8,
            display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4,
          }}>
            {Array.from({ length: 28 }).map((_, i) => {
              // pseudo-heatmap
              const seeds = [0,1,2,0,1,3,2, 1,0,2,1,3,3,2, 0,1,1,2,3,2,1, 2,0,3,2,1,0,0];
              const v = seeds[i];
              const op = v === 0 ? 1 : 1;
              const bg = v === 0 ? "#EEF1F5" : v === 1 ? "rgba(33,120,168,0.20)" : v === 2 ? "rgba(33,120,168,0.50)" : "#2178A8";
              return <div key={i} style={{ height: 16, borderRadius: 3, background: bg, opacity: op }} />;
            })}
          </div>
        </InsightCard>

        {/* Compromisos */}
        <InsightCard
          icon="ph-credit-card"
          iconColor="#B84A12" iconBg="rgba(184,74,18,0.10)"
          label="Compromisos"
          amount="$ 320.000"
          subtitle="42% de tu sueldo · saludable"
        >
          <div style={{
            marginTop: 12, height: 6, borderRadius: 3,
            background: "rgba(33,120,168,0.08)",
            display: "flex", overflow: "hidden",
          }}>
            <div style={{ width: "56%", background: "#E89A4C" }} />
            <div style={{ width: "44%", background: "#2178A8" }} />
          </div>
          <div style={{
            marginTop: 8, display: "flex", justifyContent: "space-between",
            fontSize: 11, color: "#4A6070",
          }}>
            <span>A pagar <span style={{ fontWeight: 700, color: "#0D1829", fontVariantNumeric: "tabular-nums" }}>$ 180.000</span></span>
            <span>En curso <span style={{ fontWeight: 700, color: "#0D1829", fontVariantNumeric: "tabular-nums" }}>$ 140.000</span></span>
          </div>
        </InsightCard>
      </div>
    </WhiteZoneM>

    <BZM active="ana" />
  </ShellM>
);

// =====================================================
// PRESUPUESTO (BudgetsSection)
// =====================================================

const BUDGET_ITEMS = [
  { cat: "Supermercado",  status: "near_limit",   used: 84, expected: 75, spent: 92400,  total: 110000, icon: "ph-shopping-cart", iconBg: "rgba(26,122,66,0.10)", iconColor: "#1A7A42" },
  { cat: "Restaurantes",  status: "over_budget",  used: 113, expected: 85, spent: 48200, total: 42500,  icon: "ph-fork-knife",    iconBg: "rgba(184,74,18,0.10)", iconColor: "#B84A12" },
  { cat: "Transporte",    status: "on_track",     used: 64, expected: 78, spent: 32100,  total: 50000,  icon: "ph-bus",           iconBg: "rgba(33,120,168,0.10)", iconColor: "#2178A8" },
  { cat: "Servicios",     status: "ahead_of_pace",used: 42, expected: 80, spent: 28900,  total: 68000,  icon: "ph-lightning",     iconBg: "rgba(33,120,168,0.10)", iconColor: "#2178A8" },
  { cat: "Suscripciones", status: "on_track",     used: 70, expected: 75, spent: 19400,  total: 28000,  icon: "ph-arrows-clockwise", iconBg: "rgba(33,120,168,0.10)", iconColor: "#2178A8" },
  { cat: "Salud",         status: "on_track",     used: 25, expected: 70, spent: 8200,   total: 33000,  icon: "ph-first-aid",     iconBg: "rgba(166,30,30,0.10)", iconColor: "#A61E1E" },
];

const STATUS_META = {
  on_track:      { label: "En línea", color: "#1A7A42", bg: "rgba(26,122,66,0.10)" },
  near_limit:    { label: "Al límite", color: "#E89A4C", bg: "rgba(232,154,76,0.14)" },
  over_budget:   { label: "Pasado",   color: "#A61E1E", bg: "rgba(166,30,30,0.10)" },
  ahead_of_pace: { label: "Sobrado",  color: "#2178A8", bg: "rgba(33,120,168,0.10)" },
};

function BudgetRow({ item }) {
  const meta = STATUS_META[item.status];
  const usedPct = Math.min(item.used, 130);
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "14px 16px",
      borderBottom: "1px solid rgba(13,24,41,0.05)",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 9999,
        background: item.iconBg,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <i className={`ph ${item.icon}`} style={{ fontSize: 17, color: item.iconColor }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#0D1829" }}>{item.cat}</div>
          <div style={{
            fontSize: 15, fontWeight: 800, color: meta.color,
            fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em",
            display: "inline-flex", alignItems: "center", gap: 3,
          }}>
            {fmtARS(item.spent)}
            <i className="ph-bold ph-caret-right" style={{ fontSize: 10, color: "#B8C9D4" }} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, gap: 10 }}>
          <span style={{
            padding: "2px 8px", borderRadius: 9999,
            background: meta.bg, color: meta.color,
            fontSize: 10, fontWeight: 700,
          }}>{meta.label}</span>
          <span style={{ fontSize: 11, color: "#90A4B0" }}>
            de <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtARS(item.total)}</span>
          </span>
        </div>
        {/* dual-progress bar */}
        <div style={{
          position: "relative", marginTop: 10, height: 4, borderRadius: 9999,
          background: "#E6ECF2", overflow: "visible",
        }}>
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: `${Math.min(usedPct, 100)}%`,
            background: meta.color, borderRadius: 9999,
          }} />
          <div style={{
            position: "absolute", left: `${item.expected}%`,
            top: -4, width: 2, height: 12,
            background: "#B8C9D4", transform: "translateX(-50%)",
            borderRadius: 1,
          }} />
        </div>
      </div>
    </div>
  );
}

const S5_Presupuesto = () => (
  <ShellM>
    <BlueZoneM height={108}>
      <StatBarM light />
      <SubHeader title="Presupuesto" />
    </BlueZoneM>

    <WhiteZoneM>
      {/* Edit row */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "4px 4px 12px",
      }}>
        <span style={{ fontSize: 12, color: "#90A4B0" }}>Lectura operativa del mes</span>
        <button style={{
          padding: "5px 12px", borderRadius: 9999,
          background: "transparent",
          border: "1px solid rgba(33,120,168,0.30)",
          color: "#2178A8",
          fontSize: 12, fontWeight: 700,
          fontFamily: "inherit", cursor: "pointer",
        }}>Editar</button>
      </div>

      {/* Summary card */}
      <CardM padding={18}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
              textTransform: "uppercase", color: "#4A6070",
            }}>Disponible este mes</div>
            <div style={{
              marginTop: 6, fontFamily: "var(--gota-font-display)",
              fontSize: 28, fontWeight: 800, color: "#0D1829",
              letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1,
            }}>$ 102.900</div>
            <div style={{ marginTop: 6, fontSize: 12, color: "#90A4B0" }}>
              de <span style={{ fontVariantNumeric: "tabular-nums" }}>$ 331.500</span> presupuestados
            </div>
          </div>
          <div style={{
            padding: "8px 14px", borderRadius: 14,
            background: "rgba(33,120,168,0.06)", textAlign: "right",
          }}>
            <div style={{ fontSize: 11, color: "#4A6070", fontWeight: 500 }}>Gastado</div>
            <div style={{
              fontSize: 15, fontWeight: 800, color: "#0D1829",
              fontVariantNumeric: "tabular-nums", marginTop: 2,
            }}>$ 228.600</div>
          </div>
        </div>

        {/* Status pills */}
        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <div style={{
            flex: 1, textAlign: "center", padding: "7px",
            borderRadius: 9999,
            background: "rgba(166,30,30,0.10)", color: "#A61E1E",
            fontSize: 11, fontWeight: 800,
          }}>1 pasado</div>
          <div style={{
            flex: 1, textAlign: "center", padding: "7px",
            borderRadius: 9999,
            background: "rgba(232,154,76,0.14)", color: "#B36418",
            fontSize: 11, fontWeight: 800,
          }}>1 al límite</div>
          <div style={{
            flex: 1, textAlign: "center", padding: "7px",
            borderRadius: 9999,
            background: "rgba(33,120,168,0.10)", color: "#2178A8",
            fontSize: 11, fontWeight: 800,
          }}>1 sobrado</div>
        </div>
      </CardM>

      {/* List */}
      <div style={{ marginTop: 18 }}>
        <CardM padding={0}>
          {BUDGET_ITEMS.map((it, i) => (
            <div key={i} style={{ borderBottom: i === BUDGET_ITEMS.length - 1 ? "0" : "" }}>
              <BudgetRow item={it} />
            </div>
          ))}
        </CardM>
      </div>
    </WhiteZoneM>

    <BZM active="ana" />
  </ShellM>
);

// =====================================================
// METAS (GoalsSection)
// =====================================================

const GOALS = [
  {
    emoji: "🏖️", name: "Viaje al sur", status: "active",
    current: 380000, target: 600000, currency: "ARS",
    pct: 63, paceStatus: "on_track", paceCopy: "Vas en ritmo", paceColor: "#1A7A42",
    targetDate: "diciembre 2026",
    needed: "Necesitás $ 31.500/mes",
  },
  {
    emoji: "💍", name: "Anillo", status: "active",
    current: 120000, target: 450000, currency: "ARS",
    pct: 27, paceStatus: "behind", paceCopy: "Atrasada", paceColor: "#E89A4C",
    targetDate: "agosto 2026",
    needed: "Necesitás $ 110.000/mes",
  },
  {
    emoji: "💻", name: "Notebook", status: "active",
    current: 850000, target: 1400000, currency: "ARS",
    pct: 61, paceStatus: "on_track", paceCopy: "Vas en ritmo", paceColor: "#1A7A42",
    targetDate: null,
    needed: null,
  },
];

const GOAL_BADGE = {
  active:    { label: "Activa",    bg: "rgba(33,120,168,0.10)", color: "#2178A8" },
  paused:    { label: "Pausada",   bg: "rgba(13,24,41,0.06)",   color: "#4A6070" },
  completed: { label: "Cumplida",  bg: "rgba(26,122,66,0.10)",  color: "#1A7A42" },
};

function GoalRowS5({ goal }) {
  const badge = GOAL_BADGE[goal.status];
  const barColor = goal.paceStatus === "behind" ? "#E89A4C" : "#2178A8";
  return (
    <CardM padding={18}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>{goal.emoji}</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#0D1829", letterSpacing: "-0.01em" }}>{goal.name}</span>
        </div>
        <span style={{
          padding: "3px 10px", borderRadius: 9999,
          background: badge.bg, color: badge.color,
          fontSize: 10, fontWeight: 800,
          flexShrink: 0,
        }}>{badge.label}</span>
      </div>

      {/* Progress bar */}
      <div style={{
        marginTop: 14, height: 8, borderRadius: 9999,
        background: "#E6ECF2", overflow: "hidden",
      }}>
        <div style={{
          width: `${goal.pct}%`, height: "100%", background: barColor,
          borderRadius: 9999,
        }} />
      </div>

      {/* Amounts */}
      <div style={{
        marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "baseline",
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0D1829", fontVariantNumeric: "tabular-nums" }}>
          {fmtARS(goal.current)} <span style={{ color: "#90A4B0", fontWeight: 500 }}>de {fmtARS(goal.target)}</span>
        </span>
        <span style={{ fontSize: 11, color: "#90A4B0" }}>
          Faltan <span style={{ fontVariantNumeric: "tabular-nums" }}>{fmtARS(goal.target - goal.current)}</span>
        </span>
      </div>

      {/* Pace + CTAs */}
      <div style={{
        marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          {goal.targetDate && (
            <span style={{ fontSize: 11, color: "#90A4B0" }}>Para {goal.targetDate}</span>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: goal.needed ? "#4A6070" : goal.paceColor }}>
            {goal.needed || goal.paceCopy}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button style={{
            padding: "7px 12px", borderRadius: 12,
            background: "#FFFFFF",
            border: "1px solid rgba(33,120,168,0.20)",
            color: "#4A6070",
            fontSize: 12, fontWeight: 700,
            fontFamily: "inherit", cursor: "pointer",
          }}>Detalle</button>
          <button style={{
            padding: "7px 14px", borderRadius: 12, border: 0,
            background: "#2178A8", color: "#FFFFFF",
            fontSize: 12, fontWeight: 700,
            fontFamily: "inherit", cursor: "pointer",
            boxShadow: "0 2px 6px rgba(33,120,168,0.22)",
          }}>Aportar</button>
        </div>
      </div>
    </CardM>
  );
}

const S5_Metas = () => (
  <ShellM>
    <BlueZoneM height={108}>
      <StatBarM light />
      <SubHeader title="Metas" />
    </BlueZoneM>

    <WhiteZoneM>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "4px 4px 14px",
      }}>
        <span style={{ fontSize: 12, color: "#90A4B0" }}>3 metas activas</span>
        <button style={{
          padding: "6px 14px", borderRadius: 9999, border: 0,
          background: "#2178A8", color: "#FFFFFF",
          fontSize: 12, fontWeight: 700,
          fontFamily: "inherit", cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 5,
          boxShadow: "0 2px 6px rgba(33,120,168,0.22)",
        }}>
          <i className="ph-bold ph-plus" style={{ fontSize: 11 }} />
          Nueva meta
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {GOALS.map((g, i) => <GoalRowS5 key={i} goal={g} />)}
      </div>

      {/* Completadas divider */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        margin: "20px 4px 12px",
      }}>
        <div style={{ flex: 1, height: 1, background: "rgba(33,120,168,0.10)" }} />
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: "#90A4B0",
        }}>Completadas</span>
        <div style={{ flex: 1, height: 1, background: "rgba(33,120,168,0.10)" }} />
      </div>

      <CardM padding={18} style={{ opacity: 0.72 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 22 }}>📱</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#0D1829" }}>iPhone nuevo</span>
          </div>
          <span style={{
            padding: "3px 10px", borderRadius: 9999,
            background: GOAL_BADGE.completed.bg, color: GOAL_BADGE.completed.color,
            fontSize: 10, fontWeight: 800,
          }}>Cumplida</span>
        </div>
        <div style={{
          marginTop: 14, height: 8, borderRadius: 9999,
          background: "#E6ECF2", overflow: "hidden",
        }}>
          <div style={{ width: "100%", height: "100%", background: "#1A7A42" }} />
        </div>
        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: "#0D1829", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>$ 1.350.000 <span style={{ color: "#90A4B0", fontWeight: 500 }}>de $ 1.350.000</span></span>
          <span style={{ color: "#1A7A42", fontWeight: 700 }}>Objetivo cumplido</span>
        </div>
      </CardM>
    </WhiteZoneM>

    <BZM active="ana" />
  </ShellM>
);

Object.assign(window, { S5_Menu, S5_Explorar, S5_Insights, S5_Presupuesto, S5_Metas });
