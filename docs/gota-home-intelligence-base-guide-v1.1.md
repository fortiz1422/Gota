# Gota — Guía Base de Home Inteligente

**Versión:** 1.1  
**Fecha:** 2026-07-10  
**Estado:** Dirección de producto aceptada; implementación productiva sujeta a preview visual, QA y gates de rollout  
**Objetivo:** servir como documento único de handoff para implementar de punta a punta la capa inteligente de Gota.

---

## 1. Propósito de esta guía

Esta guía consolida:

- la visión original de Gota;
- el estado funcional actual de la aplicación;
- la arquitectura de inteligencia ya diseñada;
- los problemas detectados en la primera integración visual;
- la nueva dirección de diseño aprobada;
- la dirección lógica para conectar el motor con las superficies;
- los escenarios esperados;
- los contratos, prioridades, lifecycle, pruebas y rollout necesarios.

Debe usarse como fuente de verdad para el trabajo de Home Intelligence.

No reemplaza la documentación financiera y técnica general de Gota. La complementa y, específicamente, **reemplaza la dirección visual anterior que proponía una “Lectura de hoy” editorial persistente en el Home**.

Las tareas de correctness del plan anterior siguen vigentes. Lo que cambia es la composición visual y el contrato de salida para Home.

Decisión posterior al plan anterior:

- se conserva `Compromisos` como módulo estructural y adaptativo en V1;
- no se adopta obligatoriamente el `cash horizon` como reemplazo;
- puede evaluarse un horizonte dentro del drilldown, pero no debe coexistir en Home si repite la misma información.

---

## 2. Documentos de origen

Esta guía fue construida a partir de:

- `gota-vision.pdf`
- `gota-app-bible (2).md`
- `Gota-Product History (2).md`
- `2026-07-10_002248-home-intelligence-control-room-end-to-end.md`
- screenshots del Home y Movimientos actuales;
- benchmark de Copilot Money, Rocket Money, PocketGuard, YNAB, Nubank, Monarch, Revolut, Cleo y Piere;
- exploraciones visuales realizadas el 10 de julio de 2026;
- presentación de 15 casos de uso de inteligencia.

Si hay contradicción:

1. las fórmulas y reglas financieras existentes tienen prioridad;
2. esta guía tiene prioridad para la experiencia de Home Intelligence;
3. el código real y `app/globals.css` tienen prioridad para tokens visuales exactos;
4. toda discrepancia financiera debe resolverse antes de mostrar un insight.

---

## 3. Qué es Gota

Gota es una app de finanzas personales para Argentina orientada a responder:

> ¿Cuánta plata tengo realmente disponible hoy?

La propuesta combina:

- registro de movimientos con baja fricción;
- una lectura financiera operativa confiable;
- contexto argentino: tarjetas, pesos, dólares, inflación, devengado vs. percibido;
- inteligencia que ayuda a comprender y actuar, sin tomar decisiones financieras autónomas.

Gota no promete que el usuario va a gastar menos. Promete que, si registra, va a saber.

La inteligencia debe reforzar esa promesa. No debe convertir a Gota en un chatbot financiero ni en un feed de recomendaciones.

---

## 4. Problema que estamos resolviendo

### 4.1 Home anterior

La jerarquía histórica era:

```text
Saldo Vivo
→ Disponible Real
→ Compromisos
→ Movimientos
→ Smart Input
```

Esa estructura funcionaba porque respondía, en orden:

1. qué tengo;
2. qué puedo usar;
3. qué ya comprometí;
4. qué pasó;
5. cómo registro algo nuevo.

### 4.2 Primera integración de inteligencia

La primera integración agregó:

```text
Disponible Real card
Compromisos card
PulseRow card
PrimaryHeroCard
Horizontal insight chips
Banners
Últimos movimientos card
Smart Input
Assistant FAB
```

El problema no fue la calidad aislada de cada componente. El problema fue sistémico:

- la inteligencia se sumó como otro subsistema visual;
- varias cards adquirieron pesos similares;
- deuda, vencimiento, ritmo y disponibilidad repitieron una misma historia;
- Home dejó de tener una decisión editorial clara;
- Smart Input y Assistant FAB compitieron como dos entradas conversacionales;
- el usuario tuvo que interpretar más contenido para responder una pregunta simple.

### 4.3 Exploración editorial

Se probó una única “Lectura de hoy” editorial. Mejoró la deduplicación, pero siguió agregando una tercera capa cognitiva después de Saldo Vivo y Disponible Real.

Conclusión:

> El Home no necesita un módulo persistente de inteligencia. Necesita que los módulos existentes se comporten de forma inteligente.

---

## 5. Dirección aprobada

### 5.1 Concepto central

La dirección aprobada es:

# Inteligencia ambiental con escalamiento transitorio

La inteligencia:

- calcula y prioriza silenciosamente;
- modifica subtítulos, estados, énfasis y CTAs sin alterar el orden estructural del Home;
- aparece como una única acción transitoria solo cuando hay algo concreto para resolver;
- explica evidencia bajo demanda;
- deriva consultas complejas y simulaciones al asistente.

La aceptación cubre la dirección de producto. La integración en `DashboardShell`, el retiro del path anterior y la activación por defecto siguen sujetos a:

1. preview determinístico;
2. revisión visual;
3. QA funcional;
4. rollout controlado.

### 5.2 Qué permanece siempre visible

```text
Saldo Vivo
Disponible Real
Compromisos
Movimientos
Smart Input
TabBar
```

### 5.3 Qué es adaptativo

- subtítulos;
- status semántico;
- nivel de énfasis;
- próximo impacto;
- CTA nativo;
- prioridad de señales dentro de cada superficie;
- cantidad de detalle;
- acceso a explicación;
- una fila de acción transitoria.

El orden estructural no es adaptativo: `Saldo Vivo → Disponible Real → Compromisos → Movimientos → Smart Input`. El Action Slot es una inserción excepcional, no un reordenamiento.

### 5.4 Qué deja de existir en Home

