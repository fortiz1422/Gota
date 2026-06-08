# Analysis Historical Comparison — Implementation Plan

> **Para Hermes:** implementar esta iteración con cambios mínimos, preservando el hero actual y corrigiendo la inconsistencia entre `Hero` y `Evolution` para `mes abierto + 3+ meses comparables`.

**Goal:** alinear `Evolution` con la misma referencia temporal que ya usa `Hero` cuando el mes está abierto y existe suficiente histórico comparable.

**Architecture:** centralizar la decisión del `comparisonScope` en `resolveAnalyticsEvolution`, exponer metadata explícita a la UI y ajustar el render para que labels/subcopy/tooltip reflejen correctamente si el benchmark es `same_day` o `full_month`.

**Tech Stack:** Next.js, TypeScript strict, Vitest, React client components.

**Spec source:** `docs/analysis-historical-comparison-functional-spec-2026-06-07.md`

---

## Scope de esta implementación

### Incluye
- lógica `same_day` en `Evolution` para `mes abierto + 3+ meses comparables`
- metadata de scope en `AnalyticsEvolutionData`
- copy consistente en el gráfico
- tests unitarios nuevos

### No incluye
- proyección de cierre
- rediseño visual grande
- cambio de regla para `0–2 meses comparables`
- revisión profunda del hero

---

## Archivos a tocar

### Documentación
- Crear: `docs/analysis-historical-comparison-functional-spec-2026-06-07.md`
- Crear: `docs/analysis-historical-comparison-implementation-plan-2026-06-07.md`

### Código
- Modificar: `lib/analytics/analytics-overview.ts`
- Modificar: `components/analytics/AnalyticsEvolution.tsx`
- Modificar: `lib/analytics/analytics-overview.test.ts`

### Verificación
- Ejecutar: `npx vitest run lib/analytics/analytics-overview.test.ts`
- Ejecutar: `npm run lint` o lint acotado si hiciera falta
- Ejecutar: `npm run build`

---

## Task 1: Extender el contrato de datos de Evolution

**Objective:** hacer explícito en tipos cuál es el scope de comparación del gráfico.

**Files:**
- Modify: `lib/analytics/analytics-overview.ts`
- Test: `lib/analytics/analytics-overview.test.ts`

**Paso 1: agregar types nuevos**

Agregar en `analytics-overview.ts`:
- `type AnalyticsComparisonScope = 'same_day' | 'full_month' | 'none'`
- campos nuevos en `AnalyticsEvolutionData`:
  - `comparisonScope`
  - `comparisonDay`

**Paso 2: mantener backward compatibility interna**

No tocar todavía el render. Solo extender el contrato para que luego la UI pueda leerlo.

**Paso 3: verificar TypeScript mentalmente**

Asegurar que toda rama de retorno de `resolveAnalyticsEvolution` setee esos nuevos campos.

**Commit sugerido:**
```bash
git add lib/analytics/analytics-overview.ts
git commit -m "refactor: expose analytics evolution comparison scope"
```

---

## Task 2: Resolver el scope correcto dentro de `resolveAnalyticsEvolution`

**Objective:** hacer que `Evolution` use `same_day` para mes abierto con 3+ meses comparables.

**Files:**
- Modify: `lib/analytics/analytics-overview.ts`
- Test: `lib/analytics/analytics-overview.test.ts`

**Paso 1: definir la regla**

Dentro de `resolveAnalyticsEvolution`:
- si `availableComparisonMonths === 0` → `comparisonScope = 'none'`
- si `availableComparisonMonths <= 2` → mantener comportamiento existente
- si `availableComparisonMonths >= 3`:
  - `comparisonScope = comparisonContext.isCurrentMonth ? 'same_day' : 'full_month'`

**Paso 2: construir la serie correcta**

Para `same_day`:
- `series[].value` debe salir de `getSameDayAmountForMode(point, mode) ?? 0`
- `previousCompletePoints[].value` también debe salir de same-day

Para `full_month`:
- mantener `getAmountForMode(point, mode)`

**Paso 3: construir labels correctos**

- si scope = `same_day` y hay `comparisonDay`:
  - `averageLabel = Promedio {N}m al día {comparisonDay}`
  - `subcopy = Comparado al mismo momento de tus últimos meses.`
- si scope = `full_month`:
  - mantener `Promedio {N}m`
  - mantener `Tu promedio reciente sirve como referencia.`

**Paso 4: devolver metadata**

Incluir en el retorno:
- `comparisonScope`
- `comparisonDay`

**Commit sugerido:**
```bash
git add lib/analytics/analytics-overview.ts
git commit -m "feat: align analytics evolution benchmark with current-month pace"
```

