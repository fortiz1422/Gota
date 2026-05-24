# Spec — Metas v1 en Gota

## 1. Objetivo

Agregar una capa de **metas de ahorro / destino** que permita al usuario entender:

- qué quiere lograr
- cuánto necesita juntar
- cuánto ya lleva realmente aportado
- cuánto le falta
- a qué ritmo debería aportar para llegar

sin tocar ni distorsionar:

- `Saldo Vivo`
- `Disponible Real`
- balances reales de cuentas
- deuda de tarjeta
- lógica contable actual

---

## 2. Resumen ejecutivo

**Metas v1 vive en `Análisis`, no en Home ni en Settings.**

No es:
- una subcuenta real
- un sobre/envelope
- dinero reservado automáticamente
- una deducción silenciosa de `Disponible Real`
- una proyección basada en “plata total”

Sí es:
- una capa de dirección y progreso
- construida sobre **aportes explícitos**
- con objetivo, fecha opcional, ritmo sugerido y progreso visible
- alineada con la filosofía de Gota: **verdad financiera primero**

---

## 3. Qué hacen los referentes de mercado y qué nos conviene tomar

### 3.1 Hallazgos observables en fuentes públicas

### YNAB — `Goal Tracking`
Hechos observables en su página pública:
- usa **targets** con monto y horizonte temporal
- calcula cuánto ahorrar por **semana / mes / año / fecha custom**
- muestra **progreso visual**
- da **recordatorios** de cuánto falta aportar
- permite **snoozear** el target del mes

Lectura útil para Gota:
- el usuario entiende muy bien una meta cuando hay:
  - monto objetivo
  - fecha
  - aporte sugerido
  - barra de progreso
- el valor no está solo en “guardar un objetivo”, sino en **traducirlo a ritmo**

### Monarch — `Planning / Goals`
Hechos observables en su página pública:
- permite crear múltiples goals con:
  - `target amount`
  - `planned monthly contribution`
  - imagen/customización
- permite **assign accounts to goals**
- promete trackear progreso automáticamente desde cuentas/inversiones asignadas
- permite marcar metas como completadas

Lectura útil para Gota:
- es valioso que la meta tenga:
  - una identidad visual
  - una contribución mensual esperada
  - una sensación de “esto está fondeado en algo concreto”
- **pero** el modelo de “asignar cuentas a goals” hay que tratarlo con mucho cuidado en Gota

### Quicken Simplifi — messaging de `save more money` y `projected cash flow`
Hechos observables en su página pública:
- enfatiza:
  - `always know what’s left to spend & save`
  - visualizar ingreso, bills, subscriptions y savings
  - `projected cash flow`
  - escenarios `what-if`

Lectura útil para Gota:
- hay una expectativa de mercado de conectar metas con la lectura futura del flujo
- pero ese nivel de forecast conviene dejarlo **fuera de v1** en Gota

---

## 4. Qué copiar y qué no copiar

## Copiar
- de **YNAB**:
  - target amount
  - target date opcional
  - aporte sugerido por período
  - progreso claro
  - estados visuales simples
- de **Monarch**:
  - meta como objeto independiente
  - posibilidad de asociar contexto de cuenta
  - monthly contribution target
  - completed state
- de **Simplifi**:
  - la idea de que una meta no es solo pasado, también dirección

## No copiar tal cual
- de **Monarch**:
  - “el saldo de la cuenta = progreso de la meta” como regla dura
- de **YNAB**:
  - target mezclado directamente con el sistema central de envelopes
- de **Simplifi**:
  - forecast sofisticado / what-if en v1

## Tesis para Gota
En Gota, una meta debe ser:

**una dirección clara, visible y motivante, pero nunca una mentira contable.**

Eso implica:
- el progreso sale de **aportes explícitos**
- la cuenta asociada es **contexto**, no prueba automática de ahorro
- `Disponible Real` no baja porque exista una meta

---

## 5. Problema que resuelve

Hoy Gota te ayuda a entender:
- estado financiero real
- gastos
- compromisos
- tarjetas

Pero no te ayuda todavía a responder bien:
- `¿cuánto llevo ahorrado para algo concreto?`
- `¿si quiero llegar a X para tal fecha, qué ritmo necesito?`
- `¿voy bien o atrasado?`
- `¿qué aportes reales hice a esa meta?`

El vacío no es contable.
Es de **dirección financiera personal**.

---

## 6. Principios de producto

### 6.1 Verdad financiera primero
Una meta **no mueve dinero por sí sola**.
No crea saldo reservado.
No reduce disponible.
No altera balances.

### 6.2 Progreso solo por evidencia explícita
El progreso de una meta sale de:
- `starting_amount`
- `goal_contributions`

No de:
- balance de la cuenta
- net worth
- saldo total en USD/ARS
- suposiciones

### 6.3 Dirección, no simulación
La meta sirve para responder:
- `qué quiero lograr`
- `cuánto llevo`
- `qué me falta`
- `a qué ritmo voy`

No para simular subcuentas invisibles.

### 6.4 Surface principal en `Análisis`
Alta, edición, detalle y aporte viven en `Análisis`.
Home después solo puede resumir una señal.

### 6.5 V1 simple y confiable
No meter en v1:
- simulación automática de asignación de saldo
- predicción compleja
- reglas automáticas de ahorro
- goals compartidas
- goals multicurrency mezcladas

---

## 7. Cómo convive con la filosofía de Gota

### Home
Debe seguir mostrando estado real y prioridades operativas.
No debe transformarse en dashboard de planificación.

### Movimientos
Sigue siendo el ledger operativo.
Solo entra como drill para:
- ver transferencias vinculadas
- revisar aportes

### Análisis
Es el lugar correcto para Metas porque mezcla:
- lectura del mes
- performance
- dirección

### Settings
Puede alojar defaults más adelante.
No debe ser la entrada principal.