- `PrimaryHeroCard` de inteligencia;
- `PulseRow` separado;
- “Lectura de hoy” persistente;
- chips horizontales de inteligencia;
- múltiples banners compitiendo;
- assistant FAB cuando Smart Input o un CTA “Preguntar” ya están disponibles;
- mensajes grandes de “todo bien”;
- cards genéricas para cada insight.

---

## 6. Principios no negociables

1. **Saldo Vivo es el único hero.**
2. **Disponible Real es el subhero permanente.**
3. **Compromisos conserva un lugar estructural en V1.**
4. **No existe un hero editorial persistente de inteligencia.**
5. **Home muestra como máximo una acción transitoria.**
6. **En calma, Home puede no mostrar ningún mensaje inteligente adicional.**
7. **Toda señal debe editar el módulo más cercano a su causa.**
8. **La explicación y evidencia viven bajo demanda.**
9. **Las acciones nativas tienen prioridad sobre “Preguntar”.**
10. **La IA generativa no decide fórmulas, prioridades financieras ni veredictos.**
11. **La inteligencia puede abstenerse.**
12. **Montos ocultos, moneda y base de conversión deben respetarse globalmente.**
13. **No se rediseña Análisis ni Movimientos fuera de lo necesario para integrar estados.**
14. **No se ejecuta ningún movimiento de dinero sin preview, confirmación e idempotencia.**
15. **Una señal resuelta desaparece y no vuelve sin un cambio material.**
16. **La inteligencia ambiental reemplaza copy existente; no acumula capas.**
17. **Cada señal pertenece primero al módulo más cercano a su causa.**
18. **El Action Slot global se usa solo cuando la acción debe elevarse por urgencia o alcance transversal.**
19. **La cantidad de movimientos y la estructura base no cambian según exista o no una acción.**
20. **Se construyen los 15 escenarios de punta a punta; el límite está en cuántos se muestran simultáneamente.**

---

## 7. Arquitectura de experiencia

La inteligencia se expresa en cuatro niveles.

### Nivel 1 — Inteligencia silenciosa

El sistema:

- carga el snapshot financiero;
- calcula señales;
- determina calidad y cobertura;
- genera candidatos;
- deduplica;
- rankea por superficie;
- decide si debe callarse.

No requiere representación visual.

### Nivel 2 — Inteligencia ambiental

Edita módulos existentes.

La edición ambiental debe reemplazar texto secundario existente, no apilar label, badge, subtítulo, detalle, CTA y chevron. Cada módulo muestra una sola historia principal.

Ejemplos:

```text
Disponible Real
$ 10.534.051
Cubierto hasta fin de mes
```

```text
Compromisos
$ 2.199.742
Próximo impacto: Visa · 13 jul
```

```text
Movimiento
Supermercado · $ 420.000
Monto fuera de lo habitual
```

### Nivel 3 — Acción transitoria

Aparece únicamente cuando:

- hay una acción nativa;
- el evento tiene urgencia suficiente;
- no puede representarse con claridad dentro del módulo propietario;
- necesita elevarse por urgencia o alcance transversal;
- el usuario todavía no lo resolvió, descartó o pospuso.

Ejemplo:

```text
Visa necesita atención
Faltan $ 182.400 · vence 13 jul
[Revisar]
```

La fila desaparece cuando:

- se completa la acción;
- se resuelve la causa;
- vence su período de validez;
- el usuario la pospone;
- baja de relevancia frente a una señal superior.

### Nivel 4 — Explicación, conversación y simulación

Se abre bajo demanda.

Incluye:

- evidencia utilizada;
- fórmula o composición;
- horizonte;
- caveats;
- movimientos relacionados;
- CTA nativo;
- pregunta sugerida;
- simulaciones.

No ocupa espacio permanente en Home.

---

## 8. Semántica financiera obligatoria

Estas definiciones deben implementarse una sola vez y reutilizarse. La UI no puede recomponerlas localmente.

```text
Saldo Vivo
= saldo inicial o rollover
+ ingresos efectivos
− gastos percibidos
− pagos de tarjeta
+ ajuste neto de transferencias
```

```text
Disponible Real
= Saldo Vivo
− saldo pendiente del ciclo vigente de tarjeta
− consumos de tarjeta todavía no debitados que correspondan a la base definida
```

No volver a descontar pagos de tarjeta que ya redujeron Saldo Vivo.

```text
Libre
= Disponible Real
− objetivos comprometidos
```

```text
Margen hasta fin de mes
= Disponible Real
− objetivos comprometidos
− débitos directos pendientes
```

```text
Margen diario permitido
= Margen hasta fin de mes / días restantes
```

Reglas adicionales:

- `income_entries` tiene prioridad;
- `monthly_income` es fallback únicamente cuando no existen entradas del modelo nuevo;
- compra con tarjeta crea obligación;
- pago de tarjeta crea salida efectiva;
- transferencias entre cuentas propias no son ingreso ni consumo;
- no mezclar monedas sin una base explícita;
- los días restantes deben usar timezone Argentina;
- las fórmulas exactas existentes en producción prevalecen hasta que una migración probada las reemplace.

### 8.1 Cobertura de tarjeta

Para determinar si una tarjeta está cubierta:

```text
saldo pendiente del ciclo
= consumos asignados al ciclo que vence
− pagos aplicados a ese ciclo
```

Excluir:

- consumos de ciclos futuros;
- pagos ya reflejados en Saldo Vivo;
- compras archivadas o anuladas;
- importes de otra moneda sin conversión explícita.

La implementación debe probar que un pago no se descuenta dos veces.

### 8.2 Suscripciones y débitos pendientes

- Solo una suscripción `DEBIT` pendiente reduce margen de caja inmediato.
- Una suscripción `CREDIT` aumenta compromiso de tarjeta, no débito inmediato.
- Si `subscription_insertions` o un gasto vinculado prueban que la suscripción ya se materializó, eliminar la reserva pendiente del mismo cálculo.
- El evento con vencimiento hoy continúa reservado hasta materializarse o finalizar su vigencia.

---

## 9. Arquitectura lógica