---

## Task 3: Ajustar el render del gráfico para usar la nueva metadata

**Objective:** reflejar en la UI el scope real de comparación sin cambiar innecesariamente el layout.

**Files:**
- Modify: `components/analytics/AnalyticsEvolution.tsx`

**Paso 1: usar el `averageLabel` ya enriquecido**

No reconstruir el label manualmente en el componente. Confiar en `evolution.averageLabel`.

**Paso 2: preservar el tooltip calculado por `averageValue`**

El tooltip actual puede seguir funcionando si `series` y `averageValue` ya vienen del mismo scope.

**Paso 3: mantener estados 0–2 meses**

No tocar la lógica visual de:
- empty / 1 mes
- comparison card de 2–3 meses

**Paso 4: revisar copy visible**

Asegurar que el gráfico muestre:
- subtítulo same-day cuando corresponda
- label `Promedio 3m al día X`

**Commit sugerido:**
```bash
git add components/analytics/AnalyticsEvolution.tsx
git commit -m "fix: clarify analytics evolution same-day comparison copy"
```

---

## Task 4: Escribir tests unitarios para la nueva regla

**Objective:** cubrir el cambio de benchmark para que no vuelva a mezclarse parcial vs cierre completo.

**Files:**
- Modify: `lib/analytics/analytics-overview.test.ts`

**Paso 1: agregar test de 3+ meses con mes actual**

Caso esperado:
- `comparisonScope === 'same_day'`
- `averageLabel === 'Promedio 3m al día X'`
- `averageValue` calculado con `sameDayPercibidoTotal`
- `series` del histórico también calculada con same-day

**Paso 2: agregar test de 3+ meses con mes cerrado**

Caso esperado:
- `comparisonScope === 'full_month'`
- `averageLabel === 'Promedio 3m'`
- `averageValue` calculado con totales completos

**Paso 3: verificar no regresión del caso previo existente**

Mantener o ajustar el test actual de promedio 3m para que siga expresando el comportamiento de mes cerrado.

**Paso 4: correr tests focalizados**

Run:
```bash
PATH=/usr/local/bin:$PATH npx vitest run lib/analytics/analytics-overview.test.ts
```

Expected:
- todos los tests pasan

**Commit sugerido:**
```bash
git add lib/analytics/analytics-overview.test.ts
git commit -m "test: cover same-day evolution benchmark for current month"
```

---

## Task 5: Verificación final

**Objective:** validar que el cambio no rompe el repo ni la build.

**Files:**
- Modify: ninguno

**Paso 1: correr tests focalizados**
```bash
PATH=/usr/local/bin:$PATH npx vitest run lib/analytics/analytics-overview.test.ts
```

**Paso 2: correr lint**
```bash
PATH=/usr/local/bin:$PATH npm run lint
```

**Paso 3: correr build**
```bash
PATH=/usr/local/bin:$PATH npm run build
```

**Paso 4: revisar diff final**
```bash
git diff -- docs/analysis-historical-comparison-functional-spec-2026-06-07.md \
  docs/analysis-historical-comparison-implementation-plan-2026-06-07.md \
  lib/analytics/analytics-overview.ts \
  lib/analytics/analytics-overview.test.ts \
  components/analytics/AnalyticsEvolution.tsx
```

**Expected:**
- cambios acotados al benchmark de `Evolution`
- sin cambios incidentales en otras áreas

---

## Resultado esperado después de implementar

### Antes
- Hero: `same_day`
- Evolution: `full_month`
- Resultado: narrativa mezclada

### Después
#### Mes abierto + 3+ meses comparables
- Hero: `same_day`
- Evolution: `same_day`
- Resultado: una sola narrativa de ritmo actual

#### Mes cerrado + 3+ meses comparables
- Hero: `full_month`
- Evolution: `full_month`
- Resultado: lectura mensual consistente

#### 0–2 meses comparables
- comportamiento actual preservado

---

## Riesgos de implementación

1. **Series placeholders:** no confundir meses sin data con meses reales.
2. **Same-day nulls:** usar fallback seguro cuando el campo same-day venga `null`.
3. **Regresión visual en 2–3 meses:** no tocar ese estado en esta iteración.
4. **Scope implícito en UI:** no recomputar lógica en el componente; usar metadata ya resuelta por la capa de dominio.

---

## Definición de done

La tarea está terminada cuando:
- la spec funcional está guardada en el repo,
- el plan de implementación está guardado en el repo,
- `resolveAnalyticsEvolution` usa same-day para `mes abierto + 3+ meses`,
- el gráfico muestra copy coherente con ese scope,
- los tests nuevos pasan,
- lint y build pasan.
