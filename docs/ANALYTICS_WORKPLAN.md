# Gota — Analytics Page Migration Workplan
## Contexto para Claude Code

---

## ⚠️ VERIFICAR ANTES DE EJECUTAR
Antes de arrancar, correr estos comandos en el repo para confirmar rutas y nombres reales:

```bash
# 1. Ruta exacta de la pantalla de analytics
find . -name "page.tsx" | grep -i analytics

# 2. Nombre exacto del componente de íconos de categoría
find . -name "*ategory*" -o -name "*con*" | grep -v node_modules | grep -v ".next"

# 3. Función de formateo de montos existente
grep -r "formatCurrency\|formatAmount\|formatMonto" --include="*.ts" --include="*.tsx" -l | grep -v node_modules

# 4. Estado del mes seleccionado en analytics actual
grep -r "selectedMonth\|currentMonth\|mesActivo\|monthState" --include="*.tsx" src/app | grep -v node_modules
```

Reemplazar los PLACEHOLDERs en este documento con los resultados antes de pasarlo a Claude Code.

---

## Objetivo

Reemplazar la pantalla de Analytics actual por un nuevo sistema de "Diario de Mes": un layout narrativo que muestra un insight principal generado por reglas + entradas por categoría en formato journal.

**No se usa AI para generar los mensajes.** El sistema es 100% rule-based, calculado en el cliente a partir de datos de Supabase. **No hay sparkline ni ningún gráfico.**

---

## Stack técnico

- Next.js (App Router)
- Supabase (auth + DB)
- Tailwind CSS (tokens Gota Glass — ver sección de diseño)
- Phosphor Icons (`phosphor-react`, weight `"duotone"`, requiere `'use client'`)
- Moneda default del usuario en `user_config.default_currency`

---

## Sistema de diseño — Gota Glass (usar SIEMPRE estos valores, nunca inventar colores)

### Colores — Fondos
```
bg-primary:    #050A14   → fondo principal de la app
bg-secondary:  #0b1221   → cards, modales, filtros
bg-tertiary:   #0f1c30   → inputs, rows, elementos internos
bg-elevated:   #1a2d42   → fallback glass sin blur
surface:       rgba(148,210,255,0.05)  → pills flotantes
nav-bg:        rgba(5,12,28,0.92)      → TabBar
backdrop:      rgba(3,8,16,0.75)       → overlay de modales
```

### Colores — Texto
```
text-primary:   #f0f9ff   → texto principal
text-secondary: #bae6fd   → labels de formulario
text-tertiary:  #94a3b8   → texto auxiliar, fechas
text-disabled:  #64748b   → spinner, handle bar
text-label:     #7B98B8   → headers, íconos
text-dim:       #4B6472   → sublabels, placeholders
```

### Colores — Bordes
```
border-subtle:  #132030                    → separadores internos
border-strong:  #334155                    → handle bars
border-ocean:   rgba(148,210,255,0.15)     → cards, pills, inputs activos
```

### Colores — Acentos y Estados
```
primary:       #38bdf8   → acento celeste principal
success:       #4ade80   → necesidades / positivo
warning:       #f59e0b   → advertencias
danger:        #ef4444   → error / eliminar
danger-light:  #f87171   → saldo negativo
want:          #fdba74   → deseos (SOLO elementos gráficos, NUNCA en texto)
```

### Reglas de uso de color — CRÍTICAS
- `want (#fdba74)` → solo en íconos o dots, NUNCA para texto. Para texto usar `text-primary`.
- `success` y `primary` → seguros sobre fondos oscuros.
- Sobre fondos oscuros → usar exclusivamente `text-primary` o `text-secondary`.

### Sistema Glass
```
Glass-1: bg rgba(148,210,255,0.05)  + blur 4px
Glass-2: bg rgba(148,210,255,0.08)  + blur 12px + shadow inset 0 1px 0 rgba(148,210,255,0.10)
Glass-3: bg rgba(148,210,255,0.15)  + blur 20px + shadow inset 0 1px 0 rgba(148,210,255,0.14)
Fallback (sin blur): bg-secondary / bg-tertiary / bg-elevated
```