---

## 8. Definición del producto

## 8.1 Qué es una Meta en Gota
Una meta es un objeto con:
- nombre
- monto objetivo
- moneda
- fecha objetivo opcional
- monto inicial opcional
- aportes explícitos
- estado derivado y/o persistido

## 8.2 Tipos de meta que v1 soporta bien
- fondo de emergencia
- viaje
- auto
- notebook
- ahorro para mudanza
- pago grande planificado

## 8.3 Tipo de meta que v1 no debería prometer todavía
- payoff automático de deuda compleja
- objetivos mezclando varias monedas con FX dinámico
- metas que dependen de valorización de inversiones

Podrían existir en v2, pero no deben contaminar v1.

---

## 9. Scope v1

## Incluye
- crear meta
- editar meta
- pausar / reactivar meta
- completar meta manualmente
- archivar meta
- registrar aporte manual
- vincular transferencia existente como aporte
- opcional: vincular ingreso existente como aporte (si el esfuerzo backend es razonable)
- ver progreso
- ver restante
- ver required monthly contribution si tiene fecha
- ver estado de ritmo (`on_track`, `behind`, `completed`)
- ver historial de aportes
- drill a movimiento vinculado cuando exista

## No incluye
- reservar saldo automáticamente
- leer saldo de cuenta como progreso real
- reparto automático de ingresos entre metas
- reglas auto-save
- forecast de cash flow completo
- conversión automática ARS/USD
- home widget final
- colaboración multiusuario

---

## 10. Mental model de UX

## 10.1 Regla clave
**Crear una meta no significa separar plata.**

La UI lo debe decir claro.

Texto sugerido:
- `Las metas no apartan dinero automáticamente. El progreso avanza con aportes registrados.`

## 10.2 Dos conceptos separados
- **Meta** = destino
- **Aporte** = evidencia

## 10.3 Cuenta asociada
Puede existir `cuenta sugerida / asociada`, pero con texto explícito:
- `Solo referencia visual. No usa el saldo de esta cuenta como progreso automático.`

---

## 11. UX funcional

## 11.1 Estado vacío de Metas
Dentro de `Análisis > Metas`:

- título: `Tus metas`
- subtítulo: `Convertí objetivos en un plan visible, sin mezclarlo con tu saldo real.`
- CTA primario: `Crear meta`
- bullets de ayuda:
  - `Definí un monto objetivo`
  - `Opcionalmente elegí una fecha`
  - `Registrá aportes cuando realmente ahorres`

---

## 11.2 Overview de Metas
Lista de metas activas con cards compactas.
Cada card muestra:
- nombre
- emoji o ícono
- monto acumulado
- target amount
- restante
- progress bar
- fecha objetivo si existe
- aporte mensual requerido
- estado visual
- CTA `Aportar`
- CTA secundario `Ver detalle`

Ejemplo:
- `Viaje a Japón`
- `USD 1.450 de USD 3.000`
- `Te faltan USD 1.550`
- `Necesitás USD 258/mes para llegar en 6 meses`
- `Estado: en ritmo`

---

## 11.3 Detalle de meta
En sheet o pantalla drill:
- hero de la meta
- progreso total
- target / restante
- fecha objetivo
- required monthly contribution
- historial de aportes
- CTA `Registrar aporte`
- CTA `Vincular transferencia`
- CTA `Editar meta`
- CTA `Pausar` / `Reactivar`

---

## 11.4 Crear meta
Campos v1:
- nombre
- emoji o icono simple
- color token
- moneda (`ARS` | `USD`)
- monto objetivo
- fecha objetivo opcional
- monto inicial opcional
- cuenta asociada opcional
- nota opcional

No metería categorías de meta ni demasiada configuración.

---

## 11.5 Registrar aporte
Opciones v1:

### A. Aporte manual
Campos:
- monto
- moneda
- fecha
- nota opcional

### B. Vincular transferencia existente
Campos:
- selector de transferencia elegible
- confirmación

Comportamiento:
- se crea `goal_contribution` con `source_type = transfer_linked`
- se referencia `related_transfer_id`
- no se duplica la transferencia ni se altera su lógica

### C. Vincular ingreso existente
Opcional fase 1.5
- usar `income_entries`
- `source_type = income_linked`

---

## 11.6 Estados visuales

### `on_track`
- tiene fecha
- required monthly contribution actual <= remaining_months pace

### `behind`
- tiene fecha
- el ritmo histórico real está por debajo del necesario

### `no_date`
- no tiene fecha
- mostrar progreso y restante sin presión temporal

### `completed`
- current_amount >= target_amount

### `paused`
- meta pausada
- no mostrar “atrasada” agresivamente

---

## 12. Modelo de datos

## 12.1 Tabla `goals`

Campos recomendados:

- `id uuid pk`
- `user_id uuid not null`
- `name text not null`
- `emoji text null`
- `color_token text null`
- `target_amount numeric not null`
- `currency text not null`
- `target_date date null`
- `starting_amount numeric not null default 0`
- `linked_account_id uuid null`
- `notes text null`
- `status text not null default 'active'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `completed_at timestamptz null`
- `paused_at timestamptz null`

### Constraints
- `target_amount > 0`
- `starting_amount >= 0`
- `currency in ('ARS','USD')`
- `status in ('active','paused','completed','archived')`

### Notas
- `linked_account_id` referencia contexto, no progreso automático
- `target_date` es opcional porque hay metas sin deadline

---

## 12.2 Tabla `goal_contributions`

Campos recomendados:

- `id uuid pk`
- `goal_id uuid not null references goals(id) on delete cascade`
- `user_id uuid not null`
- `amount numeric not null`
- `currency text not null`
- `contributed_at date not null`
- `source_type text not null`
- `note text null`
- `related_transfer_id uuid null`
- `related_income_entry_id uuid null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### Constraints
- `amount > 0`
- `currency in ('ARS','USD')`
- `source_type in ('manual','transfer_linked','income_linked','adjustment')`

