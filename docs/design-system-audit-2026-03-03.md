# HISTORICO - NO VIGENTE - Informe stack de diseno Gota

> Auditoria del sistema anterior. Fuente visual vigente: `docs/design-system-final.md` + `app/globals.css`.

# INFORME — STACK DE DISEÑO GOTA · Estado actual
**Fecha de referencia:** 2026-03-03

---

## 1. TOKENS GLOBALES (`globals.css`)

### Colores
| Token | Valor | Uso |
|---|---|---|
| `bg-primary` | `#050A14` | Fondo base de toda la app |
| `bg-secondary` | `#0b1221` | Cards, modales, filtros |
| `bg-tertiary` | `#0f1c30` | Inputs, rows, elementos internos |
| `bg-elevated` | `#1a2d42` | Fallback glass sin blur |
| `surface` | `rgba(148,210,255,0.05)` | Pills flotantes, twin pills |
| `text-primary` | `#f0f9ff` | Texto principal |
| `text-secondary` | `#bae6fd` | Labels de formulario |
| `text-tertiary` | `#94a3b8` | Texto auxiliar, fechas |
| `text-disabled` | `#64748b` | Spinner borde, handle bar |
| `text-label` | `#7B98B8` | Headers de sección, íconos |
| `text-dim` | `#4B6472` | Sublabels, placeholder |
| `border-subtle` | `#132030` | Separadores internos |
| `border-strong` | `#334155` | Handle bars |
| `border-ocean` | `rgba(148,210,255,0.15)` | Bordes de cards, pills, inputs activos |
| `primary` | `#38bdf8` | Acento celeste principal |
| `success` | `#4ade80` | Necesidades, positivo |
| `warning` | `#f59e0b` | Advertencias, duplicados |
| `danger` | `#ef4444` | Error, saldo negativo, eliminar |
| `danger-light` | `#f87171` | Saldo negativo hero |
| `want` | `#fdba74` | Deseos |
| `nav-bg` | `rgba(5,12,28,0.92)` | TabBar background |
| `backdrop` | `rgba(3,8,16,0.75)` | Overlay de modales |

### Border Radius
| Token | Valor | Uso |
|---|---|---|
| `rounded-card` | `20px` | Cards, contenedores, ExpenseItem |
| `rounded-card-lg` | `28px` | Modal desktop |
| `rounded-input` | `9999px` | Inputs, selects, pills |
| `rounded-button` | `9999px` | Botones |

### Tipografía (escala)
| Utility | Size | Weight | Extras | Uso |
|---|---|---|---|---|
| `type-micro` | 9px | 600 | — | Sublabels extremos (Percibidos, Tarjeta) |
| `type-label` | 10px | 600 | `tracking: 0.18em, uppercase` | Headers de sección |
| `type-meta` | 11px | 400 | — | Fechas, categorías auxiliares |
| `type-body` | 14px | 400 | `line-height: 1.4` | Inputs, descripciones, rows |
| `type-amount` | 20px | 800 | `tracking: -0.02em` | Sub-montos, pills |
| `type-month` | 22px | 900 | `tracking: -0.02em` | Nombre del mes en header |
| `type-hero` | 46px | 900 | `tracking: -0.04em` | Saldo disponible hero |

### Sistema Glass (3 capas)
| Utility | BG | Blur | Shadow |
|---|---|---|---|
| `glass-1` | `rgba(148,210,255,0.05)` | `4px` | — |
| `glass-2` | `rgba(148,210,255,0.08)` | `12px` | `inset 0 1px 0 rgba(148,210,255,0.10)` |
| `glass-3` | `rgba(148,210,255,0.15)` | `20px` | `inset 0 1px 0 rgba(148,210,255,0.14)` |
| Fallback (no blur) | `bg-secondary/tertiary/elevated` | — | — |

### Animaciones CSS
| Clase | Keyframe | Duración | Easing | Uso |
|---|---|---|---|---|
| `.skeleton` | shimmer (gradient shift) | 1.5s infinite | linear | Carga |
| `.spinner` | spin (rotate 360) | 0.6s infinite | linear | Botones loading |
| `.slide-up` | translateY(100%→0) | 0.3s | cubic-bezier(0.4,0,0.2,1) | Modales, sheets |
| `.bar-grow` | scaleX(0→1), origin:left | 0.55s | cubic-bezier(0.4,0,0.2,1) | Progress bars |

