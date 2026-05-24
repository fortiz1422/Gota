# Analysis — Control Tab: Spec de implementación

**Fecha:** mayo 2026
**Estado:** listo para implementar
**Scope:** reorganización de jerarquía en pantalla de Analysis + preparación para Metas

---

## Decisión de diseño

La pantalla de Analysis tiene dos responsabilidades distintas que no deben mezclarse en la misma jerarquía visual:

- **Resumen** — lectura retrospectiva del mes. Responde: *¿qué pasó?*
- **Control** — operación activa sobre el gasto. Responde: *¿cómo voy contra lo planeado?*

Estas dos responsabilidades conviven como tabs al mismo nivel. Cada tab tiene su propia lectura principal (hero propio) porque sus datos y modo de análisis son distintos: Resumen usa un toggle percibido/devengado que no aplica a Control.

No se modifica el bottom nav. No se mueve el hero de Resumen.

---

## Arquitectura de información

```
ANÁLISIS
│
├── Header (siempre visible)
│   ├── Navegación de mes (← mayo 2026 →)
│   └── Botón "Insights" → abre AnalysisView (modo actual, sin cambios)
│
├── Tabs: [ Resumen ] [ Control ]
│
├── TAB: RESUMEN (sin cambios de diseño)
│   ├── AnalyticsModeToggle (Percibidos / Todo el gasto)
│   ├── AnalyticsHero — headline + amount + subcopy + minigráfico
│   ├── AnalyticsEvolution — barras mensuales
│   └── Sección "Qué movió el mes" — CategoriaRows
│
└── TAB: CONTROL
    │
    ├── SECCIÓN: Presupuesto
    │   ├── [si no hay plan] → BudgetEmptyState (crear / clonar)
    │   └── [si hay plan]
    │       ├── Header de sección con botón "Editar"
    │       ├── BudgetSummaryCard  ← hero de esta sección
    │       └── BudgetCategoryList → BudgetCategoryRow × n
    │
    └── SECCIÓN: Metas  ← nuevo, hoy como empty state
        └── [siempre] → MetasEmptyState (placeholder hasta que exista el feature)
```

---

## Spec visual por tab

### Tab: Resumen

Sin cambios de diseño. El orden actual se mantiene:

```
[toggle: Percibidos | Todo el gasto]   ← mx-5, mb-4
[Hero: headline + amount + subcopy]    ← px-5, py-4
[Evolution]                            ← px-5
[aviso sin ingreso — si aplica]
[Sección "Qué movió el mes"]           ← px-5
  [CategoriaRow × n]
  [Ver todas / Ver menos]
```

### Tab: Control

Scroll vertical. Dos secciones separadas por un `SectionDivider`.

```
[SectionDivider: "Presupuesto"]

  SI NO HAY PLAN:
  [BudgetEmptyState]
    ├── título: "Sin presupuesto para este mes"
    ├── [Crear presupuesto]   ← botón primario
    └── [Clonar anterior]     ← botón secundario, solo si existe plan anterior

  SI HAY PLAN:
  [header inline]
    ├── izq: título "Presupuesto" + subtítulo "Lectura operativa del mes"
    └── der: botón "Editar" (pill border)
  [BudgetSummaryCard]
    ├── label uppercase: "PRESUPUESTO DEL MES"
    ├── amount grande: totalRemaining
    ├── subcopy: "Restante sobre {totalBudgeted}"
    ├── side pill: totalSpent
    └── chips × 3: Pasados (danger) / Al límite (warning) / Adelantados (primary)
  [BudgetCategoryList]
    └── [BudgetCategoryRow × n]
         ├── ícono + nombre + badge de estado
         ├── chips: budget / gastado / restante / %
         ├── barra de progreso + línea de pace esperado
         └── botón "Ver movimientos"

[SectionDivider: "Metas"]

[MetasEmptyState]
  ├── ícono: Target (Phosphor, light)
  ├── título: "Próximamente"
  └── subtítulo: "Vas a poder definir objetivos de ahorro por categoría"
```

---

## SectionDivider — spec del componente nuevo

Separa visualmente las secciones dentro del tab Control. No existe hoy.

**Estructura:**
```
──────── LABEL ────────
```

**Tokens:**
- línea: `border-t border-separator` (`rgba(33,120,168,0.07)`)
- label: `text-[10px] font-bold uppercase tracking-[0.12em] text-text-tertiary`
- margen: `mx-5 my-4`
- layout: `flex items-center gap-3`

**Implementación sugerida:**

```tsx
// components/analytics/SectionDivider.tsx
interface Props { label: string }

export function SectionDivider({ label }: Props) {
  return (
    <div className="mx-5 my-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-separator" />
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-tertiary">
        {label}
      </span>
      <div className="h-px flex-1 bg-separator" />
    </div>
  )
}
```

---

## MetasEmptyState — spec del componente nuevo

Placeholder para la sección de Metas mientras el feature no existe. Debe comunicar que viene sin generar frustración.

**Tokens y layout:**
- contenedor: `mx-5 rounded-card border border-dashed border-border-strong bg-bg-primary px-5 py-6`
- ícono: `Target` de Phosphor, size 24, weight `light`, color `text-text-muted`
- título: `text-[13px] font-semibold text-text-secondary mt-3`
- subtítulo: `text-[12px] text-text-tertiary mt-1 text-center`
- layout: `flex flex-col items-center text-center`