### Geometría
```
rounded-card:     20px   → cards y contenedores
rounded-card-lg:  28px   → modales desktop
rounded-full:     9999px → botones, inputs, selects, pills
```

### Tipografía — escala exacta
```
type-micro:  9px,  weight 600
type-label:  10px, weight 600, tracking 0.18em, UPPERCASE
type-meta:   11px, weight 400
type-body:   14px, weight 400, line-height 1.4
type-amount: 20px, weight 800, tracking -0.02em
type-month:  22px, weight 900, tracking -0.02em  → usar para el titular hero (NO type-hero)
type-hero:   46px, weight 900, tracking -0.04em  → NO usar en analytics
```

### Animaciones CSS disponibles
```
.skeleton  → shimmer 1.5s infinito
.spinner   → spin 0.6s infinito
.slide-up  → translateY(100%→0) 0.3s cubic-bezier(0.4,0,0.2,1)
.bar-grow  → scaleX(0→1) origin-left 0.55s cubic-bezier(0.4,0,0.2,1)
```

### Íconos — Phosphor duotone
- Usar SIEMPRE Phosphor con `weight="duotone"`. Requiere `'use client'`.
- NO agregar nuevos usos de Lucide React (es deuda técnica existente).
- Reutilizar `[PLACEHOLDER: nombre exacto del componente de íconos]` sin modificarlo.

Mapeo de categorías:
```
Supermercado              → ShoppingCart
Alimentos                 → Basket
Restaurantes              → ChefHat
Delivery                  → Motorcycle
Kiosco y Varios           → Storefront
Casa/Mantenimiento        → House
Muebles y Hogar           → Couch
Servicios del Hogar       → Plug
Auto/Combustible          → GasPump
Auto/Mantenimiento        → Car
Transporte                → Bus
Salud                     → FirstAidKit
Farmacia                  → Pill
Educación                 → BookOpen
Ropa e Indumentaria       → TShirt
Cuidado Personal          → HandHeart
Suscripciones             → ArrowsClockwise
Regalos                   → Gift
Transferencias Familiares → Users
Otros                     → Tag
Pago de Tarjetas          → CreditCard
```

---

## Estructura de la base de datos

### `expenses`
| columna | tipo | notas |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK auth.uid() |
| amount | numeric | en la moneda de `currency` |
| currency | varchar | 'ARS' o 'USD' |
| category | varchar | ver lista arriba |
| description | text | |
| is_want | boolean | true = deseo, false = necesidad |
| payment_method | varchar | 'cash', 'debit', 'transfer', 'credit' |
| card_id | varchar | referencia a user_config.cards (jsonb) |
| date | timestamptz | fecha del gasto (puede diferir de created_at) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `monthly_income`
| columna | tipo | notas |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK |
| month | date | primer día del mes |
| amount_ars | numeric | |
| amount_usd | numeric | |
| saldo_inicial_ars | numeric | |
| saldo_inicial_usd | numeric | |

### `user_config`
| columna | tipo | notas |
|---|---|---|
| user_id | uuid | PK |
| default_currency | varchar | 'ARS' o 'USD' |
| cards | jsonb | [{id, name, archived}] |

**Regla de diferido:** `payment_method = 'credit'` implica diferido siempre.

---

## Arquitectura del nuevo sistema

### 1. Hook — `useAnalyticsData`

**Ruta:** `/hooks/useAnalyticsData.ts`

**Responsabilidades:**
1. Leer `default_currency` desde `user_config`
2. Traer expenses del mes activo filtradas por `user_id`, rango de fechas **y `currency = default_currency`**
3. Traer `monthly_income` del mes activo (puede ser `null`)
4. Retornar `{ expenses, income, currency, loading, error }`