### Íconos
**Phosphor duotone** (`@phosphor-icons/react`, `weight="duotone"`, requiere `'use client'`):
```css
.icon-duotone { color: #f0f9ff }
.icon-duotone [opacity] { fill: #38bdf8 !important; opacity: 0.15 !important }
```
Usado en: `CategoryIcon.tsx` → Ultimos5, Top3, CategoryDistribution, ExpenseItem, NeedWantBreakdown

**Lucide React** (aún presente en):
TabBar (`Home`, `BarChart2`, `Settings`), DashboardHeader (`ChevronDown`), MonthSelectorSheet (`Check`), SmartInput (`ArrowRight`), SaldoVivo (`Wallet`, `CreditCard`), ExpenseFilters (`ChevronLeft/Right`), IncomeSection (`ChevronLeft/Right`), expenses/page (`ChevronLeft/Right`)

---

## 2. LAYOUT SHELL (`layout.tsx`)

```
min-h-screen bg-bg-primary
├── <main pb-tab-bar>         ← contenido scrolleable
├── Fade abisal (layout)      ← fixed, bottom:0, h:80px, z:45
│     linear-gradient(transparent → #050A14) + backdrop-blur(6px)
└── <TabBar />                ← z:50
```

---

## 3. PANTALLA: HOME (`/`)

```
bg-bg-primary
└── max-w-md px-4 pt-safe gap:24px
    ├── DashboardHeader
    ├── IncomeSetupModal (condicional — sin ingreso + mes actual)
    ├── SaldoVivo
    ├── FiltroEstoico (condicional — si hay gastos)
    └── Ultimos5

Fade abisal home (pisa el del layout)
    fixed, bottom:0, h:180px, z:46, backdrop-blur(6px)
    linear-gradient(transparent → #050A14)

SmartInput (flotante)
    fixed, bottom: calc(safe-area + 76px), z:50, max-w:448px, px:16px
```

### DashboardHeader
- `px-6 pt-5`
- Botón: `type-month text-text-primary` + `ChevronDown size:16 text-text-label`
- Hover: `opacity-70` / Active: `opacity-50`
- Abre `MonthSelectorSheet`

### SaldoVivo
- Container: `px-2 py-6 relative`
- Glow: `absolute -top-5 -left-[30px] w-[280px] h-[200px] rounded-full blur-2xl`
  - Positivo: `radial-gradient(rgba(56,189,248,0.14) → transparent)`
  - Negativo: `radial-gradient(rgba(239,68,68,0.14) → transparent)`
- Label: `type-label text-text-label`
- Número: `type-hero tabular-nums` — positivo: `text-text-primary` / negativo: `text-danger-light`
- Twin Pills: `flex gap-2.5 mt-5`
  - Pill: `rounded-full bg-surface border border-border-ocean px-3.5 py-3`
  - Ícono inner: `w-[30px] h-[30px] rounded-full bg-primary/8 border border-border-ocean` + Lucide `size:13 text-text-label`
  - Sublabel: `type-micro tracking-[0.15em] uppercase text-text-label`
  - Monto: `type-amount text-text-primary tabular-nums`

### FiltroEstoico
- Container: `px-2`
- Labels: `10px 600 tracking-[0.1em] uppercase text-text-label`
- Barra: `h-1.5 rounded-full bg-surface flex overflow-hidden`
  - Necesidad: `bg-success rounded-l-full bar-grow` (width = %)
  - Separador: `w-px bg-bg-primary`
  - Deseo: `flex-1 bg-want rounded-r-full`
- Sublabels: `10px text-text-dim`

### Ultimos5
- Container: `px-2`
- Header: `type-label text-text-label` + Link "Ver todos →": `11px 500 text-primary`
- Cada row: `flex gap-3.5 py-3.5` + `border-b border-primary/12` (excepto último)
  - Ícono: `w-[38px] h-[38px] rounded-full bg-primary/6 border border-border-ocean` + `CategoryIcon size:18`
  - Descripción: `13px 500 text-text-primary truncate`
  - Dot want: `5px × 5px rounded-full` → want: `bg-want` / need: `bg-success` / null: `bg-text-dim`
  - Meta: `11px text-text-label`
  - Monto: `14px 700 tabular-nums tracking-[-0.01em]` — normal: `text-text-primary` / PagoTarjetas: `text-primary`

### SmartInput
- Pill: `rounded-full bg-bg-secondary/[0.92] backdrop-blur-[20px] py-2.5 pr-2.5 pl-[18px]`
  - Borde vacío: `border-border-ocean` / con input: `border-primary/35`