```text
Fuentes financieras
→ FinancialSnapshot
→ Features determinísticas
→ InsightCandidate[]
→ SurfaceOrchestrator
→ HomeIntelligenceModel
→ UI ambiental / ActionSlot / Sheets / Assistant
→ Lifecycle + analytics
```

### 9.1 Fuentes

- cuentas;
- saldos por período;
- ingresos;
- gastos;
- tarjetas;
- pagos de tarjeta;
- transferencias;
- suscripciones;
- cuotas;
- rollover;
- cotización y modo de moneda;
- historial;
- eventos de lifecycle.

### 9.2 Snapshot

El snapshot debe exponer:

- período;
- `generatedAt`;
- `dataQuality`;
- cobertura y truncamiento por fuente;
- moneda original;
- base de visualización;
- montos ocultos;
- datos del dashboard ya resueltos cuando sea posible.

Contrato mínimo de cobertura:

```ts
type SnapshotCoverage = {
  expenses: { fetched: number; limit: number; truncated: boolean }
  incomes: { fetched: number; limit: number; truncated: boolean }
  transfers: { fetched: number; limit: number; truncated: boolean }
  historyStartDate: string
}
```

Reglas de calidad:

- obtener exactamente `limit` filas se considera potencialmente truncado;
- cada señal declara sus fuentes mínimas;
- estados positivos, anomalías e históricos quedan inhibidos si una fuente requerida está truncada, vencida o ausente;
- un estado parcial puede mostrar datos neutrales conocidos, pero no inferencias optimistas;
- el orquestador devuelve `homeIntelligence = null` si no existe una cuenta activa;
- si el período seleccionado no es el mes actual, no mostrar Action Slot, copy de “hoy”, ingresos esperados ni vencimientos presentes.

### 9.3 Features determinísticas

Ejemplos:

- liquidez actual y proyectada;
- Disponible Real;
- compromisos restantes;
- débitos del día;
- horizonte de caja;
- margen permitido;
- ritmo observado;
- carga de cuotas;
- histórico comparable;
- categoría same-day;
- anomalías;
- cambio débito/crédito;
- ingresos esperados;
- suscripciones;
- estado de cierre;
- cobertura por tarjeta.

### 9.4 Candidatos

Cada candidato debe contener:

```ts
type InsightCandidate = {
  id: string
  dedupeKey: string
  kind: InsightKind
  domain: InsightDomain
  status: 'calm' | 'watch' | 'risk'
  urgency: number
  actionability: number
  impact: number
  confidence: number
  novelty: number
  evidence: EvidenceItem[]
  action: IntelligenceAction | null
  askQuestion: string | null
  validUntil: string
  correlationKeys: string[]
  noActionReason: string | null
}
```

### 9.5 Orquestador por superficie

El Home no debe consumir candidatos crudos.

Debe existir un compositor puro que:

- seleccione modificadores ambientales por módulo;
- seleccione cero o una acción transitoria;
- deduplique causas correlacionadas;
- respete lifecycle;
- aplique base monetaria;
- aplique ocultamiento;
- permita abstención;
- genere modelos de explicación.

Contrato propuesto:

```ts
type HomeIntelligenceModel = {
  generatedAt: string
  validUntil: string
  dataQuality: DataQuality
  moneyBasis: MoneyBasis
  ambient: {
    saldoVivo: AmbientModifier | null
    disponibleReal: AmbientModifier | null
    commitments: AmbientModifier | null
    movementAnnotations: MovementAnnotation[]
  }
  actionSlot: HomeAction | null
  explanations: Record<string, ExplanationModel>
}
```

```ts
type AmbientModifier = {
  status: 'neutral' | 'positive' | 'watch' | 'risk'
  label: string
  detail: string | null
  explanationId: string | null
  sourceInsightIds: string[]
}
```

```ts
type HomeAction = {
  id: string
  kind: HomeActionKind
  status: 'watch' | 'risk'
  title: string
  subtitle: string
  action: IntelligenceAction
  explanationId: string | null
  dedupeKey: string
  validUntil: string
}
```

### 9.6 Acciones tipadas

```ts
type IntelligenceAction =
  | { type: 'navigate'; href: string; label: string }
  | { type: 'ask'; question: string; label: string }
  | { type: 'prefill_income'; recurringIncomeId: string; label: string }
  | { type: 'review_pending_receipt'; receiptId: string; label: string }
  | { type: 'review_subscription'; subscriptionId: string; label: string }
  | { type: 'review_card'; cardId: string; cycleId?: string; label: string }
  | { type: 'review_movement'; movementId: string; label: string }
  | { type: 'simulate_purchase'; amount?: number; installments?: number; label: string }
  | { type: 'snooze'; dedupeKey: string; until: string; label: string }
```

Ninguna acción financiera escribe directamente sin confirmación.

`prefill_income` abre un preview editable. Solo crea `income_entries` después de confirmación explícita e idempotente. Nunca materializa automáticamente un ingreso esperado.

---

## 10. Priorización

### 10.1 Prioridad del Action Slot

```text
riesgo de liquidez / vencimiento no cubierto
→ confirmación que afecta saldo
→ recibo pendiente
→ movimiento potencialmente erróneo
→ ingreso esperado no confirmado
→ aumento o revisión recurrente
→ revisión no urgente
```

### 10.2 Score sugerido

```text
urgency
+ actionability
+ normalized impact
+ confidence
+ novelty
- correlation penalty
- repetition penalty
- native module duplication penalty
```

### 10.3 Reglas de deduplicación

- Si Visa explica riesgo de liquidez y vencimiento, se muestra una sola historia.
- El mismo evento puede figurar en Compromisos y en un sheet, pero no repetir el párrafo completo.
- `secondaryCount` no se muestra en Home.
- Dos señales del mismo dominio no compiten por Action Slot.
- Un estado ambiental puede coexistir con una acción solo si agrega contexto distinto.
- Antes del Action Slot, intentar resolver la señal dentro de su módulo propietario.
- Tarjetas y vencimientos pertenecen primero a Compromisos; margen y liquidez a Disponible Real; anomalías a la fila del movimiento.
- El Action Slot no repite título, monto y explicación visibles en el módulo propietario.