### Reglas críticas
- la contribution debe tener la **misma moneda que la meta** en v1
- no mezclar monedas dentro de una misma meta
- si se quiere aportar en otra moneda, eso es v2 con FX explícito

---

## 12.3 ¿Hace falta una tabla extra para snapshots?
No en v1.

Todo lo importante se puede derivar de:
- `goals`
- `goal_contributions`

---

## 13. Lógica funcional

## 13.1 Fuente de verdad del progreso

`current_amount = starting_amount + sum(goal_contributions.amount)`

Siempre filtrando:
- por `goal_id`
- por `user_id`
- por misma moneda

---

## 13.2 Cálculos principales

Por meta:
- `current_amount`
- `remaining_amount = max(target_amount - current_amount, 0)`
- `progress_pct = min(current_amount / target_amount, 1)`

Si tiene fecha:
- `months_remaining`
- `required_monthly_contribution = remaining_amount / months_remaining`

Si no tiene fecha:
- no hay required monthly contribution
- solo progreso y restante

---

## 13.3 Cálculo de ritmo

Para metas con fecha:
- calcular meses entre hoy y `target_date`
- si `months_remaining <= 0` y no está completa:
  - estado = `behind`
- si `current_amount >= target_amount`:
  - estado = `completed`
- si no:
  - comparar ritmo real acumulado vs ritmo requerido

### Recomendación v1 simple
No sofisticar demasiado el “pace”.
Usar una lectura directa:
- `required_monthly_contribution`
- `remaining_amount`
- `months_remaining`

Y derivar:
- `on_track` si todavía la meta es alcanzable con un aporte mensual razonable y no está vencida
- `behind` si ya pasó fecha o el required monthly contribution pega un salto significativo vs el plan inicial

### Si querés una versión más determinista
Persistir `planned_monthly_contribution` en `goals`.
Eso ayuda mucho.

Mi recomendación: **sí agregarlo en v1**.

---

## 13.4 Campo recomendado adicional
Agregar en `goals`:
- `planned_monthly_contribution numeric null`

### Por qué
Porque resuelve tres cosas:
1. refleja la intención del usuario
2. permite comparar `plan vs realidad`
3. evita inventar lógica implícita después

Entonces:
- si existe `planned_monthly_contribution`, se compara contra el required actual
- si no existe, mostrar solo `required_monthly_contribution`

---

## 13.5 Regla de completitud
Una meta puede marcarse `completed` de dos formas:
- automática si `current_amount >= target_amount`
- manual por acción del usuario

### Recomendación v1
Persistir `status`, pero:
- sugerir completar automáticamente cuando llegue al target
- dejar override manual

---

## 13.6 Pausa
Si una meta se pausa:
- no se borra
- no se considera “atrasada” visualmente de forma agresiva
- se oculta del resumen principal o pasa a una subsección `Pausadas`

---

## 14. Política de moneda

## Regla v1
Cada meta tiene **una sola moneda**.

Ejemplos:
- fondo de emergencia ARS
- viaje USD

## No hacer en v1
- sumar aportes ARS a una meta USD
- usar tipo de cambio automático
- mostrar “progreso consolidado” entre monedas

## Implicancia fuerte
El usuario puede tener:
- meta en ARS
- meta en USD

pero cada una progresa por separado.

---

## 15. Diseño API

## 15.1 GET `/api/goals`
Devuelve:
- metas activas/pausadas/completadas
- resumen derivado por meta

### Response sugerida
```json
{
  "goals": [
    {
      "id": "uuid",
      "name": "Fondo de emergencia",
      "emoji": "🛟",
      "currency": "USD",
      "targetAmount": 3000,
      "startingAmount": 500,
      "currentAmount": 1450,
      "remainingAmount": 1550,
      "progressPct": 0.4833,
      "targetDate": "2026-12-31",
      "plannedMonthlyContribution": 250,
      "requiredMonthlyContribution": 258.33,
      "status": "active",
      "paceStatus": "behind"
    }
  ]
}
```

---

## 15.2 POST `/api/goals`
Crea meta.

### Request sugerida
```json
{
  "name": "Viaje a Japón",
  "emoji": "✈️",
  "colorToken": "violet",
  "currency": "USD",
  "targetAmount": 3000,
  "startingAmount": 0,
  "targetDate": "2026-12-31",
  "plannedMonthlyContribution": 250,
  "linkedAccountId": "uuid-opcional",
  "notes": "Pasajes + estadía"
}
```

---

## 15.3 PATCH `/api/goals/:id`
Edita:
- nombre
- emoji
- color
- target amount
- target date
- planned monthly contribution
- linked account
- notes
- status

---

## 15.4 GET `/api/goals/:id`
Devuelve detalle completo:
- goal base
- resumen calculado
- contributions
- referencias a transferencia/ingreso si aplica

---

## 15.5 POST `/api/goals/:id/contributions`
Crea aporte.

### Aporte manual
```json
{
  "amount": 300,
  "currency": "USD",
  "contributedAt": "2026-05-23",
  "sourceType": "manual",
  "note": "Separé parte del aguinaldo"
}
```

### Aporte vinculado a transferencia
```json
{
  "amount": 500,
  "currency": "USD",
  "contributedAt": "2026-05-23",
  "sourceType": "transfer_linked",
  "relatedTransferId": "uuid-transfer"
}
```

---

## 15.6 PATCH `/api/goals/:id/contributions/:contributionId`
Para editar aporte manual si hizo falta.

Mi recomendación:
- permitir editar solo aportes `manual`
- si es `transfer_linked`, mejor re-vincular o borrar vínculo

---

## 15.7 DELETE `/api/goals/:id/contributions/:contributionId`
Eliminar aporte.