- Input: `type-body text-text-primary placeholder:text-text-dim caret-primary`
- Botón: `w-9 h-9 rounded-full`
  - Sin input: `bg-primary/8 border border-border-ocean`
  - Con input: `bg-primary`
  - Ícono: `ArrowRight size:15 strokeWidth:2.5` Lucide — sin input: `text-text-label` / con input: `text-bg-primary`

---

## 4. PANTALLA: ANALYTICS (`/analytics`)

```
bg-bg-primary
└── max-w-md px-4 pt-safe pb-6 gap:32px
    ├── DashboardHeader (basePath="/analytics")
    ├── MonthlyTrends
    ├── NeedWantBreakdown
    ├── CategoryDistribution
    └── Link exportar CSV
```

### MonthlyTrends
- SVG bezier chart — `viewBox="0 0 320 160"` responsive
- Colores en constante COLORS (no leen CSS vars — limitación SVG):
  `primary: #38bdf8` / `success: #4ade80` / `bgPrimary: #050A14` / `textDim: #4B6472`
- Gradients SVG: `tg-inc` (success 35%→0%) / `tg-exp` (primary 35%→0%)
- Dots: `r:3` normales / `r:5` seleccionado
- Resumen: `rounded-card bg-bg-secondary p-4`

### NeedWantBreakdown
- Container: `px-2`
- Header: `type-label text-text-label mb-5`
- Cada row `gap:[18px]`:
  - Label: `inline-flex items-center gap-1.5 text-[13px] 500 text-text-primary` + `CategoryIcon size:13`
  - % badge: `12px 700 tabular-nums` — >60% want: `text-want` / <30%: `text-success` / medio: `text-text-label`
  - Barra: `h-[5px] rounded-full overflow-hidden bg-primary/6 flex`
    - `bg-success` (need%) + `bg-want` (want%)
  - Sublabel: `10px text-text-dim`

### CategoryDistribution
- Header: `type-label text-text-label mb-5`
- % en `13px 700 text-primary tabular-nums tracking-[-0.01em]`
- Label: `inline-flex items-center gap-1.5 13px 500 text-text-primary` + `CategoryIcon size:13`
- Barra `h-[5px] bg-primary/8 overflow-hidden`:
  - Fill: `bg-primary/60 bar-grow`

### Link CSV
- `rounded-full border border-[rgba(148,210,255,0.15)] bg-[rgba(148,210,255,0.05)] py-[14px] text-[13px] 600 text-primary`
- ⚠️ Deuda: rgba inline → debería usar `border-border-ocean bg-surface`

---

## 5. PANTALLA: EXPENSES (`/expenses`)

```
bg-bg-primary
└── max-w-md px-4 pt-safe pb-6
    ├── Header: ChevronLeft(h9w9 rounded-full hover:bg-primary/5) + h1(base 600)
    ├── Filtros: rounded-card bg-bg-secondary border-border-ocean p-4
    │     └── ExpenseFilters (Suspense)
    ├── Conteo: xs text-text-tertiary
    ├── Lista: space-y-2
    │     └── ExpenseItem × N
    ├── Empty state: rounded-card bg-bg-secondary px-4 py-10 text-center + emoji 📭
    └── Paginación: rounded-button border-border-ocean bg-bg-secondary px-4 py-2
```

### ExpenseFilters
- Navegación mes: `ChevronLeft/Right size:16` Lucide
  - Botones: `h-8 w-8 rounded-full hover:bg-primary/5 disabled:opacity-30`
- Select categoría: `rounded-input bg-bg-tertiary sm text-text-primary`
- Payment method buttons: `rounded-button xs px-3 py-1.5`
  - Activo: `bg-primary text-bg-primary`
  - Inactivo: `bg-bg-tertiary text-text-secondary hover:bg-primary/5`

### ExpenseItem — colapsado
- Container: `overflow-hidden rounded-card`
- Row: `flex gap-3 p-2.5 cursor-pointer`
  - Normal: `bg-bg-tertiary` / PagoTarjetas: `bg-primary/10`
- Ícono: `h-8 w-8 rounded-full bg-primary/6` + `CategoryIcon size:16`
- Descripción: `sm text-text-primary truncate`
- Meta: `xs text-text-tertiary`
- Monto: `sm 500` — normal: `text-text-primary` / PagoTarjetas: `text-primary`
- USD badge: `10px text-warning`

