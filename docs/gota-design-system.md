# HISTORICO - NO VIGENTE - Gota Design System

> No usar como fuente visual vigente. Fuente actual: `docs/design-system-final.md` + `app/globals.css`.

# Gota — Design System

**Versión:** 2.1 (fusión post-MVP)
**Fecha:** Febrero 2026
**Status:** ✅ MVP Completo — referencia visual activa en producción

---

## Concepto

Gota no es una fintech. Es una herramienta de registro diario que no debería sentirse como trabajo. El diseño parte de esa premisa: **nada que pese, nada que distraiga, nada que no justifique su presencia**.

La metáfora visual es literal al nombre: una gota en el aire. El fondo oscuro no es drama — es el silencio necesario para que el celeste exista. El único color vivo de la paleta (`#38bdf8`) aparece exactamente donde importa y en ningún otro lugar.

---

## 1. FOUNDATION

### Colores

**Backgrounds — sistema de capas:**

```css
--bg-primary:   #060a0e;  /* Fondo base de pantalla */
--bg-secondary: #0c1520;  /* Cards estándar */
--bg-tertiary:  #132030;  /* Items dentro de cards, inputs */
--bg-elevated:  #334155;  /* Card hero (SaldoVivo) */
```

**Texto — jerarquía de luminosidad:**

```css
--text-primary:   #f0f9ff;  /* Contenido principal */
--text-secondary: #bae6fd;  /* Labels de sección, mes en header */
--text-tertiary:  #94a3b8;  /* Metadata, flechas de navegación */
--text-disabled:  #64748b;  /* Estados inactivos, handle bar */
```

**Borders:**

```css
--border-subtle: #132030;  /* Divisores de cards */
--border-strong: #334155;  /* Inputs, focused */
```

**Acento — un único color vivo:**

```css
--primary: #38bdf8;  /* Celeste — botón principal, focus, barras, settings icon */
                     /* No se usa decorativamente. */
```

**Semánticos:**

```css
--success / --necessity: #4ade80;  /* Balance positivo, necesidades */
--want:                  #fdba74;  /* Deseos */
--warning:               #f59e0b;  /* Alertas neutras */
--danger:                #ef4444;  /* Balance negativo, acciones destructivas */
```

---

### Logo

SVG de dos capas, `viewBox="0 0 48 68"`. Teardrop simétrica, base pesada, sin stroke.

```svg
<!-- Halo exterior -->
<path d="M 24 3 C 24 3, 8 22, 6 44 C 5 57, 14 66, 24 66
         C 34 66, 43 57, 42 44 C 40 22, 24 3, 24 3 Z"
      fill="rgba(56,189,248,0.12)" />
<!-- Núcleo -->
<path d="M 24 20 C 24 20, 13 33, 11 44 C 10 54, 16 64, 24 64
         C 32 64, 38 54, 37 44 C 35 33, 24 20, 24 20 Z"
      fill="rgba(56,189,248,0.65)" />
```

- **En app:** inline SVG sin fondo — el negro de la pantalla actúa como fondo
- **PWA icons:** mismo SVG, `viewBox="-4 -10 56 88"` + `<rect fill="#060a0e">` de fondo
- **Fondo blanco:** cambiar fills a `rgba(14,116,144,0.12)` y `rgba(14,116,144,0.65)`

Fuentes canónicas en `Archivos Fuente/`:
- `gota-logo.svg` — logo standalone
- `gota-icon-512.svg` — ícono PWA 512px
- `gota-apple-touch-icon.svg` — ícono iOS 180px
- `gota-logo-final.html` — showcase completo

---

### Tipografía

**Font stack:**

```css
font-family: 'Geist Sans', -apple-system, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif;
-webkit-font-smoothing: antialiased;
```

**Escala (clases Tailwind reales en producción):**

```
text-3xl font-light tracking-wide    — nombre Gota en login
text-base font-medium                — título de período en header
text-sm font-semibold                — títulos de cards, labels de acción
text-sm                              — contenido de listas, valores secundarios
text-xs font-medium uppercase tracking-wider   — etiquetas de sección
text-[10px] font-medium uppercase tracking-wider — micro-labels en modales
text-xl font-semibold tabular-nums   — número Disponible
```