**Regla de moneda — CRÍTICA:**
Filtrar expenses por `currency = default_currency` del usuario. Si el usuario tiene expenses en ARS y USD mezcladas en el mismo mes (puede ocurrir si cambió su default), solo procesar las de `default_currency`. No mezclar monedas en los cálculos.

```ts
supabase
  .from('expenses')
  .select('*')
  .eq('user_id', userId)
  .eq('currency', defaultCurrency)   // ← SIEMPRE filtrar por moneda
  .gte('date', startOfMonth)
  .lt('date', endOfMonth)
```

**Estado del mes:**
[PLACEHOLDER: verificar si el mes seleccionado ya tiene estado en la pantalla actual o en un hook compartido]
- Si ya existe un estado de mes en la pantalla → recibir `{ year, month }` como parámetros del hook
- Si no existe → el hook maneja internamente el mes actual con `new Date()`
- En ningún caso hardcodear el mes — la pantalla ya permite navegar entre meses

**Filtro de mes:**
```ts
const startOfMonth = new Date(year, month, 1).toISOString()
const endOfMonth   = new Date(year, month + 1, 1).toISOString()
```

---

### 2. Métricas — `computeMetrics(expenses, income, currency)`

**Ruta:** `/lib/analytics/computeMetrics.ts`

Función pura. Todas las operaciones en memoria. No hace queries a Supabase.

**Tipos:**

```ts
type CategoriaMetric = {
  category: string
  total: number           // sum(amount)
  cantidad: number        // count de transacciones
  // Clasificación de la categoría:
  // - 'need':  100% de sus transacciones tienen is_want = false
  // - 'want':  100% de sus transacciones tienen is_want = true
  // - 'mixed': tiene al menos 1 is_want=true Y al menos 1 is_want=false
  tipo: 'need' | 'want' | 'mixed'
  pctDelTotal: number     // total / totalGastado * 100
  ticketPromedio: number  // total / cantidad
}

type ConcentracionDeseo = {
  category: string
  pctDelTotal: number
  cantidad: number
  ticketPromedio: number
}

type Metrics = {
  // NIVEL 1 — siempre disponibles
  totalGastado: number
  currency: string
  totalNecesidad: number
  totalDeseo: number
  pctDeseo: number
  // Todas las categorías con al menos 1 tx, ordenadas por total DESC
  // Este orden se mantiene siempre, incluso al expandir la lista
  categorias: CategoriaMetric[]
  topCategoriaMonto: CategoriaMetric       // categorias[0]
  topCategoriaFrecuencia: CategoriaMetric  // la de mayor cantidad
  semanaMasCara: number                    // 1-5
  pctSemana1DelTotal: number
  diasSinGasto: number
  diasSinDeseo: number                     // racha actual
  pctCredito: number
  // Categorías tipo 'want' o 'mixed' con pctDelTotal >= 15
  categoryConcentration: ConcentracionDeseo[]

  // NIVEL 2 — solo si income !== null
  ingresoMes: number | null
  pctGastadoDelIngreso: number | null
  ahorroActual: number | null
  proyeccionCierre: number | null
  ahorroProyectado: number | null
  diasDeRunway: number | null

  // Meta
  cantidadTransacciones: number
  hasIngreso: boolean
  esPrimerosDias: boolean   // true si cantidadTransacciones < 3
}
```

**Regla de clasificación de categoría — CRÍTICA:**
```ts
// Una categoría es 'mixed' si tiene ambos tipos de transacciones
const tieneNecesidad = txsDeCategoria.some(tx => !tx.is_want)
const tieneDeseo     = txsDeCategoria.some(tx => tx.is_want)

const tipo: 'need' | 'want' | 'mixed' =
  tieneNecesidad && tieneDeseo ? 'mixed' :
  tieneDeseo ? 'want' : 'need'
```

**Formateo de montos:**
Usar [PLACEHOLDER: nombre de la función de formateo existente en el proyecto].
Si no existe ninguna, crear `formatMonto(amount: number, currency: string): string` en `/lib/utils/format.ts` que retorne formato argentino: `$1.234.567` para ARS, `USD 1.234` para USD.

