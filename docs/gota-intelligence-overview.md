# Gota Intelligence Layer — Resumen Ejecutivo

> **Branch:** `feat/intelligence-layer` · **Fecha:** 2026-07-07 · **Estado:** implementado, verificado, sin pushear
> Plan técnico detallado: [`docs/plans/2026-07-07-gota-intelligence-architecture.md`](plans/2026-07-07-gota-intelligence-architecture.md)
> **v2 (2026-07-09):** ver sección 0 — proyección, datos nuevos y superficie en Home.

---

## 0. v2 — Qué se agregó (2026-07-09)

La v2 mantiene el principio *deterministic before generative* y extiende motor + superficies:

**Datos nuevos en el snapshot** (`lib/intelligence/snapshot.ts`):
- `is_extraordinary` en movimientos y agregados, con fallback de query si la columna no existe. Los baselines (same-day, ticket habitual) ahora **excluyen extraordinarios** — corrige señales que antes comparaban contra histórico contaminado.
- `goalsDetail`: métricas completas por meta (pace, aporte requerido, fecha objetivo) que el snapshot v1 descartaba.
- `recurringIncomes` con estado pendiente del mes.
- `futureInstallments`: cuotas ya materializadas de los próximos 6 meses (los installments se guardan como gastos con fecha futura → esto suma compromisos reales, no estima).

**Motor de proyección** (`lib/intelligence/projection.ts`):
- `computeSafeToSpend`: libre hasta fin de mes = disponible − compromisos fechados del mes − metas; ritmo diario sugerido.
- `computeInstallmentHorizon`: carga de cuotas por mes futuro vs ingreso de referencia (recurrentes o promedio histórico).
- `simulatePurchase`: "¿me alcanza X?" al contado (margen restante) o en N cuotas (carga futura por mes). El LLM solo redacta el veredicto ya calculado.

**5 reglas nuevas** (total 10): `installment_load` (mes futuro con ≥25%/40% del ingreso en cuotas), `wants_creep` (share de deseos despegado del promedio, con lado positivo), `goal_pace` (meta atrasada con aporte necesario / encaminada), `income_missing` (recurrente que no llegó, gracia 2 días), `subscription_load` (≥12%/20% del ingreso).

**Chat** (3 intents nuevos, total 14): `affordability` (extrae monto — soporta "250.000", "250 lucas", "50k", "1 palo" — y cuotas; responde con veredicto determinístico), `wants_question` (share + movimientos deseo), `installment_question` (horizonte de cuotas). Además: metas por meta en `goal_question`, safe-to-spend en `balance_status`.

**UX — la inteligencia ahora se ve**:
- `IntelligenceHero` se monta en el **Home mobile** (`DashboardShell`, mes corriente con movimientos): pulso "Ritmo del mes" ($X/día libres tras compromisos y metas) + señal primaria + chips. Silencioso si no hay nada para decir.
- `/api/intelligence/heroes` devuelve `pulse` además de `heroes`.
- Sugerencias del chat renovadas hacia las capacidades nuevas.

Tests: 141 en `lib/intelligence` (84 → 141). `npm run test`, lint y build verificados.

---

## 1. Qué es

Una capa de inteligencia financiera que convierte a Gota de "tablero que muestra números" en un producto que **lee el mes del usuario y le dice qué mirar**. Tiene dos caras visibles y un motor común:

| Pieza | Qué hace | Dónde se ve |
|---|---|---|
| **Héroes inteligentes** | Detectan señales del mes (riesgo, cambio, anomalía) con evidencia y CTA | Análisis mobile (piloto): integrados al hero azul + chips |
| **Assistant v2** | Chat que entiende la intención, busca los datos correctos y responde citando evidencia | Botón flotante del chat (toda la app mobile) |
| **Core determinístico** | Snapshot financiero + features + reglas. Todo calculado en TypeScript testeado | `lib/intelligence/*` (compartido por ambos) |

**Principio rector:** *deterministic before generative*. Todos los números, rankings, umbrales y comparaciones los calcula código testeado. El LLM (Gemini) solo redacta la respuesta del chat — nunca hace contabilidad. Los héroes ni siquiera usan LLM: su copy es determinístico, por lo que renderizarlos cuesta $0 de API.

---

## 2. Cómo funciona (pipeline)

