import { useState } from "react";
import {
  Home, BarChart2, Settings, ShoppingBag, UtensilsCrossed,
  Coffee, Zap, CreditCard, Wallet, ChevronDown, ArrowRight,
  Plus, Sparkles, TrendingDown, LogOut, Trash2, Save, Check, ChevronRight
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const C = {
  bg:          "#050A14",
  surface:     "rgba(148,210,255,0.05)",
  border:      "rgba(148,210,255,0.15)",
  borderLight: "rgba(148,210,255,0.09)",
  textPrimary: "#ffffff",
  textSecond:  "#7B98B8",
  textDim:     "#4B6472",
  cyan:        "#38BDF8",
  green:       "#4ADE80",
  orange:      "#FB923C",
  red:         "#F87171",
};

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const gastos = [
  { id: 1, icon: ShoppingBag,     label: "Regalo Agus bolso",    cat: "Ropa e Indumentaria", monto: 50000,  dot: C.orange },
  { id: 2, icon: UtensilsCrossed, label: "Hamburguesas shopping", cat: "Restaurantes",         monto: 47900,  dot: C.orange },
  { id: 3, icon: Coffee,          label: "Café reunión",          cat: "Restaurantes",         monto: 18000,  dot: C.orange },
  { id: 4, icon: Zap,             label: "Luz mes de marzo",      cat: "Servicios",            monto: 155950, dot: C.green },
];

// ─── Shared UI ────────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 600, letterSpacing: "0.18em",
      textTransform: "uppercase", color: C.textSecond, marginBottom: 12,
    }}>
      {children}
    </p>
  );
}

function SettingsRow({ label, value, chevron, danger }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "16px 0",
      borderBottom: `1px solid ${C.borderLight}`,
    }}>
      <span style={{ fontSize: 14, fontWeight: 500, color: danger || C.textPrimary }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {value && <span style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, letterSpacing: "-0.01em" }}>{value}</span>}
        {chevron && <ChevronRight size={15} style={{ color: C.textDim }} />}
      </div>
    </div>
  );
}

function MonthHeader() {
  return (
    <div style={{ padding: "20px 24px 0" }}>
      <button style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 900, color: C.textPrimary, letterSpacing: "-0.02em" }}>Marzo</span>
        <ChevronDown size={16} style={{ color: C.textSecond, marginTop: 2 }} />
      </button>
    </div>
  );
}

// ─── Ring ─────────────────────────────────────────────────────────────────────
function Ring({ pct, color, size = 72, stroke = 7, label }) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(148,210,255,0.08)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
      </svg>
      <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: "-0.01em" }}>{pct}%</span>
      <span style={{ fontSize: 10, color: C.textSecond, letterSpacing: "0.08em" }}>{label}</span>
    </div>
  );
}

// ─── Battery Bar ──────────────────────────────────────────────────────────────
function BatteryBar({ pct, colorLeft, colorRight, labelLeft, labelRight, subleft, subright }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: C.textSecond, letterSpacing: "0.1em", textTransform: "uppercase" }}>{labelLeft}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: C.textSecond, letterSpacing: "0.1em", textTransform: "uppercase" }}>{labelRight}</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, overflow: "hidden", background: C.surface, display: "flex" }}>
        <div style={{ width: `${pct}%`, background: colorLeft, borderRadius: "999px 0 0 999px" }} />
        <div style={{ width: 1.5, background: C.bg, flexShrink: 0 }} />
        <div style={{ flex: 1, background: colorRight, borderRadius: "0 999px 999px 0" }} />
      </div>
      {(subleft || subright) && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 10, color: C.textDim }}>{subleft}</span>
          <span style={{ fontSize: 10, color: C.textDim }}>{subright}</span>
        </div>
      )}
    </div>
  );
}

// ─── Single Pill Bar ──────────────────────────────────────────────────────────
function PillBar({ pct, color, label, amount }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color, letterSpacing: "-0.01em" }}>{pct}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 999, background: "rgba(148,210,255,0.08)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999 }} />
      </div>
      {amount && <p style={{ fontSize: 11, color: C.textDim, marginTop: 5 }}>{amount}</p>}
    </div>
  );
}

