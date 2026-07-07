# Gota Intelligence Layer — Arquitectura final (2026-07-07)

> Plan de implementación para la capa de inteligencia financiera: héroes inteligentes + assistant v2.
> Piloto en el hero de Análisis mobile. Arquitectura transversal en `lib/intelligence/*`.

## 1. Diagnóstico del estado actual

### Assistant (chat)
- `app/api/assistant/route.ts`: auth + rate limit (8/min), arma un contexto plano de texto y llama Gemini 2.5 Flash Lite (temp 0.2, 450 tokens).
- `lib/assistant/context.ts`: vuelca TODO en texto (estado, presupuesto, 6 meses de agregados, tendencia) y decide con keywords (`shouldIncludeDetail`) si agrega hasta 25 movimientos filtrados por tokens de la pregunta.
- Problemas: el modelo recibe lo mismo para casi cualquier pregunta; no hay intención ni evidencia trazable; los movimientos entran por matching débil de keywords; la respuesta no expone en qué se basó.

### Héroes / editorial
- `lib/heroEngine/` (threads + templates + cache en localStorage) es **legacy**: `buildHeroOutput` no se importa desde ningún código vivo. `TitularHero`/`InsightChips` tampoco.
- El hero vivo de Análisis es `resolveAnalyticsHero` (`lib/analytics/analytics-overview.ts`): determinístico, correcto en la regla same-day, pero mide una sola dimensión (gasto observado vs promedio) y no mira presupuesto, tarjetas, liquidez ni movimientos atípicos.

### Datos ya disponibles (reutilizables sin tocar core finance)
- `readDashboardData`: Saldo Vivo / Disponible Real por moneda, saldos por cuenta, compromisos por moneda (`computeCompromisos` con dueDate/daysUntilDue/remaining), suscripciones, metas, instrumentos.
- `getBudgetSnapshot`: `BudgetItemMetrics` ya trae `usedPct`, `expectedPct`, `paceDelta`, `status` — la aceleración de presupuesto ya está semi-calculada.
- `buildMonthlySeries` (duplicada en `app/api/analytics-data/route.ts` y `lib/assistant/context.ts`): serie mensual percibido/percibido+devengado con corte same-day. **Se extrae a módulo compartido.**

## 2. Decisión de arquitectura

```
Supabase (raw finance data)
   │  (queries existentes: readDashboardData, getBudgetSnapshot, expenses/income 6m)
   ▼
lib/intelligence/snapshot.ts        loadFinancialSnapshot (IO) → assembleFinancialSnapshot (pura)
   ▼
FinancialSnapshot                   normalizado, serializable, por usuario/mes/moneda base
   ▼
lib/intelligence/features.ts        features puras y testeables (same-day delta, budget pace,
   │                                card dues, liquidez, movimientos atípicos)
   ▼
lib/intelligence/insight-rules.ts   reglas → InsightCandidate[] con evidencia + ranking
   │
   ├──► app/api/intelligence/heroes  JSON estructurado → IntelligenceHero (UI piloto Análisis mobile)
   │        (copy determinístico en TS; editorial LLM opcional detrás de flag, con fallback)
   │
   └──► chat: lib/intelligence/chat-planner.ts (intent + query plan)
             lib/intelligence/chat-evidence.ts (AnswerPacket: facts + evidence + caveats + followUps)
             lib/intelligence/chat-prompt.ts   (instrucción anti-alucinación)
             app/api/assistant (Gemini redacta; la evidencia la calcula el código)
```

Principios:
- **Deterministic before generative**: todo número, ranking, umbral y ventana temporal se calcula en TS puro con tests. El LLM solo redacta (chat) o pule copy (héroes, opcional y con fallback).
- **IO separado de lógica**: `loadFinancialSnapshot` hace queries; `assembleFinancialSnapshot` y todo lo que sigue es puro → fixtures triviales en tests.
- **Una sola fuente de inteligencia**: héroes y chat consumen el mismo snapshot y las mismas reglas (`what_should_i_do` en el chat devuelve literalmente los insight candidates).
- **Monedas nunca se mezclan**: las reglas operan en la moneda base del usuario; los importes de otra moneda solo aparecen como evidencia separada y etiquetada.
- **Observed vs committed**: same-day usa la misma clasificación que Análisis (percibido + devengado del ciclo, por fecha del gasto ≤ día comparable). Cuotas de meses futuros quedan fuera por construcción (fecha fuera del mes) — hay test que lo fija.