### ExpenseItem — expandido
- Panel: `space-y-3 rounded-b-input border-t border-border-subtle bg-bg-secondary p-3`
- Inputs/selects: `rounded-input border-transparent bg-bg-tertiary px-3 py-2 sm focus:border-primary`
- Need/Want buttons:
  - Need activo: `bg-success/20 text-success`
  - Want activo: `bg-want/20 text-want`
- Botón guardar: `rounded-button bg-primary px-4 py-1.5 xs 600 text-bg-primary`
- Botón eliminar: `xs text-danger hover:underline`
- Delete confirm: `xs text-text-secondary` + botón `rounded-button bg-danger/20 xs 500 text-danger`

---

## 6. PANTALLA: SETTINGS (`/settings`)

```
bg-bg-primary
└── max-w-md px-6 pt-safe pb-6
    ├── h1: 30px font-black tracking-tight text-text-primary
    ├── section "Preferencias" mb-10
    │   ├── type-label text-text-label
    │   ├── CurrencySection
    │   ├── CardsSection
    │   └── IncomeSection
    └── section "Cuenta"
        ├── type-label text-text-label
        └── AccountSection
```

### CurrencySection
- Card: `rounded-card bg-bg-secondary border border-border-ocean p-4`
- Toggle: `rounded-button px-4 py-2 sm 500`
  - Activo: `bg-primary text-bg-primary`
  - Inactivo: `bg-bg-tertiary text-text-secondary hover:bg-primary/5`
- Confirm block: `rounded-card bg-warning/10 p-3 mt-4`

### CardsSection
- Card: `rounded-card bg-bg-secondary border border-border-ocean p-4`
- Header: `type-label text-text-label` + chevron expandible
- Row tarjeta: `flex justify-between py-2 border-b border-border-ocean`
- Botón archivar: `xs text-text-tertiary hover:text-text-secondary`
- Botón add: `h-8 w-8 rounded-full bg-primary text-bg-primary`
- Input: `rounded-input bg-bg-tertiary flex-1 px-3 py-2 sm`

### IncomeSection
- Card: `rounded-card bg-bg-secondary border border-border-ocean p-4`
- Navegación mes: `ChevronLeft/Right size:16` Lucide + `rounded-card border border-border-ocean`
- Inputs: `rounded-input bg-bg-tertiary px-3 py-2 sm`
- Botón guardar: `rounded-button bg-primary text-bg-primary hover:brightness-110 active:scale-95`

### AccountSection
- Card: `rounded-card bg-bg-secondary border border-border-ocean p-4`
- Email pill: `rounded-full bg-bg-tertiary border border-border-ocean px-4 py-2.5 xs text-text-secondary`
- Logout: `rounded-button border border-border-ocean px-4 py-2.5 sm 500 text-text-secondary hover:bg-primary/5`
- Delete: `xs text-danger hover:underline`
- Confirm block: `rounded-card bg-danger/10 border border-danger/20 p-4`

---

## 7. MODALES

### Modal.tsx (base reutilizable)
- Overlay: `fixed inset-0 z-50 items-end sm:items-center` + backdrop `bg-black/60`
- Panel:
  - `slide-up w-full max-w-md max-h-[90vh] overflow-y-auto`
  - Mobile: `rounded-t-3xl` (48px) / Desktop: `rounded-card-lg` (28px)
  - BG: `bg-bg-secondary`
  - Border: `border border-[rgba(148,210,255,0.10)]` ⚠️ → debería ser `border-border-ocean`
  - Padding: `p-6`
- Handle bar: `h-1 w-10 rounded-full bg-text-disabled mx-auto mb-5 sm:hidden`

### ParsePreview
- Title: `lg 600 text-text-primary`
- Subtitle: `xs text-text-tertiary mb-5`
- Inputs/selects: `rounded-input bg-bg-tertiary px-4 py-3 sm`
- Toggle need/want: `rounded-input bg-bg-tertiary p-1` + `rounded-button py-2 sm 500`
  - Need activo: `bg-success text-white` ⚠️ → `text-bg-primary`
  - Want activo: `bg-want text-white` ⚠️ → `text-bg-primary`
- Warning duplicados: `rounded-input bg-warning/10 p-3 mt-5`
- Botón primario: `rounded-button bg-primary py-3 sm 600 text-white active:scale-95 hover:scale-[1.02]` ⚠️ → `text-bg-primary`
- Botón secundario: `rounded-button py-3 sm text-text-secondary hover:bg-[rgba(148,210,255,0.05)]` ⚠️ → `hover:bg-surface`