**Escala CSS equivalente (referencia):**

```css
--text-display:   32px / 700;  /* Títulos de página */
--text-amount-xl: 20px / 600;  /* Disponible (text-xl) */
--text-amount-lg: 20px / 700;  /* Montos Top 3 */
--text-amount-md: 16px / 600;  /* Montos en lista */
--text-body:      14px / 400;  /* Body */
--text-body-sm:   12px / 400;  /* Metadata */
--text-caption:   10px / 500;  /* Labels UPPERCASE */
```

---

### Spacing (sistema 8px)

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
```

---

### Border Radius

```css
--radius-card-lg: 18px;  /* Card hero (SaldoVivo) */
--radius-card:    16px;  /* Cards estándar */
--radius-input:   12px;  /* Inputs, selects, items de lista */
--radius-button:  12px;  /* Botones */
```

En Tailwind v4: `rounded-card`, `rounded-card-lg`, `rounded-input`, `rounded-button`.

---

## 2. COMPONENTS

### Buttons

#### Primary CTA

```css
background: #38bdf8;
color: #060a0e;           /* texto oscuro sobre celeste */
padding: 12px 24px;
border-radius: 12px;
font-size: 14px;
font-weight: 600;

/* Hover */
transform: scale(1.02);

/* Active */
transform: scale(0.95);
```

**Uso:**
- "Guardar gasto" en ParsePreview
- Botón ▶ en Smart Input
- Confirmaciones críticas

#### Secondary

```css
background: var(--bg-secondary);
color: var(--text-primary);
border: 1px solid var(--border-strong);
padding: 12px 24px;
border-radius: 12px;

/* Hover */
background: var(--bg-tertiary);
```

**Uso:** "Ver todos" en dashboard, acciones secundarias.

#### Ghost

```css
background: transparent;
color: var(--text-secondary);
padding: 12px 24px;

/* Hover */
color: var(--text-primary);
background: rgba(255, 255, 255, 0.05);
```

**Uso:** "Cancelar" en modals, links secundarios.

#### Disabled State

```css
opacity: 0.5;
cursor: not-allowed;
pointer-events: none;
```

**Uso crítico:**
- ParsePreview cuando field required está vacío
- Botón "Agregar" cuando input está vacío

---

### Cards

#### Standard Card

```css
background: var(--bg-secondary);
border: 1px solid var(--border-subtle);
border-radius: 16px;
padding: 16px;
```

**Uso:** Top 3 Categorías, Filtro Estoico, Últimos 5 Gastos.

#### Elevated Card (Hero)

```css
background: var(--bg-elevated);   /* #334155 — más claro que las cards normales */
border-radius: 18px;
padding: 20px;
box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
```

**Uso:** Saldo Vivo (hero component).

#### Accent Border Card

```css
border-left: 3px solid var(--primary);
/* O --success / --danger según contexto */
```

**Uso:** Estados especiales, warnings.

---

### Inputs

#### Text Input

```css
background: var(--bg-tertiary);
border: 1px solid rgba(56, 189, 248, 0.15);   /* borde celeste sutil en idle */
border-radius: 12px;
padding: 12px 16px;
color: var(--text-primary);
font-size: 14px;

/* Focus */
border-color: rgba(56, 189, 248, 0.4);
box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.08);

/* Disabled */
opacity: 0.5;
cursor: not-allowed;
```

**InputMode confirmado:**

```html
<!-- Smart Input -->
<input inputmode="text" />

<!-- Monto en ParsePreview -->
<input inputmode="decimal" pattern="[0-9]*" />
```

#### Error State

```css
border-color: var(--danger);
box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
```

```css
/* Mensaje de error */
color: var(--danger);
font-size: 11px;
margin-top: 4px;
```

#### Required Field (Vacío)

```css
border-color: var(--danger);
background: rgba(239, 68, 68, 0.05);
```

---

### Dropdowns / Selects

```css
background: var(--bg-tertiary);
border: 1px solid transparent;
border-radius: 12px;
padding: 12px 40px 12px 16px;
appearance: none;