Regla:
- si es manual, borrar directo
- si es transfer_linked, borrar solo el vínculo/contribution, no la transferencia

---

## 15.8 GET `/api/goals/summary?month=YYYY-MM`
Endpoint liviano para Analytics.
Devuelve:
- metas activas
- conteos
- monto aportado en el mes
- metas atrasadas
- metas completadas recientemente

Este endpoint sirve para no cargar `/api/goals` completo si no hace falta.

---

## 16. Integración con la arquitectura actual

## 16.1 Patrón recomendado
No inflar `analytics-data` con todo Goals.

### Mejor opción
Mantener:
- `/api/analytics-data` para lo existente

Agregar:
- `/api/goals/summary`
- `/api/goals`
- `/api/goals/:id`
- `/api/goals/:id/contributions`

### Por qué
- menos acoplamiento
- rollout más seguro
- separa lógica analítica actual de lógica de metas

---

## 16.2 Query layer
Crear:
- `lib/server/goal-queries.ts`
- `lib/goals/computeGoalMetrics.ts`
- `lib/goals/types.ts`

### `goal-queries.ts`
Responsabilidades:
- leer goals
- leer contributions
- hidratar linked accounts si aplica
- resolver transfer/income references
- devolver shape lista para API

### `computeGoalMetrics.ts`
Pure functions:
- `computeCurrentAmount`
- `computeRemainingAmount`
- `computeProgressPct`
- `computeMonthsRemaining`
- `computeRequiredMonthlyContribution`
- `computeGoalStatus`
- `computePaceStatus`

### `types.ts`
Contratos frontend/backend.

---

## 16.3 Integración con `AnalyticsDataLoader`
Hoy `AnalyticsDataLoader.tsx` fetchéa solo `/api/analytics-data?month=...`.

Recomendación:
- agregar un fetch paralelo a `/api/goals/summary?month=...`
- pasar ese payload a `AnalyticsClient`

No recomiendo meter goals enteras dentro del payload actual.

---

## 17. Diseño UI en Gota

## 17.1 Ubicación y patrón de navegación real

El patrón de navegación en `Análisis` **no usa tabs horizontales**.
Usa un modal bottom sheet (`ExploreModal`) que se abre desde el botón "Explorar" en el header.

Flujo real:
```
Overview principal
    └── tap "Explorar"
            ├── Insights     → panel full-width (insightsOpen = true)
            ├── Presupuesto  → panel full-width (controlOpen = true)
            └── Metas        → panel full-width (metasOpen = true)  ← NUEVO
```

Cada panel tiene su propio header con `← Análisis` + título, idéntico al de Insights y Presupuesto.

`AnalysisSectionTabs` existe en el codebase pero no está integrado en `AnalyticsClient` — no usar como punto de entrada de Metas.

---

## 17.2 Cambios de navegación en AnalyticsClient

Agregar estado `metasOpen` con el mismo patrón que `insightsOpen` y `controlOpen`:

```tsx
const [metasOpen, setMetasOpen] = useState(false)

function openMetas() {
  setMetasOpen(true)
  setInsightsOpen(false)
  setControlOpen(false)
}

function closeSecondaryView() {
  setInsightsOpen(false)
  setControlOpen(false)
  setMetasOpen(false)  // agregar
  handleSetDrill(null)
}
```

Render condicional:
```tsx
metasOpen ? (
  <GoalsSection
    selectedMonth={selectedMonth}
    currency={currency}
  />
) : null
```

Header de Metas (mismo patrón que Presupuesto):
```tsx
metasOpen ? (
  <div className="mb-4 flex items-center justify-between px-5 pt-5">
    <button onClick={closeSecondaryView} ...>
      ← Análisis
    </button>
    <h2 className="type-title text-text-primary">Metas</h2>
  </div>
) : null
```

---

## 17.3 Cambios en ExploreModal

Activar el ítem "Metas" (hoy disabled).

Agregar prop `onMetas: () => void`.

Cambiar subtitle:
- Actual: `"Objetivos de ahorro por categoría"` ← confunde con Budgets
- Nuevo: `"Objetivos de ahorro con progreso real"`

El ítem Metas activo sigue el mismo markup que Insights y Presupuesto.

---

## 17.4 Limpieza en BudgetsSection

`BudgetsSection` tiene al fondo:
```tsx
<SectionDivider label="Metas" />
<MetasEmptyState />
```

Estos son placeholders temporales. Cuando `GoalsSection` esté activo, se eliminan.
No reemplazarlos por nada — Metas tiene su propio panel ahora.

---

## 17.5 GoalsSection — panel principal

`GoalsSection` es un componente self-contained que:
- hace su propio `useQuery(['goals', selectedMonth])` interno
- **no recibe goals como prop desde AnalyticsClient**
- maneja sus propios sheets (create, detail, contribute)
- no infla el payload de `AnalyticsDataLoader`

Razón: Metas está detrás de un tap en "Explorar". No tiene sentido prefetchear antes de que el usuario abra el panel. Se puede revisar en Batch 4 si hay señales en Home.

---

## 17.6 Componentes nuevos

### Core
- `components/analytics/GoalsSection.tsx`
- `components/analytics/GoalRow.tsx`
- `components/analytics/GoalProgressBar.tsx`
- `components/analytics/GoalEmptyState.tsx`

### CRUD / detail
- `components/analytics/GoalCreateSheet.tsx`
- `components/analytics/GoalEditSheet.tsx`
- `components/analytics/GoalDetailSheet.tsx`
- `components/analytics/GoalContributionSheet.tsx`
- `components/analytics/GoalContributionHistory.tsx`
- `components/analytics/LinkTransferToGoalSheet.tsx`

`GoalsOverviewCard` no es necesario como componente separado en v1 — la lógica de overview vive directamente en `GoalsSection`.

---

## 17.3 Diseño de card de meta
Card compacta, mobile-first.