```
Supabase (datos crudos)
   │   queries existentes reutilizadas: readDashboardData, getBudgetSnapshot,
   │   expenses/income/transfers últimos 6 meses
   ▼
FinancialSnapshot          ← lib/intelligence/snapshot.ts
   │   estado normalizado del usuario/mes: saldos, disponible, presupuesto,
   │   tarjetas, suscripciones, metas, serie mensual same-day, movimientos
   ▼
Features                   ← lib/intelligence/features.ts
   │   cálculos puros: gasto vs ritmo histórico, presupuesto acelerado,
   │   vencimientos, liquidez vs compromisos, movimientos atípicos
   ▼
InsightCandidates          ← lib/intelligence/insight-rules.ts
   │   5 reglas con evidencia, severidad, prioridad y dedupe
   │
   ├──► /api/intelligence/heroes ──► IntelligenceHero (UI Análisis mobile)
   │
   └──► /api/assistant: intent planner → AnswerPacket → Gemini redacta
```

Claves del diseño:

- **IO separado de lógica**: `loadFinancialSnapshot` hace las queries; `assembleFinancialSnapshot` y todo lo que sigue es puro → se testea con fixtures sin tocar la DB.
- **Una sola fuente de inteligencia**: héroes y chat consumen el mismo snapshot y las mismas reglas. Preguntarle al chat "¿qué debería mirar hoy?" devuelve literalmente los mismos insights que los héroes.
- **Monedas nunca se mezclan**: las reglas operan en la moneda base del usuario; los movimientos en otra moneda se informan por separado y hay caveat automático.
- **Observed vs committed**: el same-day usa la misma clasificación que Análisis (percibido + devengado por fecha ≤ día comparable). Las cuotas de meses futuros quedan fuera por construcción, con test que lo fija.

---

## 3. Las 5 reglas MVP

| Regla | Dispara cuando | Severidad |
|---|---|---|
| `upcoming_card_due` | Resumen cerrado/vencido con monto pendiente y vencimiento ≤ 7 días | risk / watch |
| `liquidity_watch` | Disponible Real < compromisos fechados de los próximos 14 días (resúmenes + suscripciones débito) | risk |
| `budget_acceleration` | Categoría con uso ≥ avance del mes + 20 puntos (y ≥ 25% del presupuesto consumido) | risk / watch |
| `same_day_spend_delta` | Gasto observado a hoy ≥ ±15% vs promedio histórico al mismo día (risk si ≥ +35%) | risk / watch / positive |
| `recent_unusual_movement` | Gasto reciente ≥ 3× el ticket habitual de su categoría (con ≥ 5 compras de historial) | watch / info |

**Regla de oro:** sin evidencia suficiente, la regla no emite. Usuario sin histórico → héroes vacíos con estado honesto ("Nada urgente por ahora"), nunca inventos.

---

## 4. Dónde vive cada cosa

### Motor (compartido, sin UI)
```
lib/intelligence/
├── types.ts           # contratos: FinancialSnapshot, InsightCandidate, EvidenceItem
├── snapshot.ts        # loadFinancialSnapshot (IO) + assembleFinancialSnapshot (puro)
├── features.ts        # cálculos: same-day, budget pace, dues, liquidez, atípicos
├── insight-rules.ts   # las 5 reglas + ranking + dedupe
├── evidence.ts        # helpers de evidencia, fechas y formato
├── heroes.ts          # buildHeroesResponse → JSON para superficies
├── chat-planner.ts    # detección de intención (11 intents) + query plan
├── chat-evidence.ts   # AnswerPacket: facts + movimientos + caveats + followUps
├── chat-prompt.ts     # instrucción anti-alucinación para Gemini
└── __tests__/         # 69 tests con fixtures (5 archivos)
```

### Endpoints
- `app/api/intelligence/heroes/route.ts` — **GET**, auth Supabase, rate limit 20/min, devuelve `IntelligenceHeroResponse` (JSON estructurado, siempre mes corriente).
- `app/api/assistant/route.ts` — **POST** (migrado a v2), auth + rate limit 8/min, responde `{ answer, detailIncluded, intent, evidence, followUps }`. Compatible con el contrato anterior.

### UI
- `lib/intelligence/analysis-surface.ts` — presentación para Análisis: una señal **risk** toma el headline del hero azul; el resto va como chips; `same_day_spend_delta` se excluye de esta superficie (el hero azul ya narra el gasto vs promedio — evita duplicar la historia).
- `components/intelligence/IntelligenceHero.tsx` — exporta `useIntelligenceHeroes` (hook compartido), `IntelligenceSignalChips` (fila de chips usada en Análisis) y la card standalone `IntelligenceHero` (reservada para Home mobile).
- `components/assistant/GotaAssistant.tsx` — chat con follow-up chips, bloque "Basado en tus datos" y sugerencias dinámicas.
- `lib/assistant/events.ts` — evento `gota:assistant-open` para abrir el chat desde cualquier superficie con pregunta prearmada.

