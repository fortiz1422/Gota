# Analysis — Functional Spec for Historical Comparison

**Fecha:** 2026-06-07  
**Estado:** aprobado para implementación  
**Área:** `Analysis > Resumen`  
**Owner:** producto / UX / analytics

---

## 1. Objetivo

Definir una regla funcional completa para cómo `Analysis` compara el mes seleccionado contra el histórico, evitando mezclar en la misma jerarquía visual comparaciones de distinta escala temporal.

La pantalla debe responder de forma consistente:

1. **¿Cómo va el mes hoy?**
2. **¿Cómo se compara con mi ritmo reciente?**
3. **Si sigue así, cómo podría cerrar?**

No todos estos niveles deben tener el mismo peso visual. La lectura principal cambia según la cantidad de meses comparables disponibles.

---

## 2. Problema actual

Hoy `Analysis` usa dos marcos temporales distintos en la misma pantalla:

- **Hero:** para mes actual y con 3+ meses comparables usa `promedio same-day` (`a esta altura`).
- **Evolution:** muestra la serie mensual y el promedio usando `meses completos`.

Esto puede producir una combinación confusa como:

- arriba: `+61% vs promedio 3m a esta altura`
- abajo: `-72% vs prom.`

Las dos cuentas pueden ser matemáticamente correctas, pero responden preguntas distintas.

---

## 3. Principio rector

### Regla madre
**Cuando el mes está abierto, la narrativa principal de Analysis debe compararse contra el mismo momento de meses anteriores.**

El cierre mensual completo queda como:
- contexto secundario,
- o futura proyección,
- pero no debe competir con la lectura principal del mes abierto.

---

## 4. Definiciones funcionales

### 4.1 Mes comparable
Un mes comparable es un mes anterior al seleccionado que:
- está cerrado,
- tiene data real,
- y puede aportar referencia válida para el modo activo (`percibido` o `percibido_devengado`).

### 4.2 Mes abierto
Es el mes actual del calendario (`selectedMonth === currentMonth`).

### 4.3 Same-day comparison
Comparación contra el acumulado de cada mes histórico al mismo día del mes actual.

Ejemplo:
- hoy es 7 de junio,
- marzo/abril/mayo se comparan usando lo acumulado al **día 7** de cada mes.

### 4.4 Full-month comparison
Comparación contra meses cerrados completos.

### 4.5 Rolling average
Promedio móvil de los últimos `N` meses comparables, donde:
- `N = min(meses comparables, 6)`
- para 3+ meses, el mínimo práctico será 3.

---

## 5. Regla de benchmark por cantidad de histórico

## Caso A — 0 meses comparables

### Condición
No existe ningún mes cerrado anterior con data real.

### Lectura principal
No se fuerza benchmark.

### Hero
- headline: primer mes / sin línea base
- subcopy: opcional y neutro

### Evolution
- sin promedio
- sin delta
- sin narrativa de tendencia

### Rationale
No hay base suficiente para comparación útil.

---

## Caso B — 1 o 2 meses comparables

### Condición
Hay 1 o 2 meses cerrados comparables.

### Lectura principal
La referencia principal es el **mes anterior**.

### Benchmark del hero
- si el mes está abierto: **mes anterior al mismo día**
- si el mes está cerrado: **mes anterior completo**

### Evolution
Se mantiene una lectura simple de comparación cercana.

### Decisión de alcance para esta iteración
**No cambiar la regla base de este tramo.**

Rationale:
- es simple,
- fue bien recibida,
- y no es el origen principal de la inconsistencia detectada.

### Nota UX
Aunque la lógica de este tramo puede mejorarse más adelante, en esta iteración no se rediseña el estado `1–2 meses` para evitar mezclar un fix de benchmark con una revisión más amplia del bloque comparativo inicial.

---

## Caso C — 3 o más meses comparables

### Condición
Hay al menos 3 meses cerrados comparables.