### Header
- emoji / color token
- nombre
- badge de estado

### Body
- progress bar
- `USD 1.450 / USD 3.000`
- `faltan USD 1.550`

### Footer
- fecha objetivo o `sin fecha`
- `necesitás USD 258/mes`
- CTA primario: `Aportar`
- CTA secundario: `Detalle`

---

## 17.4 Estados de copy

### Sin fecha
- `Te faltan USD 1.550`
- `Sin fecha objetivo`

### Con fecha y en ritmo
- `Vas en ritmo para llegar en diciembre`

### Con fecha y atrasada
- `Para llegar, tendrías que aportar USD 320/mes`

### Pausada
- `Meta pausada`

### Completada
- `Meta cumplida`

---

## 18. UX de aportes

## 18.1 Opción recomendada de v1
Tener solo dos caminos de aporte:
- `Registrar aporte`
- `Vincular transferencia`

Eso simplifica muchísimo la claridad.

## 18.2 ¿Qué transferencias son elegibles?
En v1, elegibles si:
- pertenecen al usuario
- tienen misma moneda que la meta
- no están ya vinculadas a esa meta

### Opción conservadora
No exigir que vayan a `linked_account_id`.
Solo sugerirlas primero.

### Opción un poco más estricta
Si la meta tiene `linked_account_id`, priorizar transferencias cuyo `to_account_id` sea esa cuenta.

Mi recomendación:
- **priorizar**, no exigir

---

## 18.3 ¿Qué pasa si borro una transferencia vinculada?
Riesgo real.

### Regla recomendada
Si una transferencia vinculada se elimina:
- el contribution vinculado debe invalidarse o eliminarse automáticamente
- no puede quedar una meta mostrando progreso sustentado en un movimiento inexistente

### Implementación
Hay dos caminos:
1. validación al vuelo en queries
2. cleanup reactivo al borrar transfer

Para v1 haría ambas, si podés.

---

## 19. Casos borde

## 19.1 Meta sin fecha
- mostrar progreso
- no mostrar atraso
- no required monthly contribution

## 19.2 Meta superada
- permitir `current_amount > target_amount`
- `progress_pct` cap visual en 100%
- mostrar `superaste tu meta por X`

## 19.3 Aporte manual en moneda distinta
- bloquear en v1

## 19.4 Cuenta asociada archivada
- mantener referencia histórica si existe
- avisar `Cuenta archivada`

## 19.5 Meta con target_date vencida y sin completar
- estado `behind`
- CTA `Editar meta` o `Pausar`

## 19.6 Contribution vinculada a transfer eliminada
- contribution inválida
- no computar progreso

## 19.7 Meta pausada con fecha vencida
- no tratarla como alerta crítica mientras esté pausada

## 19.8 Monto inicial editable
- si se permite editar `starting_amount`, dejar audit trail simple vía `updated_at`
- alternativa mejor: tratar cambios como `adjustment`

Mi recomendación:
- en v1 permitir editar `starting_amount` solo durante creación
- después usar `adjustment contribution`

---

## 20. Riesgos importantes

## Riesgo 1 — mentir con saldo de cuenta
Si el progreso sale del balance de una cuenta, Gota pierde credibilidad.

Mitigación:
- account link solo como referencia
- progreso solo por `goal_contributions`

## Riesgo 2 — duplicar realidad al vincular transferencias
Si una transferencia y una contribution parecen dos cosas distintas sin vínculo claro, el usuario se confunde.

Mitigación:
- contribution ligada a `related_transfer_id`
- UI explícita: `Aporte vinculado a transferencia`

## Riesgo 3 — sobrecargar Análisis
Si Metas entra con demasiadas vistas y automatismos, compite con Budgets.

Mitigación:
- cards simples
- detalle en sheet
- no meter forecast complejo en v1

## Riesgo 4 — moneda
Metas en ARS y USD pueden mezclar expectativas.

Mitigación:
- una meta, una moneda
- sin FX automático v1

## Riesgo 5 — acoplamiento técnico innecesario
Si goals entra adentro de `analytics-data`, se vuelve más frágil todo el módulo.

Mitigación:
- endpoints específicos
- query layer separada

---

## 21. Fases de implementación

## Batch 1 — Foundation (DB + API + lógica)
Objetivo: tener el modelo de datos y la API funcionando antes de tocar UI.

Entregables:
- migración SQL: tabla `goals` + tabla `goal_contributions`
- actualizar `types/database.ts`
- `lib/goals/types.ts`
- `lib/goals/computeGoalMetrics.ts` (funciones puras, testeables)
- `lib/server/goal-queries.ts`
- `GET /api/goals`
- `POST /api/goals`
- `PATCH /api/goals/:id`
- `GET /api/goals/:id`
- `POST /api/goals/:id/contributions`

No entra:
- UI de ningún tipo
- summary endpoint
- income linked
- cleanup reactivo de transferencias

---

## Batch 2 — UI base
Objetivo: que Metas sea navegable y usable para el flujo happy path (crear + ver + aportar).

Entregables de navegación:
- `ExploreModal`: activar ítem Metas, agregar prop `onMetas`, corregir subtitle
- `AnalyticsClient`: agregar `metasOpen` state, `openMetas()`, header de Metas, render condicional de `GoalsSection`
- `BudgetsSection`: eliminar `<SectionDivider label="Metas" />` + `<MetasEmptyState />`

Entregables de componentes:
- `GoalEmptyState.tsx` — con copy exacto de sección 11.1
- `GoalProgressBar.tsx`
- `GoalRow.tsx` — card compacta con todos los campos de sección 17.3
- `GoalsSection.tsx` — panel con `useQuery` interno, renderiza lista o empty state
- `GoalCreateSheet.tsx`
- `GoalDetailSheet.tsx` (sin historial de aportes todavía)
- `GoalContributionSheet.tsx` — aporte manual únicamente