---

### 3. Reglas — `evaluateInsights(metrics)`

**Ruta:** `/lib/analytics/insights.ts`

```ts
type InsightResult = {
  titular: string
  chips: string[]   // 2-3 mensajes, máx 50 chars cada uno
}
```

**Reglas en orden de prioridad:**

```ts
// FALLBACK — menos de 3 transacciones
// En este estado: mostrar solo el titular F1
// NO mostrar chips, NO mostrar lista de categorías, NO mostrar banner de ingreso
if (metrics.esPrimerosDias) → F1

// GRUPO A
if (hasIngreso && pctGastadoDelIngreso <= 30)  → A1
if (hasIngreso && pctGastadoDelIngreso >= 90)  → A2
if (pctDeseo < 20)                             → A3
if (pctDeseo > 60)                             → A4

// GRUPO B
if (categoryConcentration[0]?.pctDelTotal >= 25)             → B1
if (categoryConcentration[0]?.pctDelTotal >= 15)             → B2
if (topCategoriaFrecuencia.cantidad >= 5 &&
    topCategoriaFrecuencia.tipo !== 'need')                  → B3
if (topCategoriaMonto.tipo !== 'need' &&
    topCategoriaMonto.ticketPromedio es el mayor del mes)    → B4

// GRUPO C
if (pctSemana1DelTotal > 50)  → C1
if (diasSinDeseo >= 7)        → C2

// GRUPO D
if (pctCredito > 40)    → D1
if (pctCredito === 0)   → D2

// GRUPO E — solo si hasIngreso
if (ahorroProyectado < 0)  → E1

// Si ninguna regla matchea → mostrar A3 como fallback genérico
```

**Nota sobre `categoryConcentration` vacío:**
Si el usuario no tiene categorías de deseo que superen el 15%, `categoryConcentration` es un array vacío. El Grupo B no matchea y el sistema cae al Grupo C o D naturalmente. No es un error, es comportamiento esperado.

**Templates de copy:**

```ts
const TEMPLATES = {
  F1: (mes: string) =>
    `${mes} recién arranca. Volvé a fin de mes para ver cómo te fue.`,
  A1: (pct: number) =>
    `Guardaste el ${pct}% de lo que ganaste este mes. Uno de tus mejores cierres.`,
  A2: (pct: number, dias: number) =>
    `Ya usaste el ${pct}% de tus ingresos y quedan ${dias} días. Todavía hay margen para ajustar.`,
  A3: () =>
    `Casi todo lo que gastaste este mes tenía sentido. Mes tranquilo.`,
  A4: () =>
    `Este mes te diste bastantes gustos. Nada malo, pero vale tenerlo en cuenta.`,
  B1: (cat: string) =>
    `${cat} se está llevando casi un cuarto de todo lo que gastás. Vale revisarlo.`,
  B2: (cat: string, pct: number) =>
    `${cat} ya va por el ${pct}% de tus gastos este mes.`,
  B3: (cat: string, n: number) =>
    `Fuiste ${n} veces a ${cat} este mes. Ya es más un hábito que un gusto ocasional.`,
  B4: (cat: string, avg: string) =>
    `Cada salida a ${cat} te salió en promedio ${avg}. No es frecuente, pero pesa.`,
  C1: (pct: number) =>
    `La primera semana te llevaste el ${pct}% de todo lo que gastaste. Arrancás el mes con el pie pesado.`,
  C2: (n: number) =>
    `${n} días seguidos sin un gasto por gusto. Tu mejor racha del mes.`,
  D1: (pct: number) =>
    `El ${pct}% de lo que gastaste todavía no lo sentiste en el bolsillo. Lo viene el mes que viene.`,
  D2: () =>
    `Todo en efectivo o débito este mes. Lo que salió, salió en el momento.`,
  E1: (monto: string) =>
    `Al ritmo que vas, el mes cierra en rojo por ${monto}. Todavía estás a tiempo.`,
}
```