### Alternativas descartadas
- **Extender `lib/heroEngine/`**: es client-side (localStorage), template-thread oriented, y está muerto en código vivo. La nueva capa necesita ser server-side y compartida con el chat.
- **Function calling / tool use del LLM contra queries**: más flexible pero no auditable, cada respuesta costaría N round-trips a Gemini Flash Lite (latencia y costo), y viola "trust first" (el modelo decidiría qué contabilidad hacer). El planner determinístico cubre las intenciones reales del producto; si un intent no matchea, se responde con el paquete general + caveat.
- **Persistir insights en DB desde el día 1**: el pilot no necesita dedupe cross-device ni feedback todavía. `dedupeKey` + `validUntil` quedan en el contrato para agregar una tabla `insight_events` después sin romper nada. Cero migraciones en esta fase.
- **Streaming/JSON mode de Gemini para el chat**: la respuesta estructurada (evidence, followUps) se construye server-side de forma determinística; pedirle JSON al modelo solo agrega un modo de fallo nuevo. El modelo devuelve texto plano.

## 3. Respuestas a las research questions

1. **Primeros héroes**: los 5 del MVP (abajo) cubren riesgo (liquidez, vencimiento tarjeta), cambio (same-day delta, presupuesto acelerado) y anomalía (movimiento atípico). Rendimientos, metas y suscripciones quedan como evidencia dentro de esos héroes (p.ej. suscripciones pendientes dentro de liquidity_watch) hasta validar tono.
2. **Evidencia mínima por insight**: cada regla define requisitos duros (tabla en §4); si no se cumplen, la regla no emite (no hay "insight sin evidencia").
3. **Queries reutilizadas**: `readDashboardData`, `getBudgetSnapshot`, expenses/income 6 meses (mismas queries que el assistant actual), `computeCompromisos` vía dashboard. **Dato faltante**: ninguno bloqueante para el MVP; a futuro, tabla de eventos de insight para cooldowns cross-device.
4. **Compartir inteligencia sin duplicar**: snapshot + features + rules son módulos puros importados por ambos endpoints; el chat expone las rules como respuesta de `what_should_i_do` y los héroes generan la pregunta prearmada que abre el chat.
5. **Persistir vs on-demand**: todo on-demand en el MVP. El costo de queries es equivalente a un load del dashboard (que ya se hace por render). Persistencia diferida: `insight_events` (dismissals, cooldown, feedback) cuando el piloto valide utilidad.
6. **Freshness/costo**: héroes = 0 llamadas LLM (copy determinístico). Cache client-side con react-query (staleTime 5 min) + `generatedAt` en la respuesta. Rate limit 20/min por usuario en heroes, 8/min se mantiene en assistant. Editorial LLM (si se activa por flag) solo pule el hero primario.
7. **Evaluar calidad del chat**: tests de intent (las 7 preguntas de aceptación → intent esperado), tests de AnswerPacket sobre fixtures (los facts correctos entran al paquete, los caveats aparecen cuando faltan datos), y el prompt afirma que solo puede citar el paquete. La redacción del LLM no se testea; el contenido que puede citar, sí.

## 4. Reglas MVP — fórmulas, evidencia y umbrales

Moneda: todas las reglas operan en `snapshot.currency` (moneda base del usuario).
`elapsedRatio = dayOfMonth / daysInMonth`.

| Regla | Condición de emisión | Severidad | Evidencia mínima requerida |
|---|---|---|---|
| `budget_acceleration` | Plan activo; ítem con `amount > 0`, `spentAmount ≥ 25%` del presupuesto del ítem y `usedPct ≥ expectedPct + 20` (pace ratio ≥ ~1.25). Risk si `usedPct ≥ 100` y quedan ≥ 3 días. | watch / risk | plan activo + ítem con gasto real (`spentAmount > 0`) |
| `same_day_spend_delta` | `availableCompletedMonths ≥ 1` con dato same-day > 0; baseline = promedio same-day de hasta 6 meses completos (≥3 meses) o mes anterior (1–2 meses); `|delta| ≥ 15%`. Positive si delta ≤ −15%. Watch si ≥ +15%, risk si ≥ +35%. | positive / watch / risk | baseline > 0 y gasto actual > 0; requiere `comparisonDay` |
| `upcoming_card_due` | Ciclo `cerrado`/`vencido` con `remaining > 0` y `daysUntilDue ≤ 7` (o vencido). Risk si vencido o ≤ 3 días. | watch / risk | dueDate real + monto restante > 0 |
| `liquidity_watch` | `disponibleReal < upcoming14d` donde `upcoming14d = Σ resúmenes con due ≤ 14 días + Σ suscripciones con débito en ≤ 14 días`. Solo si `upcoming14d > 0`. | risk | disponible calculable + al menos 1 compromiso fechado |
| `recent_unusual_movement` | Gasto en últimos 7 días con `amount ≥ 3 × ticket promedio` de su categoría en meses previos (≥ 5 transacciones históricas en la categoría) y `amount ≥ 5%` del ingreso del mes (si hay ingreso; sin ingreso, ≥ 8% del gasto total del mes). | info / watch | historial suficiente de la categoría (≥5 tx) |