No entra:
- transfer-linked contributions
- historial de aportes completo
- edit/delete de contributions
- subsecciones Pausadas / Completadas

---

## Batch 3 — Operabilidad
Entregables:
- `LinkTransferToGoalSheet.tsx`
- `GoalContributionHistory.tsx`
- `GoalEditSheet.tsx`
- `DELETE /api/goals/:id/contributions/:contributionId`
- `PATCH /api/goals/:id/contributions/:contributionId` (solo manual)
- cleanup al borrar transferencia vinculada (`app/api/transfers/[id]/route.ts`)
- subsecciones Pausadas / Completadas dentro de `GoalsSection`
- pace status refinado

---

## Batch 4 — Señales Home (post-v1)
- `GET /api/goals/summary?month=YYYY-MM`
- fetch paralelo en `AnalyticsDataLoader` (Opción B del spec)
- widget/señal en Home
- `income_linked` contributions
- alertas suaves de metas atrasadas

---

## Fase v2 — extensiones futuras
- reglas de ahorro automático
- sugerencias basadas en cash flow
- metas vinculadas a instrumentos
- FX explícito entre monedas
- escenarios what-if

---

## 22. Archivos a crear / tocar

## Crear
- `lib/server/goal-queries.ts`
- `lib/goals/computeGoalMetrics.ts`
- `lib/goals/types.ts`
- `app/api/goals/route.ts`
- `app/api/goals/[id]/route.ts`
- `app/api/goals/[id]/contributions/route.ts`
- `app/api/goals/[id]/contributions/[contributionId]/route.ts`
- `app/api/goals/summary/route.ts`
- `components/analytics/GoalsSection.tsx`
- `components/analytics/GoalsOverviewCard.tsx`
- `components/analytics/GoalRow.tsx`
- `components/analytics/GoalProgressBar.tsx`
- `components/analytics/GoalEmptyState.tsx`
- `components/analytics/GoalCreateSheet.tsx`
- `components/analytics/GoalEditSheet.tsx`
- `components/analytics/GoalDetailSheet.tsx`
- `components/analytics/GoalContributionSheet.tsx`
- `components/analytics/GoalContributionHistory.tsx`
- `components/analytics/LinkTransferToGoalSheet.tsx`

## Modificar
- `types/database.ts`
- `components/analytics/AnalyticsDataLoader.tsx`
- `components/analytics/AnalyticsClient.tsx`
- `components/analytics/AnalysisView.tsx`
- `components/movimientos/MovimientosClient.tsx` si querés deep links hacia aportes vinculados
- `app/api/transfers/[id]/route.ts` para cleanup o validación cruzada si borrás transfer ligada
- SQL/migration file nuevo donde estés registrando schema changes

---

## 23. Acceptance criteria

## Producto
- el usuario puede crear una meta
- puede ver progreso y restante
- puede registrar aportes manuales
- puede vincular una transferencia existente
- puede ver required monthly contribution si la meta tiene fecha
- puede pausar / completar / archivar

## Financiero
- la meta no modifica saldo vivo
- la meta no modifica disponible real
- la meta no crea movimientos contables por sí sola
- el progreso sale de aportes explícitos

## Técnico
- goals soporta ARS y USD por separado
- no mezcla monedas dentro de una meta
- borrar una transferencia vinculada no deja progreso fantasma
- goals no rompe Analytics si el usuario no tiene ninguna meta

---

## 24. Testing recomendado

## Unit — `computeGoalMetrics.ts`
- progress pct
- remaining amount
- months remaining
- required monthly contribution
- pace status
- completed status
- paused status

## Integration — APIs
- create goal
- patch goal
- add manual contribution
- add transfer-linked contribution
- reject contribution in different currency
- get detail with contribution history

## UI
- empty state
- active goals state
- no-date goal state
- behind goal state
- paused goal state
- contribution sheet
- transfer link flow

---

## 25. Mi recomendación concreta de corte v1

Si querés el mejor equilibrio entre valor y riesgo:

### Primer batch
- `goals`
- `goal_contributions`
- create goal
- edit goal
- manual contributions
- `GoalsSection` en Análisis
- progress + remaining + target date + required monthly contribution

### Segundo batch
- transfer-linked contributions
- contribution history
- pause/complete/archive UX
- summary endpoint

### Tercer batch
- Home summary signal
- income-linked contributions
- alertas suaves

---

## 26. Mi postura final

La mejor versión de Metas para Gota **no es una cuenta espejo ni una reserva automática**.

Es una capa de dirección con tres virtudes:
- clara para el usuario
- coherente con la verdad financiera
- implementable con el stack y patrones actuales

## Decisión fuerte
Si tengo que elegir una sola regla para proteger el producto, es esta:

**En Gota, una meta progresa solo por aportes explícitos.**

Todo lo demás puede evolucionar después.

---

## 27. Próximo paso sugerido

Después de revisar este spec, el paso correcto ya no es seguir discutiendo concepto.

Es uno de estos dos:
1. bajar esto a **plan de implementación por batches/PRs**
2. o consolidar **Budgets + Metas + Home signals** en una secuencia única de roadmap

---

## 28. Estado real del código hoy

### 28.1 Lo que ya existe y conviene respetar
- `Análisis` ya existe como pantalla propia en `app/(dashboard)/analytics/page.tsx`
- La pantalla actual se compone con `AnalyticsDataLoader` + `AnalyticsClient`
- El patrón de navegación real **no usa tabs horizontales** — usa un modal bottom sheet llamado `ExploreModal` que se abre desde el botón "Explorar" en el header
- Cada sección del `ExploreModal` abre un panel full-width que reemplaza el overview principal: `insightsOpen` (Insights) y `controlOpen` (Presupuesto)
- `AnalyticsDataLoader` ya tiene dos fetches paralelos: `analytics-data` y `budgets/current`
- `BudgetsSection` ya existe como panel completo que se renderiza cuando `controlOpen = true`
- `DashboardShell` ya prefetchéa `analytics` y ya invalida `analytics` cuando cambia el estado del dashboard
- El stack de API actual usa `createClient()` de Supabase SSR, auth por cookie, y ownership check por `user_id`
- Los endpoints mutables existentes usan el patrón `auth -> parse body -> validar -> update/delete -> response`