### Lectura principal
La referencia principal pasa a ser el **ritmo reciente** del usuario.

### Benchmark del hero
- si el mes está abierto: **rolling average same-day**
- si el mes está cerrado: **rolling average full-month**

### Benchmark de Evolution
- si el mes está abierto: **debe usar el mismo marco temporal que el hero**
- si el mes está cerrado: usa meses completos

### Regla obligatoria
En 3+ meses comparables, `Hero` y `Evolution` deben compartir el mismo `comparison_scope`:
- `same_day` para mes abierto
- `full_month` para mes cerrado

### Rationale
Cuando hay histórico suficiente, el usuario espera una lectura madura de ritmo, no una mezcla entre acumulado parcial y cierre completo.

---

## 6. Regla por bloque de UI

## 6.1 Hero

### Función
Responder:
> ¿Cómo va el mes hoy contra mi referencia principal?

### Inputs funcionales
- modo activo (`percibido` / `percibido_devengado`)
- serie histórica mensual
- mes seleccionado
- cantidad de meses comparables
- `comparisonDay` si aplica
- drivers del mes (compromisos, categoría, gasto grande, etc.)

### Output esperado
- amount principal
- benchmark label
- delta porcentual
- headline
- subcopy
- driver
- tono visual

### Reglas de headline
#### Sin benchmark
- primer mes / building state

#### Delta aproximadamente neutro
- `en línea con tu promedio` o equivalente

#### Delta moderadamente positivo
- `arriba de tu ritmo reciente`

#### Delta claramente positivo
- `más cargado de lo habitual`

#### Delta negativo
- `más liviano` / `abajo de tu promedio`

### Drivers
Los drivers explican el porqué, pero no deben cambiar el benchmark base.
Ejemplos:
- compromisos pesan mucho,
- categoría spike,
- gasto grande,
- shift hacia tarjeta.

---

## 6.2 Evolution

### Función
Responder:
> ¿Cómo se compara este mes con mi histórico reciente bajo el mismo marco temporal del hero?

### Regla central
El gráfico **no puede** mostrar un delta del punto actual calculado con una base temporal distinta a la del hero cuando hay 3+ meses comparables.

### Scope permitido
#### Mes abierto + 3+ meses comparables
- serie mostrada: valores `same-day`
- promedio mostrado: `same-day average`
- tooltip delta: contra `same-day average`
- label del promedio: debe explicitar `al día X`

#### Mes cerrado + 3+ meses comparables
- serie mostrada: meses completos
- promedio mostrado: promedio mensual reciente
- tooltip delta: contra promedio full-month

#### 1–2 meses comparables
- se mantiene la lógica simple actual

### Copy recomendado
#### Mes abierto + 3+ meses
- título: `Cómo viene evolucionando`
- subtítulo: `Comparado al mismo momento de tus últimos meses.`
- promedio: `Promedio 3m al día 7`

#### Mes cerrado + 3+ meses
- título: `Cómo viene evolucionando`
- subtítulo: `Tu promedio reciente sirve como referencia.`
- promedio: `Promedio 3m`

---

## 6.3 Proyección de cierre

### Estado del feature
**Fuera de alcance de esta implementación.**

### Motivación futura
La comparación contra meses completos sigue siendo útil, pero debe mostrarse como:
- contexto secundario,
- o proyección de cierre,
- no como delta principal del acumulado parcial.

### Posible futuro output
- `Promedio mensual reciente: $X`
- `Proyección de cierre: $Y`
- `+Z% vs promedio mensual`

### Razón para diferir
Requiere:
- definición de fórmula de proyección,
- diseño específico,
- y nueva jerarquía visual.

No corresponde mezclarlo con el fix de consistencia del benchmark principal.

---

## 7. Reglas de copy y semántica

### Reglas de benchmark label
#### Mes abierto + 3+ meses
- `promedio 3m al día X`
- `promedio 4m al día X`
- etc.

#### Mes cerrado + 3+ meses
- `promedio 3m`
- `promedio 4m`
- etc.