Ranking: `score = severityWeight (risk 400, watch 300, positive 200, info 100) + urgencyBoost (vencimientos más cercanos y overshoots más grandes suman) `. Orden estable por score desc, luego `kind`. Hero primario = top 1; secundarios = siguientes ≤ 3.

Fallbacks sin datos:
- Sin histórico (mes 1): no se emiten same_day ni unusual; si no hay nada, el endpoint devuelve `heroes: []` y la UI muestra estado neutro honesto ("Todavía estoy armando tu línea base").
- Sin presupuesto: budget_acceleration no emite; el chat responde a "¿dónde estoy pasado?" con caveat "no tenés presupuesto activo".

## 5. Chat v2

Intents (detección determinística por keywords normalizados, con prioridad por especificidad):
`balance_status`, `movement_lookup`, `category_breakdown`, `trend_comparison`, `budget_question`, `card_commitments`, `subscription_question`, `yield_question`, `goal_question`, `what_should_i_do`, `general` (fallback: paquete resumen completo, equivalente seguro del contexto actual).

Query plan por intent: qué secciones del snapshot entran al paquete (siempre compactas) y si se buscan movimientos (filtros: tokens de la pregunta, "grandes" → top por monto, ventana temporal detectada: hoy/ayer/semana/mes/mes pasado).

`AnswerPacket = { intent, facts: EvidenceItem[], movements?: MovementEvidence[], caveats: string[], followUps: string[], insights?: InsightCandidate[] }`

El route serializa el paquete a texto etiquetado, Gemini redacta la respuesta (temp 0.2), y la API devuelve `{ answer, evidence, followUps, detailIncluded, intent }` — compatible con el `GotaAssistant` actual (`answer`/`detailIncluded`) y con campos nuevos opcionales para la UI v2.

## 6. Archivos

### Nuevos
- `docs/plans/2026-07-07-gota-intelligence-architecture.md` (este doc)
- `lib/analytics/monthly-series.ts` — extracción de `buildMonthlySeries` (hoy duplicada)
- `lib/intelligence/types.ts`
- `lib/intelligence/snapshot.ts`
- `lib/intelligence/features.ts`
- `lib/intelligence/evidence.ts`
- `lib/intelligence/insight-rules.ts`
- `lib/intelligence/heroes.ts`
- `lib/intelligence/chat-planner.ts`
- `lib/intelligence/chat-evidence.ts`
- `lib/intelligence/chat-prompt.ts`
- `lib/intelligence/__tests__/fixtures.ts`
- `lib/intelligence/__tests__/features.test.ts`
- `lib/intelligence/__tests__/insight-rules.test.ts`
- `lib/intelligence/__tests__/heroes.test.ts`
- `lib/intelligence/__tests__/chat-planner.test.ts`
- `lib/intelligence/__tests__/chat-evidence.test.ts`
- `app/api/intelligence/heroes/route.ts`
- `components/intelligence/IntelligenceHero.tsx`

### Modificados
- `app/api/analytics-data/route.ts` — importa `buildMonthlySeries` compartido (sin cambio de comportamiento)
- `components/analytics/AnalyticsClient.tsx` — monta `IntelligenceHero` (surface `analysis-mobile`) al tope de la white zone
- `app/api/assistant/route.ts` — migra a planner + paquete de evidencia (mantiene auth, rate limit, contrato)
- `components/assistant/GotaAssistant.tsx` — chips de follow-up, bloque "Basado en", apertura por evento con pregunta prearmada, sugerencias dinámicas
- `lib/flags.ts` — `FF_INTELLIGENCE` (default on) y `FF_INTELLIGENCE_EDITORIAL` (default off)

### Eliminados (tras migración)
- `lib/assistant/context.ts` — reemplazado por snapshot + planner (`lib/assistant/prompt.ts` se conserva: history helpers siguen en uso)

`lib/heroEngine/` no se toca (legacy, fuera de alcance).

## 7. Fases y commits

1. `feat(intelligence): plan + shared monthly series` — plan doc + extracción `monthly-series.ts`
2. `feat(intelligence): deterministic core (snapshot, features, rules) + tests`
3. `feat(intelligence): heroes API + Analysis mobile pilot hero`
4. `feat(assistant): v2 backend con intent planner y evidencia`
5. `feat(assistant): UI v2 (follow-ups, evidencia, deep link desde hero)`

## 8. Criterios de aceptación

- `npm run lint`, `npm run test`, `npm run build` pasan (o blockers preexistentes documentados con evidencia).
- Tests cubren: ranking por prioridad; no-emisión sin evidencia; same-day sin contaminación de cuotas futuras; no mezcla ARS/USD; fallback sin histórico; mapeo de las 7 preguntas de aceptación a intents con facts correctos en el paquete.
- `/api/intelligence/heroes` devuelve `IntelligenceHeroResponse` estable (JSON estructurado, evidencia con label/value/source).
- El chat responde con evidencia las 7 preguntas de aceptación y comunica huecos de datos sin inventar.