### 28.2 Componentes ya creados pero pendientes de activación
- `AnalysisSectionTabs.tsx` existe con valores `resumen | control` pero **no está integrado en `AnalyticsClient`** — es un componente huérfano por ahora
- `ExploreModal` ya tiene el ítem "Metas" pero está **disabled** (opacidad 40%, sin onClick, badge "Próximamente")
- `BudgetsSection` ya incluye al fondo un `<SectionDivider label="Metas" />` + `<MetasEmptyState />` como placeholder temporal
- `MetasEmptyState.tsx` existe pero es solo un estado vacío sin funcionalidad

### 28.3 Lo que todavía no existe
- No existe `goals` en `types/database.ts`
- No existen rutas `app/api/goals/*`
- No existen queries de dominio para metas en `lib/server/`
- No existe UI de metas dentro de `components/analytics/`
- No existe carpeta `supabase/` con migraciones versionadas en el repo

### 28.3 Riesgo de implementación real
- Si Metas entra inflando `analytics-data`, se acopla al módulo más sensible del producto
- Si el progreso de una meta se calcula por saldo de cuenta, Gota pierde confianza contable
- Si no se define cleanup al borrar una transferencia vinculada, queda progreso fantasma
- Si no se separa bien moneda y aporte, se mezclan expectativas entre ARS y USD

---

## 29. Contrato de implementación para Metas v1

### 29.1 Arquitectura recomendada
Mantener Metas como módulo separado, pero renderizado dentro de `Análisis`.

Separación mínima:
- `lib/server/goal-queries.ts` → lectura e hidratación de datos
- `lib/goals/computeGoalMetrics.ts` → lógica pura de cálculo
- `lib/goals/types.ts` → contratos compartidos
- `app/api/goals/*` → mutaciones y lectura
- `components/analytics/*` → UI

No mezclar esto dentro de `analytics-data` salvo un summary liviano.

### 29.2 Query keys y cache
Si Metas se implementa en Analytics, los keys deberían seguir el patrón actual de React Query:
- `['analytics', selectedMonth]` para la pantalla base
- `['goals', selectedMonth]` para la lista/detalle
- `['goals-summary', selectedMonth]` si hace falta un resumen liviano

Después de crear/editar/eliminar una meta o aporte:
- invalidar `goals`
- invalidar `goals-summary` si existe
- invalidar `analytics` si la sección de Metas vive dentro de Analytics y su payload depende del resumen

### 29.3 Validación y seguridad
Reusar el estilo actual del repo:
- validar payloads con `zod`
- no confiar en el cliente para `user_id`
- tomar `user.id` desde Supabase Auth
- usar `eq('user_id', user.id)` en todas las queries mutables
- devolver errores explícitos y consistentes

### 29.4 Modelo funcional cerrado para v1
- una meta tiene una sola moneda
- una meta progresa solo por aportes explícitos
- `linked_account_id` es contexto, no fuente de verdad
- `starting_amount` es parte del progreso inicial, no saldo automático
- `planned_monthly_contribution` conviene persistirlo porque es útil para comparar intención vs realidad
- `status` debe ser derivado + persistido cuando haga falta UX, pero nunca reemplazar la verdad del cálculo

### 29.5 Semántica de aportes
Tipos de aporte permitidos en v1:
- `manual`
- `transfer_linked`
- `income_linked` solo si el costo de backend es razonable y no complica el primer release
- `adjustment` para correcciones controladas

Reglas:
- aporte siempre en la misma moneda que la meta
- si viene de transferencia, guardar `related_transfer_id`
- si se borra la transferencia, el aporte queda inválido o se elimina
- si se edita un aporte vinculado, preferir re-vincular o borrar el vínculo antes que mutar silenciosamente la realidad

### 29.6 Estados de negocio
Estados que el frontend debe soportar:
- `active`
- `paused`
- `completed`
- `archived`

Estados derivados de ritmo:
- `on_track`
- `behind`
- `no_date`
- `completed`

La UI no debería confundir `status` con `paceStatus`.

### 29.7 Telemetría sugerida
Si el producto va a medir adopción, agregar eventos nuevos en `lib/product-analytics/events.ts`.
Ejemplos útiles:
- `goal_created`
- `goal_edited`
- `goal_paused`
- `goal_completed`
- `goal_contribution_added`
- `goal_transfer_linked`

Cuidado: el sistema de analytics ya filtra claves sensibles, así que no mandar montos ni texto libre innecesario en properties.

---

## 30. Handoff a desarrollo — checklist operativo

### 30.1 Base de datos
- crear migración SQL para `goals`
- crear migración SQL para `goal_contributions`
- agregar `updated_at` trigger si el patrón del repo lo usa para tablas nuevas
- definir constraints de moneda, estado y montos
- definir índices por `user_id`, `status`, `target_date`
- definir RLS para lectura/escritura solo del dueño

### 30.2 Tipos
- actualizar `types/database.ts`
- regenerar o mantener tipado alineado con la DB real
- agregar tipos compartidos de dominio en `lib/goals/types.ts`

### 30.3 Backend
- crear `app/api/goals/route.ts`
- crear `app/api/goals/[id]/route.ts`
- crear `app/api/goals/[id]/contributions/route.ts`
- crear `app/api/goals/[id]/contributions/[contributionId]/route.ts`
- crear `app/api/goals/summary/route.ts` si el resumen se separa
- usar `zod` para validar cada body
- mantener ownership checks en todas las mutaciones

