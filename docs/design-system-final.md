# Gota — Design System

**Versión:** 3.0 — Light Mode "Fría"
**Status:** ✅ Producción — única fuente de verdad visual

---

## Principios

- **Light mode only.** No dark mode.
- **Glass surfaces** over a cool gray canvas (`#F0F4F8`).
- **Color con propósito:** accent → acciones. Data → métricas. Semánticos → estados. Categorías → color propio.
- **Un botón primario por pantalla.**
- **Cardless listas:** separador 1px, sin contenedores.
- **Solo Phosphor Icons** (Light, stroke 1.5px).

---

## Tokens

All color tokens live in three places — keep them in sync:
- **CSS:** `app/globals.css` (source of truth for Tailwind)
- **TypeScript:** `lib/design-tokens.ts` (for inline styles / SVG)

### Palette

| Group | Token | Value | Uso |
|---|---|---|---|
| **Background** | `bg-primary` | `#F0F4F8` | Canvas base |
| | `bg-secondary` | `#E6ECF2` | Bottom sheets |
| | `bg-tertiary` | `#DCE3EA` | Shell externo |
| **Text** | `text-primary` | `#0D1829` | Contenido, montos |
| | `text-secondary` | `#4A6070` | Labels |
| | `text-tertiary` / `text-dim` | `#90A4B0` | Metadata, placeholders |
| | `text-muted` / `text-disabled` | `#B8C9D4` | Muy secundarios |
| **Accent** | `primary` | `#2178A8` | Botón principal, focus |
| **Semantic** | `success` / `necessity` | `#1A7A42` | Verde |
| | `want` / `warning` | `#B84A12` | Naranja |
| | `danger` | `#A61E1E` | Rojo |
| **Data** | `data` | `#1B7E9E` | Gráficos, métricas |
| **Glass** | `surface` | `rgba(255,255,255,0.38)` | Cards, pills, nav |
| | `border-ocean` | `rgba(255,255,255,0.70)` | Borde glass |
| **Overlay** | `backdrop` | `rgba(0,0,0,0.40)` | Modal overlay |

---

## Typography

**Font:** `DM Sans` (primary) → `Geist Sans` (fallback)
**Smoothing:** `-webkit-font-smoothing: antialiased`

| Utility | Size | Weight | Tracking | Uso |
|---|---|---|---|---|
| `type-micro` | 10px | 600 | — | Sublabels |
| `type-label` | 10px | 700 | 0.09em + uppercase | Sección headers |
| `type-meta` | 11px | 500 | — | Fechas, categorías |
| `type-body` | 14px | 500 | — | Body, inputs |
| `type-body-lg` | 15px | 600 | — | Transacciones |
| `type-amount` | 20px | 800 | -0.02em | Montos |
| `type-month` | 22px | 800 | -0.02em | Mes header |
| `type-title` | 24px | 700 | -0.5px | Títulos |
| `type-hero-sm` | 32px | 500 | -0.02em | Hero secundario |
| `type-hero` | 42px | 800 | -1.5px | Saldo Vivo |

---

## Spacing & Radius

| Token | Value |
|---|---|
| `radius-card` | 20px |
| `radius-card-lg` | 28px |
| `radius-input` | 9999px |
| `radius-button` | 9999px |

**Contextual radii:** pill = 999px, card = 18px, item = 12–14px, icon = 10px

---

## Glass Elevation System

| Class | Blur | Use |
|---|---|---|
| `glass-1` | 4px | Pills, tags, rows |
| `glass-2` | 12px | Cards, panels |
| `glass-3` | 20px | Floating: nav, modals, sheets |

All share: `bg: rgba(255,255,255,0.38)`, `border: 1px solid rgba(255,255,255,0.70)`

**Fallback** (no backdrop-filter): glass-1/3 → `bg-secondary`, glass-2 → `bg-tertiary`

---

## Components

### Button — Primary CTA
```
width: 100% · padding: 15px · bg: #2178A8 · color: #fff
border-radius: 14px · font: 15px/700
hover: scale(1.02) · active: scale(0.95)
```
**One per screen.**

### Button — Ghost
```
bg: transparent · color: text-secondary
hover: bg: surface · color: text-primary
```

### Button — Destructive
```
Inline: color: danger, bg: transparent
Confirm: bg: danger, color: white
```

### Glass Card
```
bg: rgba(255,255,255,0.38) · border: 1px solid rgba(255,255,255,0.70)
backdrop-filter: blur(16px) · border-radius: 18px · padding: 15–16px
```

### Cardless List Row
```
border-bottom: 1px solid rgba(15,30,60,0.06)
padding: 13px 0
```

### Input
```
bg: #FFFFFF · border: 1px solid rgba(15,30,60,0.10)
border-radius: 12px · padding: 13px 14px · font: 14px · color: text-primary
```