### Soporte
- `lib/analytics/monthly-series.ts` — `buildMonthlySeries` extraído (antes duplicado en analytics-data y el assistant viejo).
- `lib/assistant/context.ts` — **eliminado** (el contexto plano fue reemplazado por el pipeline).

---

## 5. Cómo se accede

### Como usuario
1. **Héroes**: app mobile → **Análisis** (mes corriente). Si hay una señal de riesgo (resumen por vencer, liquidez, presupuesto superado), esa señal **toma el headline del hero azul** con su evidencia como subcopy; sin señales de riesgo, el hero azul cuenta su lectura habitual de gasto vs promedio. Las señales restantes aparecen como **chips deslizables** entre el hero y el toggle Percibido/Devengado, con tap a chat o deep link. Sin señales: no se agrega nada (cero ruido).
2. **Chat**: botón flotante en cualquier pantalla del dashboard mobile. El CTA de un héroe abre el chat con la pregunta ya enviada. Cada respuesta trae chips de repregunta y un desplegable con la evidencia usada.

### Flags (env vars)
| Flag | Default | Controla |
|---|---|---|
| `NEXT_PUBLIC_FF_INTELLIGENCE` | **ON** (apagar con `'false'`) | Héroes + endpoint |
| `FF_GOTA_ASSISTANT` / `NEXT_PUBLIC_FF_GOTA_ASSISTANT` | OFF (prender con `'true'`) | Chat completo (sin cambios) |

### Como developer
```bash
npm run dev                        # http://localhost:3000/analytics (viewport mobile)
npx vitest run lib/intelligence    # suite de la capa (69 tests)
curl localhost:3000/api/intelligence/heroes   # requiere sesión Supabase
```

---

## 6. Chat v2 — qué cambió por dentro

**Antes:** un solo contexto plano gigante (igual para toda pregunta) + heurística de keywords para adjuntar 25 movimientos.

**Ahora:**
1. `planChatQuery` detecta la intención — `balance_status`, `movement_lookup`, `category_breakdown`, `trend_comparison`, `budget_question`, `card_commitments`, `subscription_question`, `yield_question`, `goal_question`, `what_should_i_do`, `general` — y arma un plan: qué secciones del snapshot van al paquete, ventana temporal (hoy/ayer/semana/mes pasado), términos de búsqueda, filtro "grandes".
2. `buildAnswerPacket` construye los hechos exactos para esa intención, con caveats explícitos cuando faltan datos (sin presupuesto, sin histórico, monedas separadas).
3. Gemini recibe **solo ese paquete** con reglas duras: no inventar, no calcular, citar limitaciones. La evidencia que muestra la UI la eligió el código, no el modelo.

Las 7 preguntas de aceptación del brief tienen test que fija intent + facts correctos.

---

## 7. Verificación y estado

| Check | Resultado |
|---|---|
| `npx vitest run lib/intelligence` | ✅ 69/69 |
| `npm run test` (global) | ✅ 193 pasan · ⚠️ 4 fallas **preexistentes** en `computeCompromisos.card-cycles.test.ts` (fallan igual sin estos cambios; tests sensibles a la fecha real) |
| `npm run lint` (archivos de esta feature) | ✅ 0 errores / 0 warnings |
| `npm run lint` (global) | ⚠️ ~635 errores **preexistentes** (ej. `lib/supabase/*` con `any`) |
| `npm run build` | ✅ |

**Commits** (chicos, por fase):
```
7f2006e  plan de arquitectura + monthly series compartido
e583d95  core determinístico (snapshot, features, rules) + 36 tests
e311515  heroes API + hero piloto en Análisis mobile
2231b4e  assistant v2 backend (planner + evidencia) + 33 tests
a9af56a  assistant UI v2 (follow-ups, evidencia, deep link)
```

---

## 8. Qué sigue (decisiones ya preparadas)

- **Home/Saldo Vivo**: migrar cuando el tono del piloto esté validado — `IntelligenceHero` ya acepta `surface="home-mobile"`.
- **Editorial LLM para héroes** (`FF_INTELLIGENCE_EDITORIAL`): documentado en el plan, sin implementar a propósito — el copy determinístico alcanza para validar y cuesta $0.
- **Persistencia de insights** (`insight_events`): los candidates ya traen `dedupeKey` + `validUntil`; agregar la tabla habilita cooldowns cross-device y feedback sin romper contratos.
- **Acciones confirmables desde el chat**: la arquitectura de paquetes deja el lugar para "intents de escritura" con confirmación explícita (hoy el chat es solo lectura).