**Chips secundarios:**
Evaluar el resto de reglas que matchean después del titular. Tomar las siguientes 2-3 como chips en versión corta (máx 50 chars).

---

### 4. Componentes de UI

#### Layout — `[PLACEHOLDER: ruta exacta de analytics/page.tsx]`

```
[Header: nombre del mes — type-month, text-primary]
[TitularHero]
[InsightChips — scroll horizontal] ← oculto si esPrimerosDias
[Banner sin ingreso] ← solo si !hasIngreso Y !esPrimerosDias
[Sección "Este mes gastaste en"] ← oculta si esPrimerosDias
  [Top 5 CategoriaRow]
  [Botón expandir — si categorias.length > 5]
  [Filas adicionales — si expandido]
[Bottom TabBar — no tocar]
```

**Eliminar completamente:** MonthlyTrends, NeedWantBreakdown, CategoryDistribution. No hay sparkline.

---

#### `TitularHero.tsx`

- Tipografía: **`type-month` (22px, weight 900, tracking -0.02em)** — NO usar `type-hero`
- Color base: `text-primary (#f0f9ff)`
- Palabras positivas: `success (#4ade80)` como `<span>` inline
- Palabras de alerta: `warning (#f59e0b)` como `<span>` inline
- Fondo: ninguno
- Padding: `px-5 pt-4 pb-2`
- Animación: `slide-up` al montar

---

#### `InsightChips.tsx`

- `flex gap-2 overflow-x-auto px-5 py-3`, sin scrollbar visible
- Cada chip: Glass-1, `border-ocean`, `rounded-full`, `px-3 py-1.5`, `type-meta`, `text-secondary`
- No interactivo
- No renderizar si `esPrimerosDias`

---

#### `CategoriaRow.tsx`

Reutilizar `[PLACEHOLDER: nombre exacto del componente de íconos]`.

Estructura:
```
[Ícono circular bg-tertiary] [Nombre + Nota]    [Monto + Tag]
```

- Contenedor: `bg-secondary`, `border border-ocean`, `rounded-card`, `px-4 py-3`, `mb-2`
- Ícono 40x40, circular, `bg-tertiary`, Phosphor duotone:
  - `tipo === 'need'`  → color `success (#4ade80)`
  - `tipo === 'want'`  → color `want (#fdba74)` ← solo en ícono
  - `tipo === 'mixed'` → color `primary (#38bdf8)`
- Nombre: `type-body` (14px, weight 500), `text-primary`
- Nota: `type-meta` (11px), `text-tertiary`
- Monto: `type-amount` (20px, weight 800, tracking -0.02em), `text-primary`
- Tag pill:
  - need:  `bg-success/10`, texto `success`,      borde `success/20`
  - want:  `bg-want/10`,    texto `text-primary`,  borde `want/20` ← want NUNCA en texto
  - mixed: `bg-primary/10`, texto `primary`,       borde `primary/20`
  - `type-micro` (9px, weight 600), `rounded-full`

Notas descriptivas:
```ts
function getCategoryNote(cat: CategoriaMetric): string {
  if (cat.cantidad === 1) return `Una vez este mes`
  if (cat.category === 'Restaurantes') return `Comiste afuera ${cat.cantidad} veces`
  if (cat.category === 'Delivery') return `Pediste ${cat.cantidad} veces`
  if (cat.category === 'Supermercado') return `${cat.cantidad} compras este mes`
  return `${cat.cantidad} transacciones · promedio ${formatMonto(cat.ticketPromedio, cat.currency)}`
}
```

---

#### Sección categorías — lógica de display y expand

**Orden:** `metrics.categorias` viene ordenado por `total DESC` desde `computeMetrics`. No reordenar en el componente en ningún caso.

**Top 5 visible siempre.** Si `metrics.categorias.length <= 5`, no mostrar botón de expandir.