/* Focus */
border-color: rgba(56, 189, 248, 0.4);
```

---

### Toggles

#### Binary Toggle (Need/Want)

```css
display: flex;
gap: 8px;
background: var(--bg-tertiary);
border-radius: 12px;
padding: 4px;

button {
  flex: 1;
  padding: 8px 16px;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
}

button.active-necessity {
  background: var(--necessity);   /* #4ade80 */
  color: #0f172a;
}

button.active-want {
  background: var(--want);        /* #fdba74 */
  color: #0f172a;
}
```

---

### Badges

```css
display: inline-flex;
padding: 3px 8px;
border-radius: 6px;
font-size: 10px;
font-weight: 500;
text-transform: uppercase;
letter-spacing: 0.5px;
```

**Variantes:**

```css
/* Success (Verificado) */
background: rgba(74, 222, 128, 0.2);
color: var(--success);

/* Warning (Posible duplicado) */
background: rgba(245, 158, 11, 0.2);
color: var(--warning);

/* Info (USD) */
background: rgba(56, 189, 248, 0.15);
color: var(--primary);
```

---

## 3. LAYOUT SPECS

### Header

```
┌──────────────────────────────────────┐
│  ‹    Febrero 2026    ›         ⚙    │
│  ↑         ↑          ↑         ↑    │
│ tertiary  secondary  tertiary  primary│
└──────────────────────────────────────┘

Height: 56px
Background: var(--bg-primary)
Border-bottom: 1px solid var(--border-subtle)
Layout: grid grid-cols-3 (centrado exacto del título)
```

**Flecha buttons:**

```css
color: var(--text-tertiary);
background: transparent;
border-radius: 8px;

/* Disabled */
opacity: 0.3;
cursor: not-allowed;
```

**Título (mes):**

```css
font-size: 16px;
font-weight: 500;
color: var(--text-secondary);
text-align: center;
```

**Ícono ⚙:**

```css
color: var(--primary);   /* acento intencional */
```

---

### Smart Input

```
┌──────────────────────────────────────┐
│ [café 2500____________]  [▶]         │
└──────────────────────────────────────┘

Gap: 12px entre input y button
```

**Input:**

```css
flex: 1;
background: var(--bg-tertiary);
border: 1px solid rgba(56, 189, 248, 0.15);
border-radius: 12px;
padding: 14px 16px;
font-size: 14px;

/* Focus-within del wrapper */
border-color: rgba(56, 189, 248, 0.4);
```

**Botón ▶:**

```css
width: 48px;
height: 48px;
border-radius: 12px;
background: var(--primary);
color: #060a0e;

/* Disabled (input vacío) */
opacity: 0.5;
cursor: not-allowed;
```

**Hint contextual (período pasado):**

```
ⓘ Se registrará en Feb 2026
[café 2500____________]  [▶]

Font: 12px | Color: var(--text-tertiary) | Margin-bottom: 8px
```

---

### Saldo Vivo Card

```
┌─────────────────────────────────────┐
│ Saldo del Mes (ARS)                 │ ← text-sm font-semibold text-secondary
│                                     │
│ Ingresos del mes      $1.000.000    │ ← tap → edita ingresos
│ Gastos percibidos       -$350.000   │
│ Pago de tarjetas        -$450.000   │
│ ─────────────────────────────────── │
│ Disponible              $200.000    │ ← text-xl font-semibold tabular-nums
│ ✓ Verificado 10 feb                 │   verde si positivo, rojo si negativo
│                                     │
│ [████████░░░░░░░░] 20% restante     │
└─────────────────────────────────────┘