---

## 11. Diseño del Home

### 11.1 Orden base y estabilidad espacial

```text
Header
Saldo Vivo
Disponible Real
[Action Slot global condicional, solo si debe escalar]
Compromisos
Últimos movimientos
Smart Input
TabBar
```

Los módulos estructurales no se reordenan según las señales. La adaptación ocurre dentro de cada módulo y, excepcionalmente, mediante una inserción transitoria. El usuario debe poder formar memoria espacial.

El Action Slot no es obligatorio para toda acción. Si una señal tiene un módulo propietario evidente, su CTA vive primero allí. El slot global se reserva para acciones transversales o suficientemente urgentes.

### 11.2 Presupuesto visual por módulo

La inteligencia ambiental reemplaza copy, no lo acumula:

- cada módulo muestra una sola historia principal;
- no combinar simultáneamente subtítulo, badge, detalle, CTA textual y chevron;
- usar un único affordance principal de explicación o acción;
- la calma se expresa por ausencia de interrupciones, no llenando Home de verde;
- `watch` usa un acento moderado y `risk` contraste claro con CTA;
- datos parciales producen copy neutral o abstención, nunca optimismo.

### 11.3 Header y Saldo Vivo

- conservar cabecera azul;
- avatar a la izquierda;
- acción `+` a la derecha;
- `SALDO VIVO` como label;
- monto a 40px aproximados y peso 800;
- ARS/USD y ocultamiento existentes;
- tap abre breakdown;
- no agregar copy inteligente grande dentro del hero.

No reintroducir un selector de período centrado si no existe en el branch real. Si se decide recuperarlo, definir primero navegación histórica y convivencia con moneda.

Ambiental permitido:

- una línea secundaria breve;
- acceso a explicación;
- estado de cierre solo cuando sea útil.

### 11.4 Disponible Real

Es el segundo elemento en jerarquía.

Debe mostrar:

- label;
- monto;
- una sola línea ambiental;
- un affordance de explicación.

Estados ejemplo:

```text
Neutral: Ya descuenta deuda y consumos
Calma acotada: Tus compromisos registrados están cubiertos
Calma proyectada: Con lo registrado, llegás cubierto a fin de mes
Watch: Margen ajustado para los próximos 7 días
Risk: Revisá tus próximos compromisos
Learning: Aprendiendo de tus movimientos
```

No usar `Cubierto hasta fin de mes` como afirmación absoluta si cobertura u horizonte no permiten sostenerla. La copy debe exponer el alcance con `con lo registrado` o referirse al compromiso concreto.

Tap abre sheet con:

- composición;
- compromisos descontados;
- horizonte;
- base monetaria;
- caveats.

### 11.5 Action Slot

Características:

- una fila, no una card hero;
- 52–64px de alto;
- título de una línea;
- subtítulo de una línea;
- un CTA;
- status semántico sobrio;
- sin ilustración, sparkle ni etiqueta “IA”;
- no se renderiza en calma;
- no deja placeholder vacío;
- no duplica la historia del módulo propietario.

```text
señal con módulo propietario
→ estado/copy/CTA dentro del módulo
→ escalar al Action Slot solo si urgencia o alcance lo justifican
```

- tarjeta no cubierta: Compromisos `risk` con CTA; Action Slot solo si el faltante material debe interrumpir la lectura general;
- liquidez transversal: Disponible Real ambiental + Action Slot si existe una acción concreta;
- ingreso esperado no confirmado: Action Slot, porque no tiene módulo estructural propietario claro;
- movimiento anómalo: anotación y CTA en la fila; Action Slot solo si requiere confirmación prioritaria.

### 11.6 Compromisos adaptativo

Compromisos conserva:

- total;
- `A pagar`;
- `En curso`;
- barra;
- acceso a detalle.

La inteligencia puede modificar:

- subtítulo;
- estado;
- próximo impacto;
- CTA;
- detalle expandido;
- énfasis semántico.

Estados:

```text
Normal:
2 vencimientos · próximo 13 jul

Calma:
Próximo vencimiento cubierto

Watch:
Visa vence el 13 jul · está cubierta

Risk:
Visa no está completamente cubierta
```

No debe existir otro bloque repitiendo la misma tarjeta, monto y explicación. Si existe Action Slot, Compromisos agrega contexto distinto y más breve.

### 11.7 Movimientos

Mantener auditabilidad y una altura estable.

V1:

- cantidad fija de filas definida por layout o viewport, no por `actionSlot`;
- category icon;
- título;
- categoría y fecha;
- monto;
- separadores;
- acceso a todos.

Anotaciones ambientales permitidas:

- `Monto fuera de lo habitual`;
- `Posible duplicado`;
- `Suscripción`;
- `Pendiente de confirmar`.

Las anotaciones no deben convertir todas las filas en alerts. Cada fila admite como máximo una anotación ambiental.

### 11.8 Smart Input y asistente

Smart Input sigue siendo la entrada principal.

Debe poder resolver:

- registro natural;
- preguntas;
- simulaciones.

La UI puede distinguir intención después de escribir, no necesariamente con dos controles permanentes. Debe comunicar capacidad con un placeholder como `Registrá o preguntá algo`.

```text
“Supermercado 42.000” → Registrar gasto
“¿Puedo gastar 300.000?” → Pregunta / Simulación
```

No mostrar un Assistant FAB separado en Home si:

- Smart Input acepta preguntas; o
- hay un CTA `Preguntar` en el sheet actual.

Validar teclado abierto, safe area de iPhone/PWA, convivencia con TabBar, preview de movimiento, transición a sheet/asistente y navegación hacia atrás.

### 11.9 Tres composiciones canónicas

Toda la variedad lógica debe resolverse dentro de tres composiciones visuales, no mediante quince diseños distintos.

#### A. Calma
- cero Action Slot;
- Disponible Real neutral o positivo acotado;
- Compromisos normal;
- cero adornos de IA.

