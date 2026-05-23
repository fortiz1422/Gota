# Spec — Budgets v1 en Gota

## 1. Objetivo

Agregar una capa de **presupuesto mensual por categoría** que permita al usuario entender:

- cuánto planeó gastar
- cuánto ya gastó
- cuánto le queda
- si viene acelerado contra el ritmo esperado del mes

sin tocar ni distorsionar:

- `Saldo Vivo`
- `Disponible Real`
- balances de cuentas
- lógica contable existente

---

## 2. Resumen ejecutivo

**Budgets v1 vive en `Análisis`.**

No es:
- una nueva tab global
- una reserva de dinero
- un sistema de envelopes
- una contabilidad paralela

Sí es:
- una lectura operativa del gasto mensual real
- por categorías relevantes
- con semáforo de avance y pacing
- con edición simple
- con deep link a `Movimientos` para explicar desvíos

---

## 3. Problema que resuelve

Hoy Gota te dice bien:

- cuánto tenés
- cuánto debés
- qué pasó

Pero no te dice bien:

- si este mes estás gastando de más en las categorías que te importan
- si ese desvío es puntual o viene adelantado por ritmo
- dónde conviene enfocar corrección

El vacío no es contable.  
Es de **lectura del mes**.

---

## 4. Principios de producto

### 4.1 Verdad financiera primero
Budget **no descuenta plata**.  
Budget **no modifica disponible**.  
Budget **solo interpreta gasto real**.

### 4.2 Análisis, no Home
El detalle vive en `Análisis`.  
Home después podrá resumir una señal.

### 4.3 V1 liviano
No entra en v1:
- carryover
- sobres/envelopes
- presupuestos semanales
- reglas automáticas sofisticadas
- multimoneda mezclada

### 4.4 Acción explicable
Si una categoría está mal, el usuario tiene que poder tocarla y llegar a:
- qué categoría es
- cuánto gastó
- qué movimientos la explican

### 4.5 Categorías y normalización
Las categorías del budget no son un catálogo paralelo.
Se apoyan en las categorías reales de `expenses` y se guardan con una forma canónica por plan.

Reglas v1:
- normalizar `trim` + espacios múltiples + casing consistente al guardar
- no duplicar categorías dentro del mismo plan
- si aparece una variante nueva, se corrige por edición del item, no creando otra categoría “parecida”
- el matching con movimientos debe ser estable y no depender de texto libre ambiguo

---

# 5. Scope v1

## Incluye
- crear un presupuesto mensual
- definir montos por categoría
- ver gasto real por categoría
- ver restante
- ver porcentaje consumido
- ver ritmo esperado del mes
- ver estado (`on_track`, `near_limit`, `over_budget`, `ahead_of_pace`)
- editar categorías presupuestadas
- clonar desde mes anterior
- deep link a `Movimientos` filtrado por categoría/mes

## No incluye
- presupuestos por subcategoría
- carryover
- presupuestos por cuenta
- presupuestos por tarjeta
- conversión automática ARS/USD
- alertas push/notificaciones
- integración con Home
- recomendador sofisticado por IA

---

# 6. Ubicación en producto

## Surface principal
`/analytics`

## Estructura sugerida dentro de Análisis
Nuevo switcher interno:

- `Resumen`
- `Budgets`
- `Metas`
- `Insights`

En v1 de Budgets, implementamos solo:
- sección `Budgets`

## Surface secundaria
`Movimientos`

Solo como drill:
- “ver qué explica este gasto”

## Surface terciaria
`Settings`

No es entrada principal.  
En v1 no hace falta tocarla salvo que quieras guardar defaults más adelante.

---

# 7. UX funcional

## 7.1 Estado sin presupuesto
Si el usuario no tiene budget para ese mes:

Card/empty state:
- título: `Presupuesto del mes`
- texto: `Definí límites por categoría para entender si venís dentro de tu plan.`
- CTA primario: `Crear presupuesto`
- CTA secundario: `Usar categorías sugeridas` si existe baseline previo

---

## 7.2 Estado con presupuesto
Lista de categorías presupuestadas con:

- nombre categoría
- budget
- gastado
- restante
- `% usado`
- indicador de ritmo
- estado visual
- CTA `ver movimientos`

Ejemplo visual de fila:

- `Supermercado`
- `Budget: ARS 280.000`
- `Gastado: ARS 190.000`
- `Restante: ARS 90.000`
- `68% usado`
- `Vas adelantado vs ritmo del mes`

---

## 7.3 Editor
Sheet o modal simple desde `Análisis`:

- categoría
- monto mensual
- guardar
- eliminar item
- agregar categoría

No haría una pantalla separada en v1.

### Lifecycle de edición
- el plan del mes es editable en vivo
- no hay draft/versionado complejo en v1
- guardar cambios recalcula el resumen de inmediato
- clonar crea un nuevo plan para el mes destino, no sobrescribe el actual

---

## 7.4 Clonado
Al crear un budget para un mes:
- si hay budget del mes previo, ofrecer:
  - `Clonar presupuesto anterior`
  - `Crear desde cero`

---

# 8. Lógica funcional

## 8.1 Fuente de verdad
Budget se calcula sobre movimientos reales ya persistidos.

Fuente base:
- `expenses`

No:
- cuentas
- balances
- metas
- disponible real
- snapshots del Home

---

## 8.2 Base contable elegida
### V1 usa gasto `percibido`
No `devengado`.

### Motivo
El budget responde mejor a:
- caja real del mes
- sensación concreta de gasto
- lectura operativa inmediata

### Nota de arquitectura
Dejar preparado para futuro:
- `budget_basis = perceived | accrued`

Pero no lo expondría en UI v1.

---

## 8.3 Qué gastos cuentan
Para un `budget_item` cuentan los `expenses` del mes seleccionado que:

- pertenezcan al `user_id`
- caigan en la categoría del item
- estén dentro del mes activo
- estén en la moneda del plan
- sean gastos reales

Excluir:
- pagos de tarjeta de deuda / cancelación de resumen
- transferencias
- ingresos
- yield
- reversos / movimientos no computables como gasto si ya hay ese concepto en el modelo

Casos especiales:
- compras con tarjeta que representan consumo real sí cuentan como gasto si ya están persistidas como expense normal
- cuotas e installment flows cuentan cuando el gasto real fue registrado, no cuando se paga el resumen
- si un movimiento no es claramente gasto, no se usa para budget v1

---

## 8.4 Cálculos por categoría

Para cada item:

- `budget_amount`
- `spent_amount`
- `remaining_amount = budget_amount - spent_amount`
- `used_pct = spent_amount / budget_amount`
- `days_elapsed`
- `days_in_month`
- `expected_pct = days_elapsed / days_in_month`
- `pace_delta = used_pct - expected_pct`

---

## 8.5 Estados derivados

### `on_track`
- `used_pct < 0.8`
- y no viene materialmente adelantado al ritmo

### `near_limit`
- `used_pct >= 0.8`
- y `< 1`

### `over_budget`
- `used_pct >= 1`

### `ahead_of_pace`
- aunque todavía no haya llegado a 80%, si:
  - `used_pct` está claramente por encima del `expected_pct`

Recomendación práctica:
- marcar `ahead_of_pace` si supera el ritmo esperado por más de 15 puntos

Ejemplo:
- día 10/30 = esperado 33%
- va 55%
- está adelantado

---

## 8.6 Resumen global del budget del mes
Además de filas por categoría, mostrar:

- `total_budgeted`
- `total_spent_on_budgeted_categories`
- `total_remaining`
- `categories_over_budget_count`
- `categories_near_limit_count`
- `categories_ahead_of_pace_count`

---

# 9. Modelo de datos

## 9.1 Tabla `budget_plans`

Un plan por usuario por mes por moneda base.

Campos:

- `id uuid pk`
- `user_id uuid not null`
- `period_month date not null`
- `base_currency text not null`
- `status text not null default 'active'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### Constraints
- unique `(user_id, period_month, base_currency)`

### Notas
- `period_month` siempre normalizado a primer día del mes
- `base_currency` v1: `ARS` o `USD`

---

## 9.2 Tabla `budget_items`

Cada categoría dentro del plan.

Campos:

- `id uuid pk`
- `plan_id uuid not null references budget_plans(id) on delete cascade`
- `user_id uuid not null`
- `category text not null`
- `amount numeric not null`
- `sort_order int not null default 0`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### Constraints
- unique `(plan_id, category)`
- `amount > 0`

### Notas
`user_id` está duplicado a propósito para simplificar políticas/RLS/queries.

---

## 9.3 Tabla `budget_alert_events`
No imprescindible para la UI inicial, pero sí recomendable si querés que la lógica no se re-dispare siempre igual.

Campos:

- `id uuid pk`
- `user_id uuid not null`
- `budget_item_id uuid not null references budget_items(id) on delete cascade`
- `period_month date not null`
- `threshold text not null`
- `current_spend_snapshot numeric not null`
- `triggered_at timestamptz not null default now()`

### Puede esperar
Si querés recortar aún más v1, esta tabla puede entrar en fase 1.5.

---

## 10. Políticas de moneda

## Regla v1
Un `budget_plan` tiene una sola `base_currency`.

Eso significa:
- un plan no mezcla ARS + USD dentro del mismo cálculo
- si el usuario quiere ambas monedas, se modela como planes separados por moneda
- la UI no debe sugerir un total combinado entre monedas en v1

Ejemplos:
- presupuesto ARS para gastos ARS
- presupuesto USD para gastos USD

## No hacer en v1
- sumar ARS + USD convertidos
- usar FX implícito
- mostrar “total budget mensual” mezclando monedas

## Implicancia UI
Si el usuario usa ambas monedas, puede tener:
- budget ARS del mes
- budget USD del mes

Pero en v1 la recomendación es mostrar solo el budget de la moneda principal visible y dejar la otra moneda fuera del surface de Budgets.

---

# 11. API design

## 11.1 GET `/api/budgets/current?month=YYYY-MM&currency=ARS`
Devuelve:
- plan actual
- items
- métricas calculadas por item
- summary global

### Response shape sugerida
```json
{
  "plan": {
    "id": "uuid",
    "periodMonth": "2026-05-01",
    "baseCurrency": "ARS",
    "status": "active"
  },
  "summary": {
    "totalBudgeted": 650000,
    "totalSpent": 412000,
    "totalRemaining": 238000,
    "overBudgetCount": 1,
    "nearLimitCount": 2,
    "aheadOfPaceCount": 2
  },
  "items": [
    {
      "id": "uuid",
      "category": "Supermercado",
      "amount": 280000,
      "spent": 190000,
      "remaining": 90000,
      "usedPct": 0.6785,
      "expectedPct": 0.5,
      "paceDelta": 0.1785,
      "status": "ahead_of_pace"
    }
  ]
}
```

---

## 11.2 POST `/api/budgets/current`
Crea plan + items.

### Request
```json
{
  "periodMonth": "2026-05-01",
  "baseCurrency": "ARS",
  "items": [
    { "category": "Supermercado", "amount": 280000 },
    { "category": "Delivery", "amount": 70000 },
    { "category": "Transporte", "amount": 50000 }
  ]
}
```

---

## 11.3 PATCH `/api/budgets/items/:id`
Edita:
- `amount`
- `sort_order`

No haría patch de categoría en v1 salvo que lo necesites mucho.

---

## 11.4 DELETE `/api/budgets/items/:id`
Elimina categoría del presupuesto.

---

## 11.5 POST `/api/budgets/clone-from-previous`
Clona items desde el mes anterior.

### Request
```json
{
  "periodMonth": "2026-06-01",
  "baseCurrency": "ARS"
}
```

---

## 11.6 GET `/api/budgets/suggestions?month=YYYY-MM&currency=ARS`
Opcional fase 1.5.  
Devuelve categorías sugeridas según gasto histórico reciente.

No imprescindible para el primer corte.

---

# 12. Query layer / server design

## Archivos nuevos
- `lib/server/budget-queries.ts`
- `lib/budgets/computeBudgetMetrics.ts`
- `lib/budgets/types.ts`

---

## Responsabilidades

### `lib/server/budget-queries.ts`
- leer `budget_plans`
- leer `budget_items`
- leer gastos del mes por categoría
- devolver shape lista para API

### `lib/budgets/computeBudgetMetrics.ts`
Pure functions:
- cálculo de `spent`
- `% usado`
- `remaining`
- `expected pace`
- `status`

### `lib/budgets/types.ts`
Contratos frontend/backend:
- `BudgetPlan`
- `BudgetItem`
- `BudgetItemMetrics`
- `BudgetSummary`
- `BudgetApiResponse`

---

# 13. Integración con Análisis

## Archivos a tocar

### `app/(dashboard)/analytics/page.tsx`
No grande. Mantener entrypoint.

### `components/analytics/AnalyticsDataLoader.tsx`
Agregar fetch de budgets o un loader paralelo.

### `components/analytics/AnalyticsClient.tsx`
Agregar section switcher y estado de vista interna.

### `components/analytics/AnalysisView.tsx`
Separar el overview actual y permitir montar `BudgetsSection`.

---

## Componentes nuevos
- `components/analytics/AnalysisSectionTabs.tsx`
- `components/analytics/BudgetsSection.tsx`
- `components/analytics/BudgetSummaryCard.tsx`
- `components/analytics/BudgetCategoryList.tsx`
- `components/analytics/BudgetCategoryRow.tsx`
- `components/analytics/BudgetEditorSheet.tsx`
- `components/analytics/BudgetEmptyState.tsx`

---

# 14. Deep links a Movimientos

## Necesidad
Cuando el usuario vea:
- “Supermercado va pasado”
necesita poder entender por qué.

## Solución
CTA por fila:
- `Ver movimientos`

Destino:
`/movimientos?month=2026-05&category=Supermercado`

## Condición
Si hoy `Movimientos` no soporta ese filtro por query param, hay que agregarlo.

Eso es parte del spec.

---

# 15. Casos borde

## 15.1 Categoría con budget y sin gastos
- `spent = 0`
- `remaining = full`
- `usedPct = 0`

## 15.2 Categoría con gasto y budget cero
No debería existir si el item requiere `amount > 0`.

## 15.3 Categoría eliminada del sistema pero con item histórico
- mantener texto persistido en `budget_items.category`
- no depender de catálogo vivo para render histórico

## 15.4 Duplicación de categorías
Bloquear por unique `(plan_id, category)`

## 15.5 Mes sin plan
Mostrar empty state, no error

## 15.6 Moneda mezclada
No sumar distintas monedas en un mismo plan

## 15.7 Gasto reclasificado
Budget debe recalcular naturalmente porque lee `expenses` live

---

# 16. Decisiones explícitas de no-diseño

Para que después no se desvíe implementación:

## No hacer en v1
- forecast de cierre complejo
- baseline automático obligatorio
- categorías sugeridas por IA como feature central
- alertas push
- presupuesto por semana
- mover Budget a Home
- deducir budget de saldo disponible
- multi-basis `percibido/devengado` en UI

---

# 17. Validaciones

## Backend
- `periodMonth` válido y normalizable
- `baseCurrency` válida
- no duplicar plan por mes/moneda
- items con `amount > 0`
- categorías únicas dentro del plan

## Frontend
- no permitir guardar plan vacío
- no permitir monto vacío o <= 0
- feedback claro en error de duplicado

---

# 18. Riesgos y mitigaciones

## Riesgo 1
**Contaminar verdad contable**

Mitigación:
- budget no toca dashboard balances
- no escribe en `expenses`
- no altera `Disponible Real`

## Riesgo 2
**Acoplar demasiado a analytics-data**
Mitigación:
- endpoint propio `/api/budgets/current`
- no meter toda la lógica en `/api/analytics-data`

## Riesgo 3
**Moneda ambigua**
Mitigación:
- `base_currency` explícita por plan
- sin conversión automática v1

## Riesgo 4
**Gasto por categoría inconsistente**
Mitigación:
- usar la misma fuente/categorización real ya existente en `expenses`
- no crear capa paralela de categorías solo para budgets

## Riesgo 5
**Implementación gigante**
Mitigación:
- fasear:
  1. create/read/update basic
  2. clone previous
  3. suggestions
  4. eventual Home snapshot

---

# 19. Fases de implementación

## Fase 1 — foundation
- schema nuevo
- tipos DB
- query layer
- endpoint GET current
- endpoint POST create
- endpoint PATCH item
- UI BudgetsSection básica
- empty state
- lista por categoría

## Fase 2 — operabilidad
- delete item
- clone previous month
- deep links a Movimientos
- summary global
- semáforos y ritmo

## Fase 3 — refinamiento
- suggestions
- alert event persistence
- snapshot eventual a Home

---

# 20. Mapa concreto de archivos a tocar

## Crear
- `lib/server/budget-queries.ts`
- `lib/budgets/computeBudgetMetrics.ts`
- `lib/budgets/types.ts`
- `app/api/budgets/current/route.ts`
- `app/api/budgets/clone-from-previous/route.ts`
- `app/api/budgets/items/[id]/route.ts`
- `components/analytics/AnalysisSectionTabs.tsx`
- `components/analytics/BudgetsSection.tsx`
- `components/analytics/BudgetSummaryCard.tsx`
- `components/analytics/BudgetCategoryList.tsx`
- `components/analytics/BudgetCategoryRow.tsx`
- `components/analytics/BudgetEditorSheet.tsx`
- `components/analytics/BudgetEmptyState.tsx`

## Modificar
- `components/analytics/AnalyticsClient.tsx`
- `components/analytics/AnalyticsDataLoader.tsx`
- `components/analytics/AnalysisView.tsx`
- `types/database.ts`
- `app/(dashboard)/movimientos/page.tsx` o el cliente asociado, si hace falta soportar filtros por query
- SQL/migration file nuevo donde estés guardando cambios de schema

---

# 21. Acceptance criteria

## Producto
- el usuario puede crear un budget mensual por categoría
- puede ver cuánto lleva gastado en cada categoría
- puede ver cuánto le queda
- puede ver si viene adelantado o no vs ritmo del mes
- puede editar montos
- puede navegar a movimientos de una categoría

## Financiero
- budget no modifica saldo vivo
- budget no modifica disponible real
- budget no crea movimientos
- budget no altera pagos, compromisos, tarjetas o balances

## Técnico
- el mes sin budget no rompe Análisis
- categorías reclasificadas recalculan correctamente
- no se mezclan monedas dentro del plan
- el sistema tolera histórico sin budget

---

# 22. Testing recomendado

## Unit
Para `computeBudgetMetrics.ts`:
- cálculo de `% usado`
- cálculo de `remaining`
- cálculo de ritmo esperado
- clasificación de status

## Integration
Para API:
- create plan
- prevent duplicate plan
- patch item
- clone previous month

## UI
- empty state
- populated state
- over budget visual state
- ahead of pace visual state
- deep link correcto a movimientos

---

# 23. Mi recomendación de corte exacto para implementar primero

Si querés el corte más sano:

## primer PR / primer batch
- schema `budget_plans` + `budget_items`
- `GET /api/budgets/current`
- `POST /api/budgets/current`
- `PATCH /api/budgets/items/:id`
- `BudgetsSection` simple en `Análisis`
- lista + summary + empty state

## segundo PR
- `clone-from-previous`
- `DELETE item`
- deep link a `Movimientos`
- pacing status refinado

Eso mantiene alcance controlado.

---

# 24. Mi postura final

Este spec ya está en nivel implementable.  
No lo veo como un experimento abstracto; lo veo como una feature realista y alineada con la arquitectura actual.

## Lo que haría ahora
1. **cerrar este spec**
2. después te armo **Metas v1** con el mismo nivel
3. y recién ahí hacemos **plan de ejecución por batches/PRs**