**Implementación sugerida:**

```tsx
// components/analytics/MetasEmptyState.tsx
import { Target } from '@phosphor-icons/react'

export function MetasEmptyState() {
  return (
    <div className="mx-5 flex flex-col items-center rounded-card border border-dashed border-border-strong bg-bg-primary px-5 py-6 text-center">
      <Target size={24} weight="light" className="text-text-muted" />
      <p className="mt-3 text-[13px] font-semibold text-text-secondary">
        Próximamente
      </p>
      <p className="mt-1 text-[12px] text-text-tertiary">
        Vas a poder definir objetivos de ahorro<br />por categoría
      </p>
    </div>
  )
}
```

---

## Cambios en archivos existentes

### 1. `AnalysisSectionTabs.tsx`

**Qué cambia:** type `Section`, array de opciones, label visible.

```diff
- type Section = 'resumen' | 'budgets'
+ type Section = 'resumen' | 'control'

  const OPTIONS = [
    { value: 'resumen', label: 'Resumen' },
-   { value: 'budgets', label: 'Budgets' },
+   { value: 'control', label: 'Control' },
  ]
```

### 2. `AnalyticsClient.tsx`

**Qué cambia:** type `Section`, nombre del estado, condición de render.

```diff
- type Section = 'resumen' | 'budgets'
+ type Section = 'resumen' | 'control'

- const [section, setSection] = useState<Section>('resumen')
+ const [section, setSection] = useState<Section>('resumen')  // sin cambio

- } : (
-   <BudgetsSection ... />
- )}
+ } : (
+   <ControlSection ... />   // ver nota abajo
+ )}
```

> **Nota:** se puede renombrar la referencia a `BudgetsSection` dentro del JSX para que el tab llame a un wrapper `ControlSection`, o simplemente mantener `BudgetsSection` como nombre interno del componente y solo cambiar el label del tab. Lo segundo es suficiente para esta iteración.

### 3. `BudgetsSection.tsx`

**Qué cambia:** agregar `SectionDivider` y `MetasEmptyState` al final del render, y el título del header inline.

```diff
  // Header inline cuando hay plan
- <h2 className="text-[17px] font-semibold text-text-primary">Budgets</h2>
- <p className="text-[12px] text-text-tertiary">Lectura operativa del gasto mensual real.</p>
+ <h2 className="text-[17px] font-semibold text-text-primary">Presupuesto</h2>
+ <p className="text-[12px] text-text-tertiary">Lectura operativa del mes.</p>

  // Al final del return, después de BudgetEditorSheet:
+ <SectionDivider label="Metas" />
+ <MetasEmptyState />
```

> Cuando BudgetEmptyState está activo (no hay plan), el `SectionDivider` y `MetasEmptyState` siguen apareciendo debajo. La sección Metas es independiente del estado del presupuesto.

---

## Contrato de interfaz para Metas (futuro)

Cuando Metas se implemente, `MetasEmptyState` se reemplaza por `MetasSection`. Para que la integración sea limpia, la sección de Metas debe recibir:

```ts
interface MetasSectionProps {
  // datos del server
  metas: MetaSnapshot        // análogo a BudgetSnapshot
  currency: 'ARS' | 'USD'
  selectedMonth: string

  // contexto de análisis (opcional, para mostrar progreso real)
  spendByCategory?: Record<string, number>
}
```

`MetasSection` vive debajo del `SectionDivider` de la misma forma que `BudgetsSection` vive debajo del suyo. No requiere cambios estructurales en `BudgetsSection` ni en `AnalyticsClient`.

`AnalyticsDataLoader` incorporará un tercer `useQuery` para metas, análogo al de budgets, cuando el feature exista.

---

## Orden de implementación

1. Crear `SectionDivider` en `components/analytics/SectionDivider.tsx`
2. Crear `MetasEmptyState` en `components/analytics/MetasEmptyState.tsx`
3. Modificar `AnalysisSectionTabs.tsx` — renombrar type y label
4. Modificar `AnalyticsClient.tsx` — actualizar type `Section`
5. Modificar `BudgetsSection.tsx` — título inline + agregar divider + MetasEmptyState al final
6. Verificar que `BudgetEmptyState` convive correctamente con el nuevo bloque de Metas

No hay cambios de API, schema, ni data loading.

---

## Lo que no cambia

- Bottom nav (3 ítems: Home, Movimientos, Análisis)
- `AnalyticsHero` y `AnalyticsModeToggle` — permanecen dentro del tab Resumen
- `AnalysisView` (Insights) — sigue siendo el modo activado desde el botón del header
- Toda la lógica de budgets (APIs, queries, editor sheet, métricas)
- Routing y data loading

---

## Criterio de éxito

- El usuario que va a Control siempre ve primero el estado de su presupuesto
- El usuario que va a Resumen siempre ve primero el resumen del mes con su toggle
- Los dos tabs no compiten ni comparten estado visual
- La sección Metas está presente como destino, aunque vacía, sin confundir
- Agregar Metas en el futuro no requiere tocar `BudgetsSection` ni `AnalyticsClient`