### 30.4 Frontend
- crear `GoalsSection` dentro de `components/analytics/` con fetch interno (`useQuery`)
- crear `GoalEmptyState`, `GoalRow`, `GoalProgressBar` y sheets
- integrar `GoalsSection` como panel condicional en `AnalyticsClient` (cuando `metasOpen = true`), **no** dentro de `AnalysisView`
- activar ítem Metas en `ExploreModal` y agregar prop `onMetas`
- agregar estado `metasOpen` + `openMetas()` + header de Metas en `AnalyticsClient`
- eliminar `<SectionDivider label="Metas" />` + `<MetasEmptyState />` de `BudgetsSection`
- no romper la lectura principal del overview actual
- mantener el detalle de meta en sheet, no en pantalla pesada nueva

### 30.5 UX de handoff
- el usuario entiende que una meta no aparta dinero automáticamente
- el aporte manual es el camino más claro de v1
- la transferencia vinculada aparece como evidencia, no como duplicado
- `Análisis` sigue siendo la pantalla madre

### 30.6 QA mínimo antes de entregar
- crear meta con y sin fecha
- aportar manualmente
- vincular transferencia existente
- editar meta
- pausar / reactivar / completar / archivar
- borrar transferencia vinculada y verificar que no quede progreso fantasma
- verificar que una meta en ARS no acepte aporte USD
- verificar que la pantalla de análisis siga funcionando si el usuario no tiene metas

### 30.7 Rollout seguro
- primer release: metas + aportes manuales + progreso
- segundo release: transfer-linked contributions
- tercer release: resumen liviano y señales hacia Home

---

## 31. Decisiones cerradas y decisiones abiertas

### Cerradas
- Metas vive en `Análisis`
- el progreso sale solo de aportes explícitos
- una meta no modifica `Saldo Vivo` ni `Disponible Real`
- una meta no es una subcuenta real
- una meta no mezcla monedas en v1
- no hay forecast sofisticado en v1
- `planned_monthly_contribution` se persiste en `goals`: **sí**
- `transfer_linked` cleanup al borrar transfer: **sí**
- el patrón de navegación es `ExploreModal → panel full-width` (no tabs): **confirmado por código real**
- `GoalsSection` hace su propio fetch interno (no depende de `AnalyticsDataLoader`): **sí para Batches 1-3**
- `MetasEmptyState` + `SectionDivider` en `BudgetsSection` se eliminan en Batch 2: **sí**
- `AnalysisSectionTabs` no se usa como entrada de Metas: **confirmado**

### Abiertas
- si `income_linked` entra en Batch 3 o en v2
- si el resumen de Metas merece endpoint propio desde el día 1 o solo en Batch 4
- si `planned_monthly_contribution` se muestra siempre o solo cuando hay fecha

---

## 32. Ajustes post-revisión de código (2026-05-23)

Esta sección documenta las diferencias entre el spec original y la arquitectura real encontrada al leer el código.

### 32.1 El patrón de navegación real no usa tabs

El spec original describía la estructura de Análisis como:
> `Resumen | Budgets | Metas | Insights`

El código real usa un patrón distinto:
- botón "Explorar" en el header abre `ExploreModal` (bottom sheet)
- cada ítem del modal abre un panel full-width que reemplaza el overview
- los estados son booleanos excluyentes: `insightsOpen`, `controlOpen`

Consecuencia: Metas no necesita un tab. Necesita:
1. un ítem activo en `ExploreModal` con prop `onMetas`
2. un estado `metasOpen` en `AnalyticsClient`
3. un header de Metas con `← Análisis`
4. render condicional de `GoalsSection`

### 32.2 GoalsSection es self-contained

La spec original sugería pasar goals desde `AnalyticsDataLoader`. En la arquitectura real, `BudgetsSection` (el componente análogo) recibe datos desde `AnalyticsClient` que los recibe del loader.

Sin embargo, para Metas conviene que `GoalsSection` haga su propio `useQuery` porque:
- Metas está detrás de dos taps (Explorar → Metas)
- prefetchear antes de ese click es gasto innecesario
- desacopla el módulo completamente de `analytics-data`

Cuando haya señales en Home (Batch 4), se puede agregar un fetch liviano a `/api/goals/summary` en `AnalyticsDataLoader`.

### 32.3 BudgetsSection ya tiene placeholders de Metas

`BudgetsSection` ya incluye:
```tsx
<SectionDivider label="Metas" />
<MetasEmptyState />
```

Estos se eliminan en Batch 2 al activar el panel propio de Metas. No representan funcionalidad — son solo marcadores visuales.

### 32.4 ExploreModal — copy a corregir

El ítem Metas en `ExploreModal` tiene actualmente:
- subtitle: `"Objetivos de ahorro por categoría"` ← confunde con Budgets (que también habla de categorías)
- estado: disabled (opacity 40%, sin onClick)

Cambios en Batch 2:
- subtitle: `"Objetivos de ahorro con progreso real"`
- activar con `onClick={() => { onClose(); onMetas() }}`
- quitar opacity y badge "Próximamente"

### 32.5 Archivos a modificar vs crear — delta real

**Modificar** (además de lo listado en sección 22):
- `components/analytics/ExploreModal.tsx` — activar Metas, agregar `onMetas` prop
- `components/analytics/AnalyticsClient.tsx` — agregar `metasOpen`, `openMetas`, render de `GoalsSection`
- `components/analytics/BudgetsSection.tsx` — eliminar placeholder de Metas

**No modificar** (contrariamente a lo sugerido en sección 22):
- `components/analytics/AnalysisView.tsx` — Metas no vive en AnalysisView, vive en AnalyticsClient como panel paralelo
- `components/analytics/AnalysisSectionTabs.tsx` — no se toca, no es el patrón de navegación elegido