#### B. Atención contextual
- cero Action Slot global;
- el módulo propietario absorbe la señal;
- CTA dentro del módulo o sheet.

#### C. Acción necesaria
- máximo un Action Slot;
- módulo causal con estado complementario sin repetición narrativa;
- CTA nativo evidente.

Las tres composiciones deben entenderse en cinco segundos a `393×852` y cubrir los 15 escenarios mediante fixtures.

---

## 12. Sistema visual

Usar `app/globals.css` como fuente de verdad.

Tokens documentados de referencia:

```text
background principal: #FFFFFF
background secundario: #F8FBFD
background terciario / PWA: #EEF4F8 / #F0F4F8
text primary: #0D1829
text secondary: #4A6070
text tertiary: #90A4B0
primary: #2178A8
success: #1A7A42
warning: #B84A12
danger: #A61E1E
```

Tipografía:

- DM Sans;
- hero 40px / 800;
- subhero 24–28px;
- body 15px / 500;
- metadata 12px;
- labels 11px / 700 uppercase.

Reglas:

- fondo directo antes que card;
- sombras solo para jerarquía estructural;
- radios existentes;
- Phosphor regular/light;
- no purple gradients;
- no robot imagery;
- no sparkle por defecto;
- no más de una superficie elevada importante sobre Movimientos;
- formato argentino de montos;
- `font-variant-numeric: tabular-nums`.

Viewport primario:

```text
393×852
```

También validar:

```text
375×812
390×844
430×932
```

---

## 13. Escenarios esperados

Cada escenario se define como:

```text
señal
→ elegibilidad
→ superficie
→ mensaje
→ evidencia
→ acción
→ resolución
```

Los 15 casos son **alcance funcional confirmado** y deben construirse de punta a punta. No son quince diseños independientes: son escenarios para features determinísticas, fixtures, contract tests, evidencia, acciones, lifecycle y resolución.

Construir toda la capacidad no implica mostrarla simultáneamente. El orquestador expone cero o una acción global, como máximo un modificador principal por módulo y explicaciones bajo demanda. Los flags controlan exposición y rollout, no justifican omitir ninguno de los 15 casos.

| Capacidad compartida | Casos |
|---|---|
| Liquidez y proyección | 1, 2, 3, 6, 7, 9 |
| Patrones e históricos | 4, 5, 13, 14 |
| Ingresos esperados | 8 |
| Simulación | 10, 11 |
| Moneda y valuación | 12 |
| Calidad y abstención | 15 |
| Lifecycle y evidencia | Todos |

Antes de implementar, cada caso debe etiquetarse en el código o matriz de trabajo como:

```text
existing
requires_correctness_fix
requires_new_persistence
future_flagged
```

Clasificación inicial:

| Caso | Clasificación inicial |
|---|---|
| 1 Tarjeta cubierta | `requires_correctness_fix` + nueva UI ambiental |
| 2 Tarjeta no cubierta | `requires_correctness_fix` + nuevo Action Slot |
| 3 Débito de hoy | `requires_correctness_fix` |
| 4 Movimiento inusual | `requires_correctness_fix` + anotación nueva |
| 5 Suscripción que aumentó | `requires_new_persistence` o validación de histórico |
| 6 Margen diario | `existing` a validar + nueva UI |
| 7 Ritmo insostenible | `existing` a validar + nuevo Action Slot |
| 8 Ingreso esperado | `requires_new_persistence` o validación de recurrentes |
| 9 Cierre/rollover | `future_flagged` |
| 10 Compra puntual | `existing` a validar en asistente |
| 11 Cuotas | `requires_correctness_fix` |
| 12 Moneda combinada | `requires_correctness_fix` |
| 13 Categoría | `requires_correctness_fix` |
| 14 Cambio a crédito | `existing` a validar + nueva UI |
| 15 Abstención | nuevo comportamiento del orquestador |

### Caso 1 — Tarjeta cubierta

**Señal:** vencimiento próximo y saldo proyectado suficiente.  
**Elegibilidad:** current month, datos completos, vencimiento ≤ 5 días.  
**Superficie:** Compromisos ambiental.  
**Mensaje:** `Visa vence el 13 jul · está cubierta`.  
**Evidencia:** monto a pagar, Disponible Real, saldo post-pago.  
**Acción:** `Ver cálculo`.  
**Resolución:** desaparece al pagar o pasar el vencimiento.  
**No hacer:** Action Slot; no hay urgencia operativa.

### Caso 2 — Tarjeta no cubierta

**Señal:** vencimiento próximo supera saldo proyectado.  
**Elegibilidad:** confianza alta y falta material.  
**Superficie:** Compromisos `risk` con CTA nativo; escalar además al Action Slot solo si el faltante material justifica interrumpir la lectura general.  
**Mensaje:** `Te faltarían $ 182.400 para cubrir Visa el 13 jul`.  
**Evidencia:** disponible, deuda, diferencia.  
**Acción:** `Revisar compromiso`.  
**Resolución:** pago, ingreso, cambio de saldo o snooze válido.

### Caso 3 — Débito de hoy

**Señal:** suscripción `DEBIT` o débito directo con `daysUntil = 0`.  
**Elegibilidad:** todavía no materializado, ya reservado y sin `subscription_insertions`/gasto vinculado que lo duplique.  
**Superficie:** Disponible Real ambiental.  
**Mensaje:** `Hoy se debita Internet por $ 42.000 · ya está reservado`.  
**Evidencia:** evento, fecha, monto.  
**Acción:** `Ver próximos débitos`.  
**Resolución:** movimiento insertado o fin del día.

### Caso 4 — Movimiento fuera de lo habitual

**Señal:** gasto materialmente superior al patrón comparable.  
**Elegibilidad:** historial suficiente; excluir pagos de tarjeta y extraordinarios.  
**Superficie:** anotación en fila.  
**Mensaje:** `Monto fuera de lo habitual`.  
**Evidencia:** ratio, mediana/promedio comparable.  
**Acción:** `Revisar movimiento`.  
**Resolución:** confirmado, editado o marcado extraordinario.