Background: var(--bg-elevated)  (#334155)
Border-radius: 18px
Padding: 20px
```

**Estado sin configurar (ingresos $0):**

```css
'Ingresos del mes' {
  color: var(--danger);
  font-weight: 600;
}
```

**Badge verificado:**

```css
background: rgba(74, 222, 128, 0.2);
color: var(--success);
```

---

### Gastos con Tarjeta

```
┌─────────────────────────────────────┐
│ 💳 Gastos con tarjeta este mes      │
│                                     │
│ $370.000                            │ ← text-lg/700
│ (se pagarán en marzo)               │ ← text-xs, text-tertiary
└─────────────────────────────────────┘

Padding: 16px | Background: var(--bg-secondary) | Border-radius: 16px
```

---

### ParsePreview Modal

```
╔═════════════════════════════════════╗
║ [─]  handle bar (8px centered)      ║
║                                     ║
║ Confirmar gasto                     ║ ← 18px/600
║ Revisá los datos antes de guardar   ║ ← 12px, text-tertiary
║                                     ║
║ ┌─────────────────────────────────┐ ║
║ │ MONTO                           │ ║ ← label: 10px uppercase
║ │ [$ 2500]         [ARS ▼]        │ ║
║ └─────────────────────────────────┘ ║
║                                     ║
║ CATEGORÍA                           ║
║ [🍔 Restaurantes            ▼]      ║
║                                     ║
║ MEDIO DE PAGO                       ║
║ [💵 Efectivo                ▼]      ║
║                                     ║
║ TARJETA                             ║ ← condicional (solo si CREDIT)
║ [BBVA VISA                  ▼]      ║
║                                     ║
║ FECHA                               ║
║ [📅 3 Febrero 2026          ▼]      ║
║                                     ║
║ ¿NECESIDAD O DESEO?                 ║
║ [✓ Necesidad] [  Deseo]             ║
║                                     ║
║ ─────────────────────────────────   ║
║                                     ║
║ [Guardar gasto ✓]                   ║ ← Primary CTA
║ [Cancelar]                          ║ ← Ghost button
╚═════════════════════════════════════╝

Width: 90vw, max 420px | Padding: 24px
Background: var(--bg-secondary)
Border-radius: 24px 24px 0 0 (mobile bottom sheet)
Max-height: 80vh
```

**Labels:**

```css
font-size: 10px;
font-weight: 500;
text-transform: uppercase;
letter-spacing: 0.5px;
color: var(--text-secondary);
margin-bottom: 8px;
```

**Spacing entre fields:** `margin-bottom: 20px`

**Caso especial "Pago de Tarjetas":** oculta el toggle Necesidad/Deseo completamente. TARJETA es REQUIRED (rojo si null).

**Campo required vacío:**

```css
border-color: var(--danger);
background: rgba(239, 68, 68, 0.05);
/* + mensaje: "Seleccioná una tarjeta", color: var(--danger), font-size: 11px */
```

---

### Gasto Expandido (Inline Edit)

```
┌────────────────────────────────────┐
│ 🍔 Café con leche     [$ 2500   ]  │ ← monto editable
│                                    │
│ CATEGORÍA                          │
│ [🍔 Restaurantes            ▼]     │
│                                    │
│ MEDIO DE PAGO                      │
│ [💵 Efectivo                ▼]     │
│                                    │
│ TARJETA                            │ ← condicional
│ [─ No aplica ─              ▼]     │
│                                    │
│ FECHA                              │
│ [📅 3 Febrero 2026          ▼]     │
│                                    │
│ ¿NECESIDAD O DESEO?                │
│ [✓ Necesidad] [  Deseo]            │
│                                    │
│ [🗑️ Eliminar]                      │ ← danger, solo texto (no fondo)
└────────────────────────────────────┘

Background: var(--bg-tertiary) | Padding: 16px | Border-radius: 12px
```

**Guardar:** Al colapsar (tap fuera). NO onChange — evita spam de API calls.

**Loading state (while saving):**

```css
opacity: 0.6;
pointer-events: none;
/* + spinner overlay center */
```

---

### Filtro Estoico

```
┌─────────────────────────────────────┐
│ 🧘 Filtro Estoico                   │
│                                     │
│ 68% Necesidad, 32% Deseo            │ ← 16px/600
│ [████████████░░░░░░]                │ ← progress bar
│ 12 necesidad · 7 deseo              │ ← 12px/400, text-tertiary
└─────────────────────────────────────┘
```

**Progress bar:**

```css
/* Wrapper */
display: flex;
gap: 2px;          /* gap visual entre segmentos */
overflow: hidden;  /* mantiene border-radius exterior */
border-radius: 9999px;
height: 6px;

/* Segmento Necesidad */
background: var(--necessity);   /* #4ade80 */
flex: <necesidad_count>;

/* Segmento Deseo */
background: var(--want);        /* #fdba74 */
flex: <deseo_count>;
```

**Transition:** `transition: flex 0.5s cubic-bezier(0.4, 0, 0.2, 1)`

---

### Top 3 Categorías

```
┌─────────────────────────────────────┐
│ 📊 Top 3 Categorías                 │
│                                     │
│ 🛒 Supermercado        45%  $450K   │
│ [█████████░░░░░░░░░░░░░]            │
│                                     │
│ 🍽️ Restaurantes        30%  $300K   │
│ [██████░░░░░░░░░░░░░░░░]            │
│                                     │
│ 🚗 Transporte          15%  $150K   │
│ [███░░░░░░░░░░░░░░░░░░░]            │
└─────────────────────────────────────┘
```

**Progress bar:**

```css
/* Track */
background: rgba(56, 189, 248, 0.12);
height: 6px;       /* h-1.5 */
border-radius: 9999px;  /* rounded-full */

/* Fill */
background: rgba(56, 189, 248, 0.65);
```

---

### Últimos 5 Gastos

```
┌─────────────────────────────────────┐
│ 📝 Últimos 5 Gastos                 │
│                                     │
│ 🍔 Café con leche          $2.500   │
│    Hoy · Efectivo                   │
│ ─────────────────────────────────── │
│ 💳 Pago BBVA VISA        $320.000   │ ← Pago de Tarjetas: text-tertiary
│    2 Feb · Débito                   │
│ ─────────────────────────────────── │
│                                     │
│ [Ver todos →]                       │
└─────────────────────────────────────┘
```

**Gasto item (colapsado):**

```css
display: grid;
grid-template-columns: 24px 1fr auto;
gap: 12px;
padding: 12px;
cursor: pointer;
border-radius: 8px;

/* Hover */
background: var(--bg-tertiary);
```

**Visual "Pago de Tarjetas":**

```css
color: var(--text-tertiary);
background: rgba(100, 116, 139, 0.1);
```

**Empty state:**

```css
color: var(--text-disabled);
font-size: 14px;
text-align: center;
padding: 40px 20px;
```

---

### Acciones Destructivas (Settings)

```css
/* Cerrar sesión — no destructiva, sin fondo */
color: var(--danger);
background: transparent;

/* Eliminar cuenta — señal más sutil */
background: rgba(239, 68, 68, 0.1);
color: var(--danger);

/* Confirmación final (botón modal) */
background: var(--danger);
color: white;
```

---

## 4. MOBILE-SPECIFIC

### Touch Targets

**Mínimo 44x44px:**
- Botones
- Dropdowns
- Gastos (tap para expandir)
- Header arrows (← →)

### Keyboard Handling

```typescript
// Listener en Smart Input
window.visualViewport?.addEventListener('resize', () => {
  if (visualViewport.height < window.innerHeight) {
    // Teclado visible — scroll to input
    scrollToInput()
  }
})
```

El botón ▶ siempre debe quedar accesible con teclado abierto.

### Bottom Sheet (ParsePreview Mobile)

```css
position: fixed;
bottom: 0;
left: 0;
right: 0;
max-height: 90vh;
border-radius: 24px 24px 0 0;
background: var(--bg-secondary);

/* iOS handle bar */
&::before {
  content: '';
  width: 40px;
  height: 4px;
  background: var(--text-disabled);
  border-radius: 2px;
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
}
```

---

## 5. LOADING STATES

### Skeleton (Dashboard Loading)

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-tertiary) 0%,
    var(--bg-elevated) 50%,
    var(--bg-tertiary) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

**Usar para:** cambio de período (← →), initial page load.
**NO usar para:** micro-interactions <200ms, guardar gasto (usar spinner).

### Spinner (Inline Actions)

```css
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--text-disabled);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