### IncomeSetupModal
- Inputs: `rounded-input bg-bg-tertiary px-4 py-3 sm`
- Botón primario: `rounded-button bg-primary py-3 sm 600 text-bg-primary hover:brightness-110 active:scale-95` ✅
- Botón secundario: `rounded-button py-3 sm text-text-secondary hover:bg-primary/5 active:scale-95` ✅

### MonthSelectorSheet (no usa Modal base)
- Overlay: `fixed inset-0 z-[60]` + backdrop `bg-backdrop backdrop-blur-sm`
- Sheet: `slide-up w-full max-w-[448px] bg-bg-primary rounded-t-[2rem] border-t border-border-ocean max-h-[70vh]`
  - `paddingBottom: calc(safe-area + 24px)`
- Handle: `w-12 h-1 bg-border-strong rounded-full mx-auto mt-4 mb-2`
- Cada mes: `w-full px-6 py-4 active:scale-[0.98]`
  - Seleccionado: `bg-primary/10 hover:bg-primary/15 font-semibold text-primary`
  - Normal: `hover:bg-primary/5 font-normal text-text-primary`
  - Check: `Check size:16 text-primary` Lucide

---

## 8. NAVEGACIÓN — TabBar

- `fixed bottom-0 z-50 flex justify-center pt-2` + `paddingBottom: calc(safe-area + 12px)`
- Pill: `rounded-full bg-nav-bg border border-border-ocean backdrop-blur-2xl`
  - Shadow (inline): `0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(148,210,255,0.06)`
- Cada tab: `rounded-full transition-all duration-200`
  - Activo: `gap-2 px-[18px] py-2 bg-primary/[0.13]`
  - Inactivo: `gap-0 px-[14px] py-2`
- Íconos Lucide `size:18` — activo: `strokeWidth:2.2 text-text-primary` / inactivo: `strokeWidth:1.7 text-text-label`
- Label (solo activo): `12px 600 text-text-primary tracking-[-0.01em]`
- Fallback Suspense: `w-40 h-12 rounded-full bg-nav-bg border border-border-ocean`

---

## 9. MAPEO DE ÍCONOS DE CATEGORÍA (`CategoryIcon.tsx`)

| Categoría | Ícono Phosphor |
|---|---|
| Supermercado | `ShoppingCart` |
| Alimentos | `Basket` |
| Restaurantes | `ChefHat` |
| Delivery | `Motorcycle` |
| Kiosco y Varios | `Storefront` |
| Casa/Mantenimiento | `House` |
| Muebles y Hogar | `Couch` |
| Servicios del Hogar | `Plug` |
| Auto/Combustible | `GasPump` |
| Auto/Mantenimiento | `Car` |
| Transporte | `Bus` |
| Salud | `FirstAidKit` |
| Farmacia | `Pill` |
| Educación | `BookOpen` |
| Ropa e Indumentaria | `TShirt` |
| Cuidado Personal | `HandHeart` |
| Suscripciones | `ArrowsClockwise` |
| Regalos | `Gift` |
| Transferencias Familiares | `Users` |
| Otros | `Tag` |
| Pago de Tarjetas | `CreditCard` |

---

## 10. DEUDA TÉCNICA DE DISEÑO

| Componente | Issue | Prioridad |
|---|---|---|
| `ParsePreview` | `text-white` en botones activos → `text-bg-primary` | Alta |
| `ParsePreview` | `hover:bg-[rgba(...)]` → `hover:bg-surface` | Alta |
| `Modal.tsx` | `border-[rgba(148,210,255,0.10)]` → `border-border-ocean` | Media |
| `analytics/page.tsx` | CSV link con rgba inline → `border-border-ocean bg-surface` | Media |
| `TabBar` | Íconos Lucide (`Home`, `BarChart2`, `Settings`) | Baja |
| `SmartInput` | `ArrowRight` Lucide | Baja |
| `SaldoVivo` | `Wallet`, `CreditCard` Lucide | Baja |
| `DashboardHeader` | `ChevronDown` Lucide | Baja |
| `MonthSelectorSheet` | `Check` Lucide | Baja |
| `ExpenseFilters` | `ChevronLeft/Right` Lucide | Baja |
| `IncomeSection` | `ChevronLeft/Right` Lucide | Baja |
| `MonthlyTrends` | Colores SVG hardcodeados (limitación técnica SVG) | Aceptar |
| `expenses/page.tsx` | Empty state usa emoji `📭` | Baja |