### Caso 5 — Suscripción que aumentó

**Señal:** importe recurrente subió materialmente.  
**Elegibilidad:** mismo merchant/suscripción e historial suficiente.  
**Superficie:** Action Slot watch.  
**Mensaje:** `Netflix aumentó 28% este mes`.  
**Evidencia:** importe anterior y actual.  
**Acción:** `Revisar suscripción`.  
**Resolución:** revisión, dismiss o aceptación.

### Caso 6 — Margen diario

**Señal:** margen restante dividido por días restantes.  
**Elegibilidad:** datos completos, current month, sin truncamiento crítico.  
**Superficie:** Disponible Real ambiental o sheet.  
**Mensaje:** `Podés gastar hasta $ 312.400 por día y llegar cubierto`.  
**Evidencia:** disponible, compromisos, días.  
**Acción:** `Ver proyección`.  
**Resolución:** se actualiza con movimientos; no requiere evento de cierre.

No llamar a esta métrica `Ritmo del mes`.

### Caso 7 — Ritmo observado insostenible

**Señal:** gasto observado supera margen permitido de forma sostenida.  
**Elegibilidad:** muestra suficiente; evitar reaccionar a un único gasto extraordinario.  
**Superficie:** Action Slot watch/risk.  
**Mensaje:** `Al ritmo de esta semana llegarías $ 286.000 abajo`.  
**Evidencia:** ritmo observado, margen permitido, proyección.  
**Acción:** `Ver qué cambió`.  
**Resolución:** cambia la proyección, el usuario revisa o finaliza período.

### Caso 8 — Ingreso esperado no confirmado

**Señal:** ingreso recurrente llegó a fecha esperada sin registro.  
**Elegibilidad:** patrón confiable y current month.  
**Superficie:** Action Slot.  
**Mensaje:** `Todavía no registraste el sueldo esperado para hoy`.  
**Evidencia:** ingreso esperado, fecha y cuenta destino.  
**Acción:** `Preparar ingreso`; abre preview editable.  
**Resolución:** confirmación, skip o reprogramación.

### Caso 9 — Cierre y rollover estimado

**Señal:** existe saldo final proyectable.  
**Elegibilidad:** últimos días del mes o apertura explícita del detalle.  
**Superficie:** Saldo Vivo ambiental o sheet.  
**Mensaje:** dinámico según `rollover_mode`.  
**Evidencia:** cierre por cuenta y modo de rollover.  
**Acción:** `Ver cierre estimado`.  
**Resolución:** cierre, nuevo mes o cambio de proyección.

Este caso es una extensión nueva y debe quedar detrás de flag si no está en el scope inicial.

La copy depende de `rollover_mode`:

```text
auto: Se trasladarían automáticamente…
manual: Podrías trasladar…
off: Cerrarías con…, pero el rollover está desactivado.
```

Nunca afirmar que el dinero se trasladará sin consultar el modo.

### Caso 10 — Compra puntual

**Señal:** pregunta del usuario con monto.  
**Elegibilidad:** snapshot válido.  
**Superficie:** Asistente.  
**Mensaje:** `Sí, pero reduce tu margen diario de $ 312.400 a $ 284.600`.  
**Evidencia:** disponible, compromisos, margen antes/después.  
**Acción:** `Simular compra`.  
**Resolución:** conversación; no modifica datos.

### Caso 11 — Compra en cuotas

**Señal:** monto y cantidad de cuotas.  
**Elegibilidad:** referencia de ingreso y horizonte.  
**Superficie:** Asistente / simulación.  
**Mensaje:** veredicto determinístico `fits | tight | overloaded | insufficient_data`.  
**Evidencia:** importe mensual, peak income share, meses afectados.  
**Acción:** `Ver meses afectados`.  
**Resolución:** conversación.

Si se simulan menos meses que las cuotas solicitadas, mostrar caveat de truncamiento.

Política inicial:

```text
máxima proporción cuota/ingreso < 25% → fits
25–39% → tight
≥ 40% → overloaded
sin ingreso de referencia → insufficient_data
```

Si la simulación cubre menos meses que las cuotas solicitadas:

```text
truncated = true
```

### Caso 12 — Moneda combinada

**Señal:** Home usa modo combinado.  
**Elegibilidad:** cotización válida.  
**Superficie:** Disponible Real sheet.  
**Mensaje:** `Tu disponible combinado equivale a ... al tipo de cambio usado hoy`.  
**Evidencia:** ARS, USD, cotización, timestamp.  
**Acción:** `Ver composición`.  
**Resolución:** informativo.

Sin cotización válida, no convertir silenciosamente.

### Caso 13 — Categoría con cambio real

**Señal:** categoría crece respecto del histórico comparable.  
**Elegibilidad:** excluir extraordinarios, pagos de tarjeta y moneda distinta.  
**Superficie:** Análisis; opcional ambient en drilldown.  
**Mensaje:** `Supermercado viene 24% arriba de tu promedio`.  
**Evidencia:** promedio, período, movimientos explicativos.  
**Acción:** `Ver movimientos`.  
**Resolución:** informativo, cooldown diario.

### Caso 14 — Cambio hacia crédito

**Señal:** ratio de crédito sube frente al baseline.  
**Elegibilidad:** volumen suficiente.  
**Superficie:** Compromisos ambiental o Análisis.  
**Mensaje:** `Esta semana 68% de tus consumos fueron con crédito; normalmente es 41%`.  
**Evidencia:** ratios y períodos.  
**Acción:** `Ver cambio de origen`.  
**Resolución:** informativo, cooldown.

### Caso 15 — Abstención

**Señal:** no hay relevancia o confianza suficiente.  
**Elegibilidad:** calidad parcial, aprendizaje o ninguna señal material.  
**Superficie:** ninguna; opcional subtexto discreto.  
**Mensaje:** `Aprendiendo de tus movimientos`.  
**Evidencia:** no aplica.  
**Acción:** `Qué falta para mejorar` solo bajo demanda.  
**Resolución:** automática al mejorar datos.

No afirmar `Nada urgente` sin evidencia suficiente.