### Segmented Toggle (ARS/USD · Need/Want · Daily/Analysis)
```
Container: flex · bg: rgba(255,255,255,0.50) · border: 1px solid rgba(255,255,255,0.70)
           border-radius: 12px · padding: 4px · gap: 4px
Active: bg: [accent/semantic] · color: #fff · border-radius: 9px · font: 600
Inactive: bg: transparent · color: #4A6070
```

### Badge
```
padding: 2px 8px · border-radius: 999px · font: 10–11px/600
bg: [colorSoft] · color: [color]
```

### Selection Chips
```
Inactive: bg: #FFF · border: 1px solid rgba(15,30,60,0.10) · color: #4A6070 · border-radius: 999px
Active:   bg: #2178A8 · color: #fff · no border · font: 600
```

### Category Icon (in lists)
```
36×36 · border-radius: 10px · bg: [category colorSoft 10%]
Phosphor Light icon in [category color]
```

### Section Label
```
10px · 700 · uppercase · tracking: 0.09em · color: #90A4B0
```

---

## Navigation — TabBar

```
fixed bottom · bg: rgba(255,255,255,0.38) · border: 1px solid rgba(255,255,255,0.70)
backdrop-filter: blur(16px) · border-radius: 999px · padding: 6px
margin: 0 16px 28px · shadow: 0 2px 10px rgba(15,30,60,0.05)

Active tab:   bg: #0D1829 · color: #fff · padding: 8px 20px · border-radius: 999px · font: 13px/600
Inactive tab: color: #90A4B0 · padding: 8px
```
**Tabs:** Home · Movimientos · Análisis

---

## SmartInput

```
Container: bg: rgba(255,255,255,0.38) · border: 1px solid rgba(255,255,255,0.70)
           backdrop-filter: blur(16px) · border-radius: 999px
           padding: 11px 10px 11px 18px · shadow: 0 4px 20px rgba(15,30,60,0.07)
           margin: 0 16px 10px
Send btn (idle):    34×34 · rounded-full · bg: rgba(15,30,60,0.06)
Send btn (active):  bg: #2178A8
```

---

## Bottom Sheets

```
Container: bg: #E6ECF2 · border-radius: 28px 28px 0 0 · shadow: 0 -8px 40px rgba(0,0,0,0.14)
Handle: 36×4 · border-radius: 99px · bg: rgba(15,30,60,0.15) · margin: 10px auto 4px
```

**Modal base:** overlay `bg-black/60` · panel `slide-up` · max-w: 448px · mobile: `rounded-t-3xl`, desktop: `rounded-card-lg` (28px)

---

## Iconography

**Library:** `@phosphor-icons/react` · **Style:** Light · **Stroke:** 1.5px

### Category Colors

| Family | Color | Categories |
|---|---|---|
| Alimentación (green) | `#1A7A42` → `#3D9668` | Supermercado, Alimentos, Restaurante, Delivery, Kiosco |
| Hogar (blue) | `#2178A8` → `#1B7E9E` | Casa, Muebles, Servicios |
| Transporte (orange) | `#B84A12` → `#C4601A` | Combustible, Mantenimiento, Transporte |
| Salud (teal) | `#1B7E9E`, `#0E8A7A` | Salud, Farmacia |
| Personal (violet) | `#6D3DB5` → `#A0367A` | Educación, Ropa, Cuidado Personal, Regalos |
| Finanzas (neutral) | `#4A6070`, `#A61E1E` | Transf. Familiares, Otros, Pago de Tarjetas |

Full icon mapping → `CategoryIcon.tsx`

---

## Animations

| Class | Behavior |
|---|---|
| `.skeleton` | Shimmer gradient, 1.5s infinite |
| `.spinner` | Border spin, 0.6s infinite |
| `.slide-up` | translateY(100%→0), 0.3s, cubic-bezier(0.4,0,0.2,1) |
| `.bar-grow` | scaleX(0→1), origin left, 0.55s |
| `active:scale-95` | Button tactile feedback |
| `hover:scale-[1.02]` | Primary button hover |

**prefers-reduced-motion** → all durations → 0.01ms.

---

## Accessibility

- **Focus:** `outline: 2px solid var(--color-primary)` + `outline-offset: 2px`
- **Touch targets:** min 44×44px
- **ARIA labels** on all icon buttons and inputs
- **Safe areas:** `pt-safe` / `pb-tab-bar` utilities

---

## Responsive

Mobile-first (375px). Desktop ≥ 768px → `max-width: 440px`, `margin: 0 auto`, hover states enabled.

---

## Number Formatting

Implemented in `lib/format.ts` → `formatAmount(amount, currency)`

---

**Referencias:**
- Full component specs (screen-by-screen): `gota-lightmodedesign.md`
- Component patterns & flows: `DESIGN.md`
- Category icon mapping: `lib/category-icons.ts` (or `CategoryIcon.tsx`)
- Design philosophy (conceptual): `docs/gota-design-philosophy.md`