**Botón expandir:**
- Solo si `metrics.categorias.length > 5`
- Estilo idéntico a InsightChips: Glass-1, `border-ocean`, `rounded-full`, `px-3 py-1.5`, `type-meta`, `text-secondary`
- Texto colapsado: `"Ver todas (${metrics.categorias.length})"`
- Texto expandido: `"Ver menos"`
- Posición: centrado, `mt-2 mb-2`

**Filas adicionales (índice 5 en adelante):**
- Mismo `CategoriaRow` sin variantes
- Orden continúa la secuencia DESC — no se reordena
- Animación: `slide-up` con stagger de 40ms entre filas
- Collapse: **solo con el botón "Ver menos"**, nunca automático por scroll

**Estado del expand:** local al componente de la sección con `useState(false)`. No sube al estado global.

```ts
const [expanded, setExpanded] = useState(false)
const visibleCategorias = expanded
  ? metrics.categorias
  : metrics.categorias.slice(0, 5)
```

---

#### Banner sin ingreso

- Condición: `!metrics.hasIngreso && !metrics.esPrimerosDias`
- `bg-warning/10`, `border border-warning/20`, `rounded-card`, `px-4 py-3`, `mx-5 mb-3`
- Texto: `type-meta`, `text-primary`
- Mensaje: `"Cargá tu ingreso del mes para ver métricas de ahorro."`
- Link: `text-primary` + underline, navega a `/settings`

---

#### Estados de carga

- Clase `.skeleton` (shimmer existente) mientras `loading === true`
- Mostrar: 1 bloque TitularHero skeleton + 5 CategoriaRow skeletons

---

## Archivos a crear / modificar

| Archivo | Acción |
|---|---|
| `/hooks/useAnalyticsData.ts` | Crear |
| `/lib/analytics/computeMetrics.ts` | Crear |
| `/lib/analytics/insights.ts` | Crear |
| `[PLACEHOLDER: ruta exacta analytics/page.tsx]` | Modificar |
| `/components/analytics/TitularHero.tsx` | Crear |
| `/components/analytics/InsightChips.tsx` | Crear |
| `/components/analytics/CategoriaRow.tsx` | Crear |
| `/lib/utils/format.ts` | Crear solo si no existe función de formateo |

---

## Lo que NO tocar

- Lógica de Saldo Vivo en la home
- Tabla `expenses` — no agregar columnas
- SmartInput, ParsePreview
- Bottom TabBar
- `[PLACEHOLDER: nombre del componente de íconos]` — reutilizar sin modificar
- Settings y configuración de moneda
- Componentes de otras pantallas
- NO agregar nuevos usos de Lucide React
- NO crear SparklineDecorativo — la pantalla no tiene gráfico

---

## Orden de implementación

1. Verificar PLACEHOLDERs y completarlos
2. `/hooks/useAnalyticsData.ts`
3. `/lib/analytics/computeMetrics.ts`
4. `/lib/analytics/insights.ts`
5. `CategoriaRow.tsx`
6. `InsightChips.tsx`
7. `TitularHero.tsx`
8. `analytics/page.tsx` — integración final

---

## Criterios de éxito

- [ ] No hay ningún gráfico ni sparkline
- [ ] El titular usa `type-month` (22px), no `type-hero`
- [ ] El titular cambia según las reglas, no es texto fijo
- [ ] Expenses filtradas por `default_currency` — no se mezclan monedas
- [ ] El mes seleccionado viene del estado existente, no hardcodeado
- [ ] Categorías ordenadas por `sum(amount) DESC` siempre, incluso al expandir
- [ ] Clasificación need/want/mixed correcta por categoría
- [ ] Top 5 visible, botón "Ver todas (N)" si hay más
- [ ] Collapse solo con botón, nunca automático
- [ ] `esPrimerosDias`: solo titular F1, sin chips, sin lista, sin banner
- [ ] Sin ingreso: banner visible entre chips y lista, métricas N2 ausentes
- [ ] `want (#fdba74)` nunca en texto, solo en íconos
- [ ] Cero usos nuevos de Lucide React
- [ ] Skeleton de 5 filas durante carga