**Usar para:** Gemini processing en SmartInput, guardar gasto inline, API calls explícitos.

---

## 6. ERROR STATES

### Alert (Input Inválido)

```javascript
alert('El input no parece ser un gasto')
```

Estilo nativo OK — no custom modal.

### Inline Error (ParsePreview)

```
TARJETA
[                            ▼]  ← campo con border-color: var(--danger)
⚠️ Seleccioná una tarjeta
```

```css
.error-message {
  color: var(--danger);
  font-size: 11px;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}
```

### Toast (Post-MVP)

```
┌─────────────────────────────┐
│ ✓ Gasto guardado            │
└─────────────────────────────┘

Position: bottom center | Duration: 2s
Background: var(--bg-elevated)
```

---

## 7. RESPONSIVE

```css
/* Mobile-first (default) — diseñado para 375px */

/* Desktop */
@media (min-width: 768px) {
  max-width: 440px;
  margin: 0 auto;

  button:hover { /* hover states habilitados */ }

  /* /expenses → tabla */
  .expense-list { display: table; }
}
```

**No tablets específico:** mobile <768, desktop ≥768.

---

## 8. ANIMACIONES

**Standard easing:**

```css
transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
```

**Micro-interactions:**

```css
/* Button press */
button:active { transform: scale(0.97); }

/* Primary button hover */
button.primary:hover { transform: scale(1.02); }

/* Card hover (desktop only) */
@media (min-width: 768px) {
  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.5);
  }
}
```