---

## 14. Mapeo señal → superficie

| Dominio | Superficie primaria | Escalamiento |
|---|---|---|
| Liquidez y margen | Disponible Real | Action Slot si hay riesgo |
| Vencimientos y deuda | Compromisos | Action Slot si no está cubierto |
| Débitos próximos | Disponible Real / Compromisos | Sheet |
| Anomalía de movimiento | Fila del movimiento | Action Slot si requiere confirmación |
| Suscripciones | Compromisos / Action Slot | Sheet de suscripción |
| Ingreso esperado | Action Slot | Confirmación |
| Cierre / rollover | Saldo Vivo sheet | Cierre |
| Categorías y hábitos | Análisis | Asistente |
| What-if | Asistente | Simulación |
| Moneda | Sheet de métrica | Detalle de cotización |
| Baja calidad | Abstención | Explicación bajo demanda |

---

## 15. Correctness obligatorio antes de exposición

Mantener del plan anterior:

1. incluir débitos con vencimiento hoy;
2. excluir extraordinarios de históricos de categoría;
3. ligar evidencia visible con los facts usados;
4. hacer determinístico el veredicto de cuotas;
5. declarar truncamiento y cobertura del snapshot;
6. no mezclar ARS y USD sin base explícita;
7. no mostrar montos si están ocultos;
8. no usar `hasAnyMovement` como condición general para inteligencia;
9. no afirmar estados positivos con datos insuficientes.

---

## 16. Lifecycle

Persistir por `user_id + dedupe_key`:

```text
first_seen_at
last_seen_at
shown_count
dismissed_until
acted_at
resolved_at
feedback
last_status
surface
```

Reglas:

- una señal nueva puede mostrarse;
- una señal pospuesta no reaparece antes de tiempo;
- una escalada de watch a risk puede romper un snooze anterior;
- una señal resuelta queda oculta;
- calm/ambient tiene cooldown;
- risk puede persistir mientras la causa exista;
- feedback `not_relevant` reduce novelty/prioridad;
- no guardar montos, merchant, tarjeta, cuenta ni descripciones en eventos.

`dedupeKey` debe identificar la ocurrencia material:

- tarjeta + ciclo;
- suscripción + mes;
- ingreso recurrente + fecha esperada;
- movement ID;
- categoría + ventana comparable.

Resolver una ocurrencia no bloquea futuras ocurrencias. Una nueva fecha, ciclo o mes puede iniciar un lifecycle nuevo. Definir por `kind` qué cambio material reabre la señal.

---

## 17. Evidencia y confianza

Cada explicación debe mostrar los facts que causaron el mensaje.

```ts
type EvidenceItem = {
  id: string
  label: string
  value: string
  source: string
  asOf: string
}
```

El packet debe seleccionar evidencia por IDs:

```ts
answerEvidenceIds: string[]
```

No usar:

```ts
packet.facts.slice(0, 4)
```

La UI debe poder responder:

- qué dato se usó;
- de qué período;
- cuándo se actualizó;
- cómo se calculó;
- qué limitación existe.

---

## 18. Base monetaria y privacidad visual

```ts
type HomeDisplayContext = {
  heroBalanceMode: HeroBalanceMode
  viewCurrency: Currency
  valuationRate: number | null
  amountsVisible: boolean
}
```

Reglas:

- conversión en un solo lugar;
- si no puede combinarse, mostrar moneda original;
- ocultamiento global;
- no filtrar montos por copy secundaria;
- evidencia respeta ocultamiento;
- analytics no recibe valores financieros.

---

## 19. Data loading e invalidación

Home Intelligence debe llegar junto con el dashboard:

```ts
type DashboardApiData = ExistingDashboardApiData & {
  homeIntelligence: HomeIntelligenceModel | null
}
```

No agregar un fetch independiente bloqueante.

Después de:

- gasto;
- ingreso;
- transferencia;
- pago de tarjeta;
- edición;
- suscripción;
- confirmación;

una invalidación del dashboard debe actualizar:

- Saldo Vivo;
- Disponible Real;
- Compromisos;
- Action Slot;
- anotaciones;
- explicaciones.

Evitar layout shift:

- no reservar alto para Action Slot ausente;
- skeleton solo donde la estructura es estable;
- usar modelo cacheado válido ante error parcial;
- nunca mostrar una card de error ruidosa.

---

## 20. Analytics de producto

Eventos:

```text
ambient_modifier_seen
ambient_explanation_opened
home_action_seen
home_action_clicked
home_action_completed
home_action_dismissed
home_action_snoozed
intelligence_feedback_submitted
simulation_started
simulation_completed
```

Propiedades permitidas:

```text
insight_kind
status
surface
has_native_action
data_quality
feedback
resolution_type
```

Prohibido:

- amount;
- balance;
- category;
- merchant;
- description;
- account;
- card name;
- raw user text.

Éxito no significa más impresiones.

Indicadores:

- acciones completadas;
- explicaciones abiertas;
- baja tasa de `not_relevant`;
- baja repetición;
- ausencia de contradicciones;
- Home comprensible en cinco segundos.

---

## 21. Plan de implementación

### Fase A — Correctness

- débito del día;
- extraordinarios;
- evidence IDs;
- cuotas;
- coverage/truncamiento;
- currency/masking;
- tests.

### Fase B — Contratos

- `HomeIntelligenceModel`;
- `AmbientModifier`;
- `HomeAction`;
- `ExplanationModel`;
- acciones tipadas;
- display context.

### Fase C — Orquestador

- implementar capacidades compartidas que cubran los 15 casos;
- routing por dominio y módulo propietario;
- ranking;
- dedupe;
- abstención;
- lifecycle eligibility;
- fixtures.

### Fase D — Preview determinístico

Crear una ruta de exploración que agrupe todos los fixtures dentro de calma, atención contextual y acción necesaria, e incluya:

```text
canonical-calm
canonical-contextual-attention
canonical-action-required
ambient-calm
ambient-watch
ambient-risk
action-card-shortfall
action-income-missing
action-subscription-increase
movement-anomaly
learning
masked
combined-ars
combined-usd
long-amount
partial-data
cached-error
```