// ─── Wave Chart ───────────────────────────────────────────────────────────────
function WaveChart() {
  const gastosData   = [0, 0, 0, 220000, 312000, 272000];
  const ingresosData = [0, 0, 0, 410000, 450000, 342000];
  const meses        = ["Oct","Nov","Dic","Ene","Feb","Mar"];
  const W = 375, H = 130, padY = 20;
  const max = Math.max(...gastosData, ...ingresosData);
  const px  = (i) => (i / (gastosData.length - 1)) * W;
  const py  = (v)  => H - padY - (v / max) * (H - padY * 2);

  const wave = (data, close) => {
    const pts = data.map((v, i) => [px(i), py(v)]);
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const dx = x1 - x0;
      d += ` C${x0 + dx * 0.42},${y0 + (y1 - y0) * 0.06} ${x1 - dx * 0.56},${y1 - (y1 - y0) * 0.20} ${x1},${y1}`;
    }
    if (close) d += ` L${pts[pts.length-1][0]},${H+8} L${pts[0][0]},${H+8} Z`;
    return d;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H+22}`} width="100%" style={{ display: "block" }}>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={C.green} stopOpacity="0.36" />
          <stop offset="100%" stopColor={C.green} stopOpacity="0"    />
        </linearGradient>
        <linearGradient id="lc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={C.cyan}  stopOpacity="0.30" />
          <stop offset="100%" stopColor={C.cyan}  stopOpacity="0"    />
        </linearGradient>
      </defs>
      <path d={wave(ingresosData, true)}  fill="url(#lg)" />
      <path d={wave(gastosData,   true)}  fill="url(#lc)" />
      <path d={wave(ingresosData, false)} fill="none" stroke={C.green} strokeWidth="1.8" strokeLinecap="round" />
      <path d={wave(gastosData,   false)} fill="none" stroke={C.cyan}  strokeWidth="1.8" strokeLinecap="round" />
      {gastosData.map((v, i) => v > 0 && (
        <g key={i}>
          <circle cx={px(i)} cy={py(v)} r="5"   fill={C.cyan}  fillOpacity="0.12" />
          <circle cx={px(i)} cy={py(v)} r="2.8" fill={C.cyan}  stroke={C.bg} strokeWidth="1.4" />
        </g>
      ))}
      {ingresosData.map((v, i) => v > 0 && (
        <g key={i}>
          <circle cx={px(i)} cy={py(v)} r="5"   fill={C.green} fillOpacity="0.12" />
          <circle cx={px(i)} cy={py(v)} r="2.8" fill={C.green} stroke={C.bg} strokeWidth="1.4" />
        </g>
      ))}
      {meses.map((m, i) => (
        <text key={i} x={px(i)} y={H+18}
          textAnchor={i === 0 ? "start" : i === meses.length-1 ? "end" : "middle"}
          fontSize="9" fontFamily="monospace"
          fill={m === "Mar" ? C.cyan : C.textDim}
          fontWeight={m === "Mar" ? "700" : "400"}>
          {m}
        </text>
      ))}
    </svg>
  );
}

// ─── Screens ──────────────────────────────────────────────────────────────────
function HomeScreen() {
  const [input, setInput] = useState("");
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <MonthHeader />

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

        {/* Hero */}
        <div style={{ padding: "24px 24px 20px", position: "relative" }}>
          <div style={{
            position: "absolute", top: -20, left: -30, width: 280, height: 200,
            borderRadius: "50%", pointerEvents: "none", zIndex: 0,
            background: "radial-gradient(ellipse, rgba(56,189,248,0.16) 0%, transparent 70%)",
            filter: "blur(40px)",
          }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: C.textSecond, marginBottom: 4 }}>Disponible</p>
            <p style={{ fontSize: 46, fontWeight: 900, letterSpacing: "-0.04em", color: C.textPrimary, lineHeight: 1, margin: 0 }}>{fmt(6342399)}</p>
            <p style={{ fontSize: 12, color: C.textSecond, marginTop: 8 }}>
              {fmt(200000)} <span style={{ color: C.cyan }}>por día</span> disponibles este mes
            </p>
          </div>
        </div>

        {/* Twin Pills */}
        <div style={{ display: "flex", gap: 10, padding: "0 16px 20px" }}>
          {[
            { Icon: Wallet,     label: "Percibidos", val: fmt(150000) },
            { Icon: CreditCard, label: "Tarjeta",    val: fmt(271850) },
          ].map(({ Icon, label, val }) => (
            <div key={label} style={{
              flex: 1, display: "flex", alignItems: "center", gap: 12,
              padding: "14px 16px", borderRadius: "2rem",
              background: C.surface, border: `1px solid ${C.border}`,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: "rgba(148,210,255,0.08)", border: `1px solid ${C.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={14} style={{ color: C.textSecond }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: C.textSecond, lineHeight: 1, marginBottom: 5 }}>{label}</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, letterSpacing: "-0.02em", lineHeight: 1 }}>{val}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Balance bar */}
        <div style={{ padding: "0 24px 24px" }}>
          <BatteryBar
            pct={25}
            colorLeft={C.green} colorRight={C.orange}
            labelLeft="Necesidad · 25%" labelRight="Deseo · 75%"
            subleft={`1 gasto · ${fmt(155950)}`} subright={`3 gastos · ${fmt(115900)}`}
          />
        </div>

        {/* Expense list */}
        <div style={{ padding: "0 24px", flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <SectionLabel>Últimos gastos</SectionLabel>
            <button style={{ fontSize: 11, color: C.cyan, fontWeight: 500, background: "none", border: "none", cursor: "pointer", marginBottom: 12 }}>Ver todos →</button>
          </div>
          {gastos.map((g, idx) => {
            const Icon = g.icon;
            return (
              <div key={g.id} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 0",
                borderBottom: idx < gastos.length - 1 ? `1px solid ${C.borderLight}` : "none",
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                  background: "rgba(148,210,255,0.08)", border: `1px solid ${C.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={15} style={{ color: C.textSecond }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.label}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: g.dot, flexShrink: 0, display: "inline-block" }} />
                    <span style={{ fontSize: 11, color: C.textSecond }}>{g.cat}</span>
                  </div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, letterSpacing: "-0.01em" }}>{fmt(g.monto)}</span>
              </div>
            );
          })}
        </div>

        <div style={{ height: 90 }} />
      </div>

      {/* Command input */}
      <div style={{
        position: "absolute", bottom: 70, left: 16, right: 16,
        display: "flex", alignItems: "center", gap: 10,
        borderRadius: 999,
        background: "rgba(11,18,33,0.92)",
        border: `1px solid ${C.border}`,
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        padding: "10px 10px 10px 18px",
      }}>
        <Plus size={14} style={{ color: C.textSecond, flexShrink: 0 }} />
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Escribe un gasto..."
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: C.textPrimary, caretColor: C.cyan }}
        />
        <style>{`input::placeholder { color: #7B98B8; }`}</style>
        <div style={{
          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
          background: input ? C.cyan : "rgba(148,210,255,0.08)",
          border: input ? "none" : `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 200ms, border 200ms", cursor: input ? "pointer" : "default",
        }}>
          <ArrowRight size={14} style={{ color: input ? C.bg : C.textSecond, transition: "color 200ms" }} />
        </div>
      </div>
    </div>
  );
}

function AnalisisScreen() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <MonthHeader />

      <div style={{ flex: 1, overflowY: "auto" }}>

        {/* Legend */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 12px" }}>
          <div style={{ display: "flex", gap: 16 }}>
            {[{ color: C.cyan, label: "Gastos" }, { color: C.green, label: "Ingresos" }].map(l => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: l.color, display: "inline-block" }} />
                <span style={{ fontSize: 10, color: C.textSecond }}>{l.label}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
            <span style={{ color: C.textDim }}>Feb <span style={{ color: C.textPrimary, fontWeight: 600 }}>$312k</span></span>
            <span style={{ color: C.cyan }}>Mar <span style={{ color: C.textPrimary, fontWeight: 600 }}>$272k</span></span>
          </div>
        </div>

        {/* Edge-to-edge wave chart */}
        <div style={{ marginBottom: 20 }}>
          <WaveChart />
        </div>

        {/* Insight pill */}
        <div style={{ margin: "0 16px 24px" }}>
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 14,
            padding: "16px 20px", borderRadius: "2rem",
            background: C.surface, border: `1px solid ${C.border}`,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
              background: "rgba(56,189,248,0.12)", border: `1px solid rgba(56,189,248,0.2)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Sparkles size={14} style={{ color: C.cyan }} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.textPrimary, marginBottom: 4 }}>Buen trabajo este mes</p>
              <p style={{ fontSize: 12, color: C.textSecond, lineHeight: 1.5 }}>
                Gastaste un <span style={{ color: C.green, fontWeight: 600 }}>15% menos</span> en Deseos que en Febrero.
              </p>
            </div>
          </div>
        </div>

        {/* Rings — cardless, floating */}
        <div style={{ padding: "0 24px 28px" }}>
          <SectionLabel>Necesidades vs. Deseos</SectionLabel>
          <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
            <Ring pct={25} color={C.green}  label="Necesidad" />
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 10, color: C.textDim, marginBottom: 4 }}>4 gastos</p>
              <p style={{ fontSize: 24, fontWeight: 900, color: C.textPrimary, letterSpacing: "-0.03em" }}>{fmt(271850)}</p>
            </div>
            <Ring pct={75} color={C.orange} label="Deseo" />
          </div>
        </div>

        {/* Distribution bars — cardless */}
        <div style={{ padding: "0 24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
          <SectionLabel>Distribución</SectionLabel>
          <PillBar pct={82} color={C.cyan}   label="Ropa e Indumentaria" amount={fmt(221850)} />
          <PillBar pct={18} color={C.orange} label="Restaurantes"         amount={fmt(47900)}  />
        </div>

        {/* Export */}
        <div style={{ padding: "0 16px 24px" }}>
          <button style={{
            width: "100%", padding: "14px", borderRadius: "2rem",
            background: C.surface, border: `1px solid ${C.border}`,
            fontSize: 13, fontWeight: 600, color: C.cyan,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            cursor: "pointer",
          }}>
            <TrendingDown size={14} /> Exportar gastos (CSV)
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfigScreen() {
  const [currency, setCurrency] = useState("ARS");
  const [saved, setSaved]       = useState(false);
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 1800); };

  const ingresos = [
    { label: "Ingreso ARS",       val: "$ 6.000.000" },
    { label: "Ingreso USD",       val: "USD 0" },
    { label: "Saldo inicial ARS", val: "$ 342.399" },
    { label: "Saldo inicial USD", val: "USD 0" },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "32px 24px 32px" }}>
      {/* Title */}
      <p style={{ fontSize: 30, fontWeight: 900, color: C.textPrimary, letterSpacing: "-0.03em", marginBottom: 36 }}>
        Configuración
      </p>

      {/* Moneda */}
      <SectionLabel>Moneda predeterminada</SectionLabel>
      <div style={{
        display: "inline-flex", borderRadius: 999, padding: 4,
        background: "rgba(148,210,255,0.04)", border: `1px solid ${C.borderLight}`,
        marginBottom: 32,
      }}>
        {["ARS","USD"].map(c => (
          <button key={c} onClick={() => setCurrency(c)} style={{
            padding: "8px 28px", borderRadius: 999, fontSize: 13, fontWeight: 700,
            background: currency === c ? "rgba(148,210,255,0.18)" : "transparent",
            border: currency === c ? `1px solid ${C.border}` : "1px solid transparent",
            color: currency === c ? C.textPrimary : C.textSecond,
            cursor: "pointer", transition: "all 200ms",
          }}>
            {c}
          </button>
        ))}
      </div>

      {/* Ingresos */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 0 }}>
          <SectionLabel>Ingresos mensuales</SectionLabel>
          <button style={{ fontSize: 11, color: C.textSecond, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, marginBottom: 12 }}>
            Marzo 2026 <ChevronDown size={11} style={{ marginTop: 1 }} />
          </button>
        </div>
        {ingresos.map((f) => (
          <div key={f.label} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 0",
            borderBottom: `1px solid ${C.borderLight}`,
          }}>
            <span style={{ fontSize: 13, color: C.textSecond }}>{f.label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, letterSpacing: "-0.01em" }}>{f.val}</span>
          </div>
        ))}
        <p style={{ fontSize: 11, color: C.textDim, marginTop: 10, marginBottom: 0 }}>
          Saldo inicial: el dinero que ya tenías antes de este mes
        </p>
      </div>

      {/* Save button */}
      <button onClick={handleSave} style={{
        width: "100%", padding: "14px", borderRadius: 999, marginTop: 16, marginBottom: 32,
        fontSize: 13, fontWeight: 700,
        background: saved ? "rgba(74,222,128,0.10)" : "rgba(56,189,248,0.10)",
        border: saved ? "1px solid rgba(74,222,128,0.25)" : `1px solid rgba(56,189,248,0.25)`,
        color: saved ? C.green : C.cyan,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        cursor: "pointer", transition: "all 250ms",
      }}>
        {saved ? <><Check size={14} />Guardado</> : <><Save size={14} />Guardar ingreso</>}
      </button>

      {/* Preferencias */}
      <SectionLabel>Preferencias</SectionLabel>
      <SettingsRow label="Tarjetas vinculadas" value="4" chevron />

      {/* Cuenta */}
      <div style={{ marginTop: 28 }}>
        <SectionLabel>Cuenta</SectionLabel>
        <SettingsRow label="Email" value="facundortiz.14@gmail.com" />
      </div>

      {/* Danger zone */}
      <div style={{ marginTop: 44, display: "flex", flexDirection: "column", gap: 20 }}>
        <button style={{
          display: "flex", alignItems: "center", gap: 10, background: "none", border: "none",
          color: C.orange, fontSize: 14, fontWeight: 600, cursor: "pointer",
        }}>
          <LogOut size={15} /> Cerrar sesión
        </button>
        <button style={{
          display: "flex", alignItems: "center", gap: 10, background: "none", border: "none",
          color: C.red, fontSize: 14, fontWeight: 600, cursor: "pointer",
        }}>
          <Trash2 size={15} /> Eliminar mi cuenta
        </button>
      </div>
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────
const tabs = [
  { id: "home",     label: "Home",     Icon: Home },
  { id: "analisis", label: "Análisis", Icon: BarChart2 },
  { id: "config",   label: "Config",   Icon: Settings },
];

export default function GotaOcean() {
  const [active, setActive] = useState("home");

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#030810", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Phone */}
      <div style={{
        position: "relative", display: "flex", flexDirection: "column",
        width: 375, height: 812, background: C.bg,
        borderRadius: "3rem", overflow: "hidden",
        border: "1px solid rgba(148,210,255,0.09)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(148,210,255,0.06)",
      }}>

        {/* Status bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 0", flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.textPrimary }}>9:22</span>
          <span style={{ fontSize: 11, color: C.textSecond }}>10%</span>
        </div>

        {/* Screen — fills between status bar and nav */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
          {active === "home"     && <HomeScreen />}
          {active === "analisis" && <AnalisisScreen />}
          {active === "config"   && <ConfigScreen />}
        </div>

        {/* Floating pill nav */}
        <div style={{ flexShrink: 0, display: "flex", justifyContent: "center", padding: "8px 0 20px" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 2,
            padding: "8px 10px", borderRadius: 999,
            background: "rgba(5,12,28,0.94)",
            border: `1px solid ${C.border}`,
            backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
            boxShadow: `0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(148,210,255,0.06)`,
          }}>
            {tabs.map(({ id, label, Icon }) => {
              const on = active === id;
              return (
                <button key={id} onClick={() => setActive(id)} style={{
                  display: "flex", alignItems: "center", gap: on ? 8 : 0,
                  padding: on ? "9px 18px" : "9px 14px",
                  borderRadius: 999,
                  background: on ? "rgba(148,210,255,0.14)" : "transparent",
                  border: "none", cursor: "pointer",
                  transition: "all 200ms",
                  overflow: "hidden",
                }}>
                  <Icon size={17} style={{ color: on ? "#fff" : C.textSecond, strokeWidth: on ? 2.2 : 1.7, flexShrink: 0 }} />
                  {on && <span style={{ fontSize: 12, fontWeight: 600, color: C.textPrimary, whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>{label}</span>}
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