**Tabla de clases definidas en globals.css:**

| Clase | Comportamiento |
|---|---|
| `.skeleton` | Shimmer 90°, 1.5s |
| `.spinner` | Borde disabled + arco primary, 0.6s |
| `.slide-up` | Bottom sheet `translateY(100%→0)`, 0.3s |
| `active:scale-95` | Feedback táctil en botones de acción |
| `hover:scale-[1.02]` | Hover sutil en botón principal |

**prefers-reduced-motion:**

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 9. ACCESIBILIDAD

### Focus States

```css
*:focus-visible {
  outline: 2px solid var(--primary);   /* #38bdf8 */
  outline-offset: 2px;
}
```

### ARIA Labels

```html
<button aria-label="Agregar gasto">▶</button>
<input aria-label="Monto del gasto" inputmode="decimal" />
<button aria-label="Mes anterior">‹</button>
<button aria-label="Mes siguiente">›</button>
```

### Color Contrast (WCAG AA)

- Text primary on bg-primary: ✓
- Text secondary on bg-secondary: ✓
- Primary button text (dark on #38bdf8): ✓

---

## 10. ÍCONOS

**Lucide React:**

```typescript
import {
  ChevronLeft,
  ChevronRight,
  Settings,
  ArrowRight,
  Trash2,
  Check,
} from 'lucide-react'
```

**Size estándar:** `size=20, strokeWidth=2`
**Settings:** `size=16, strokeWidth=1.5`
**Botón ▶:** `ArrowRight size=18, strokeWidth=2`

**Color:** `currentColor` — hereda del texto del padre.

---

## 11. NUMBER FORMATTING

```typescript
// ARS: punto como separador de miles
// $1.234.567

const formatARS = (amount: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(amount)

// USD: coma como separador de miles
// US$1,234,567

const formatUSD = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(amount)
```

Implementado en `lib/format.ts` → `formatAmount(amount, currency)`.

---

## 12. DARK MODE ONLY

```css
:root {
  color-scheme: dark;
}
```

```html
<meta name="theme-color" content="#060a0e" />
```

No hay light mode en el producto.

---

**FIN DEL DESIGN SYSTEM v2.1 — Gota**