Validar en 393×852 antes de producción. La preview debe recorrer los 15 casos, demostrar propiedad de señal y garantizar máximo una acción global sin repetición.

### Fase E — Producción

- integrar ambiental en Disponible Real;
- integrar ambiental en Compromisos;
- agregar Action Slot;
- agregar anotaciones de movimiento;
- conectar sheets;
- eliminar Home editorial/chips/pulse;
- eliminar FAB duplicado;
- entregar modelo en dashboard payload.

### Fase F — Lifecycle y analytics

- migración;
- endpoint de eventos;
- feedback;
- cooldown;
- resolución;
- eventos sanitizados.

### Fase G — Asistente

- evidencia seleccionada;
- simulación determinística;
- contexto conversacional;
- continuidad;
- acciones nativas.

### Fase H — Rollout

- flag apagada;
- preview QA;
- cuenta de prueba;
- ventana controlada;
- rollback de un switch;
- mantener path anterior por una release.

---

## 22. Feature flags

Propuesta:

```text
FF_HOME_AMBIENT_INTELLIGENCE_V1
FF_HOME_TRANSIENT_ACTION_V1
FF_MOVEMENT_ANNOTATIONS_V1
FF_INTELLIGENCE_LIFECYCLE_V1
```

Permiten:

- probar ambiental sin Action Slot;
- activar escalamiento por etapas;
- aislar fallas;
- rollback sin migración destructiva.

---

## 23. Testing

### 23.1 Unit tests

- features financieras;
- candidate generation;
- routing;
- ranking;
- dedupe;
- abstención;
- lifecycle;
- masking;
- currency;
- acciones;
- explicación/evidencia.

### 23.2 Contract tests

Para cada uno de los 15 casos:

- fixture;
- señal esperada;
- superficie esperada;
- copy model;
- evidence IDs;
- acción;
- resolución;
- no duplicación.

### 23.3 Visual QA

Viewports:

```text
375×812
390×844
393×852
430×932
```

Checklist:

- Saldo Vivo domina;
- Disponible Real es #2;
- Compromisos sigue legible;
- cero hero editorial;
- cero chips de inteligencia;
- cero Action Slot en calma;
- una acción máxima;
- no repetición de Visa;
- acción primero en módulo propietario;
- orden estructural y cantidad de movimientos estables;
- una sola historia principal por módulo;
- calma sin saturación de verde;
- `watch` y `risk` distinguibles sin dramatización;
- 15 fixtures dentro de las tres composiciones canónicas;
- long amounts sin overflow;
- masking total;
- moneda coherente;
- Smart Input y TabBar no chocan;
- keyboard abierto usable;
- sheet accesible;
- loading estable.

### 23.4 Scenarios de regresión

- sin cuentas;
- sin movimientos;
- movimiento pero sin historial;
- tarjeta vence sin gastos recientes;
- múltiples tarjetas;
- múltiples monedas;
- cotización ausente;
- datos truncados;
- API parcial;
- mes pasado;
- usuario anónimo;
- montos ocultos;
- action resuelta;
- snooze;
- risk escalation.

---

## 24. Definition of Done

La implementación está completa cuando:

1. los fixes de correctness tienen tests;
2. Home no renderiza hero editorial, pulse ni chips;
3. Disponible Real y Compromisos reciben modificadores ambientales;
4. Action Slot renderiza cero o una acción;
5. los 15 casos están implementados de punta a punta y sus fixtures tienen salida determinística;
6. evidencia coincide con el mensaje;
7. masking y currency pasan matriz;
8. lifecycle evita repetición;
9. dashboard entrega inteligencia sin fetch bloqueante separado;
10. mutaciones refrescan todo atómicamente;
11. analytics no filtra datos sensibles;
12. screenshots mobile pasan revisión;
13. flag off revierte al Home estable;
14. build, TypeScript, lint y tests pasan;
15. los módulos mantienen orden y altura predecibles;
16. la inteligencia ambiental reemplaza copy en vez de acumularlo;
17. las acciones se resuelven primero en el módulo propietario y el Action Slot solo escala lo necesario;
18. las tres composiciones canónicas cubren visualmente los 15 casos;
19. un usuario puede explicar en cinco segundos:

> qué tiene, qué puede usar, qué está comprometido y si debe hacer algo.

---

## 25. Instrucciones para el implementador

1. Leer esta guía completa antes de modificar UI.
2. Leer fórmulas y modelos existentes.
3. Auditar el estado real del branch.
4. No asumir que el plan anterior ya fue implementado correctamente.
5. Implementar RED → GREEN → REFACTOR.
6. No comenzar por componentes visuales; comenzar por contracts y fixtures para los 15 casos completos.
7. Construir preview determinístico antes de integrar producción.
8. Mantener cambios limitados al Home Intelligence.
9. No rediseñar Análisis, Movimientos, Settings ni onboarding.
10. No cambiar fórmulas financieras para acomodar copy.
11. No inventar señales nuevas durante implementación.
12. Reportar discrepancias entre esta guía y datos reales.
13. Mantener rollback por feature flag.
14. No recortar los 15 casos para simplificar V1: construir toda la capacidad y controlar su exposición con orquestación y flags.
15. Demostrar los 15 fixtures dentro de las tres composiciones canónicas antes de integrar producción.
16. Entregar:

```text
- resumen de arquitectura;
- lista de archivos;
- tests;
- screenshots por estado;
- riesgos conocidos;
- instrucciones de rollout;
- instrucciones de rollback.
```

---

## 26. Decisión final

La dirección no es:

> “mostrar el potencial de la IA agregando más contenido”.

La dirección es:

> “hacer que cada parte del Home sepa qué significa el estado financiero del usuario, intervenga solo cuando corresponde y pueda demostrar por qué”.

La experiencia objetivo debe sentirse así:

> Gota sabe qué dinero tengo, qué ya está comprometido, qué puede cambiar y cuándo necesita avisarme. Si quiero entender más, puede demostrarlo.