#### 1–2 meses
- `abril al día 7`
- `mayo`
- etc.

### Reglas de subtítulo del gráfico
#### same-day scope
- `Comparado al mismo momento de tus últimos meses.`

#### full-month scope
- `Tu promedio reciente sirve como referencia.`

### Regla de no ambigüedad
No mostrar copy abreviado tipo `-72% vs prom.` si el usuario no tiene contexto de que ese `prom.` significa una base temporal distinta al hero.

---

## 8. Reglas de datos

## 8.1 Fuente para same-day
La API ya expone para cada mes:
- `sameDayPercibidoTotal`
- `sameDayPercibidoDevengadoTotal`

Estos campos son la fuente correcta para la comparación same-day.

## 8.2 Fuente para full-month
Usar:
- `percibidoTotal`
- `percibidoDevengadoTotal`

## 8.3 Cantidad de meses del promedio
Para 3+ meses comparables:
- usar hasta 6 meses máximos
- pero nunca menos de 3 si el sistema ya entró en este tramo

---

## 9. Estados y métricas derivadas

`Evolution` debe exponer metadata suficiente para que UI y tests entiendan qué está mostrando.

### Campos funcionales requeridos
- `comparisonScope: 'same_day' | 'full_month' | 'none'`
- `comparisonDay: number | null`
- `averageLabel: string | null`
- `averageValue: number | null`
- `series[].value`

### Regla de consistencia
Si `comparisonScope === 'same_day'`:
- `averageLabel` debe mencionar `al día X`
- `subcopy` debe hablar del mismo momento del mes
- `series[].value` debe construirse con source same-day para todos los puntos relevantes

---

## 10. Alcance de implementación aprobado

## Incluye
1. Documentar esta spec en el repo.
2. Documentar el plan técnico asociado.
3. Ajustar `resolveAnalyticsEvolution` para usar `same-day` en `mes abierto + 3+ meses`.
4. Exponer metadata del scope de comparación para la UI.
5. Ajustar `AnalyticsEvolution.tsx` para reflejar el nuevo scope en labels/subcopy/tooltip.
6. Agregar tests unitarios para la nueva regla.

## No incluye
1. Rediseño visual grande de `Analysis`.
2. Nueva card o módulo de `proyección de cierre`.
3. Revisión de copy completa del hero más allá de la lógica actual existente.
4. Replanteo del estado `1–2 meses`.

---

## 11. Criterios de aceptación

La implementación queda correcta si:

1. Para mes abierto y 3+ meses comparables, `Hero` y `Evolution` usan el mismo marco temporal (`same-day`).
2. `Evolution` deja de comparar el punto actual parcial contra promedio de meses completos en ese caso.
3. La etiqueta del promedio y el subtítulo del gráfico dejan explícito que la comparación es `al día X`.
4. Los tests cubren:
   - `0 meses`
   - `1–2 meses`
   - `3+ meses` con `same-day`
   - `3+ meses` con mes cerrado/full-month
5. No se rompe la lógica actual del hero.
6. No se rompe la UI de los estados iniciales del histórico.

---

## 12. Riesgos y notas

### Riesgo 1 — histórico escaso o huecos
La lógica debe seguir ignorando meses placeholder sin data real.

### Riesgo 2 — cambio visual sutil pero importante
Aunque el layout no cambie mucho, el significado del gráfico sí cambia. Los labels y subcopy deben explicitarlo.

### Riesgo 3 — expectativas de proyección
Este cambio no agrega proyección. Solo alinea la comparación principal del mes abierto.

---

## 13. Decisión de producto final

Para `Analysis`, desde el momento en que existen **3 o más meses comparables**, la pantalla deja de priorizar `cierre mensual típico` como benchmark principal y pasa a priorizar `ritmo a esta altura del mes`.

El contexto de cierre completo sigue siendo valioso, pero queda diferido a una futura capa secundaria de proyección.
