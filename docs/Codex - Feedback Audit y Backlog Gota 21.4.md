# Codex - Feedback sobre Audit y Backlog Gota 21.4

**Fecha:** 2026-04-21  
**Archivos revisados:**  
- `docs/Opus - Audit Gota 21.4.md`
- `docs/Opus - Backlog per Audit 21.4.md`

**Estado:** primer feedback externo. No modifica los documentos originales.

---

## 1. Veredicto ejecutivo

El audit de Opus es útil como generador de ideas y como presión estratégica, pero no debería copiarse directo al backlog operativo. Tiene tres problemas principales:

1. **Prioriza demasiado crecimiento antes de cerrar confianza financiera.** Para Gota, el riesgo principal no es que falten features; es que el usuario no confíe en los números o que el código contable sea difícil de sostener.
2. **Incluye afirmaciones ya desactualizadas o parcialmente falsas.** Hay service worker, hay banner para usuarios anónimos, ya existe `DisponibleRealSheet`, ya existe demo de SmartInput en onboarding, y parte de la consolidación de `Saldo Vivo` ya está encaminada.
3. **Subestima esfuerzo y riesgo.** Cambios como hero financiero, rollover, pagos de tarjeta, onboarding y monetización parecen chicos en el backlog, pero tocan decisiones de producto, modelo mental y lógica financiera sensible.

Mi recomendación es usar el audit como insumo, pero reescribir el backlog con este orden:

1. **Confianza financiera y operabilidad.**
2. **Activación del usuario y primera experiencia.**
3. **Loops de engagement.**
4. **Crecimiento, monetización y features grandes.**
5. **Limpieza técnica no bloqueante.**

---

## 2. Qué está bien y debería mantenerse

### 2.1 Tests financieros

Correcto y urgente. No hay tests detectables para la lógica crítica. La prioridad no debería ser "tests en general", sino una primera suite mínima sobre funciones puras:

- `lib/live-balance.ts`
- `lib/movement-classification.ts`
- cálculo de deuda pendiente de tarjeta / `gastosTarjeta`
- cuotas e installments
- compromisos de tarjeta

Esto es más valioso que empezar por E2E o tests de API.

### 2.2 Observabilidad

Sentry o equivalente debe ser P0. Pero con dos límites:

- no loguear información financiera sensible sin redacción explícita;
- no llenar funciones puras con `try/catch` solo para capturar errores. Mejor integrar Sentry a nivel Next.js, boundaries, rutas y acciones críticas.

### 2.3 Reemplazar `alert()`

Correcto. Hay muchos `alert()` en flujos visibles: login, onboarding, SmartInput, ParsePreview, pagos, ingresos, settings, movimientos. Esto baja calidad percibida y rompe el tono del producto.

La recomendación es hacerlo por fases:

1. SmartInput / ParsePreview / pagos de tarjeta.
2. Onboarding.
3. Settings y flujos secundarios.

### 2.4 SmartInput está subexplotado

Correcto. SmartInput es el diferencial del producto, pero hoy se siente más como input + formulario que como experiencia principal.

Lo más importante no es confetti ni animación por sí misma, sino reducir fricción real:

- preview con menos campos visibles;
- defaults más inteligentes;
- feedback de parseo claro;
- errores no bloqueantes;
- confirmación rápida.

### 2.5 Onboarding demasiado largo

Correcto en dirección. El código actual tiene un wizard largo, con paywall al final, y eso contradice la promesa de fricción baja.

La versión revisada debería conservar la demo real de SmartInput que ya existe y sacar el paywall del flujo inicial.

### 2.6 Filtro Estoico sin suficiente retorno

Correcto. Capturar `Necesidad/Deseo` tiene costo cognitivo. Si solo termina en un gráfico, el intercambio no es justo. Debe alimentar insights, hero messages o metas simples.

### 2.7 Rate limiting persistente

Correcto, pero el diagnóstico de Opus es impreciso. El rate limit ya es server-side por usuario, pero vive en memoria. El problema real es que no es persistente ni consistente en serverless.

---

## 3. Qué corregir o bajar de prioridad

### 3.1 "Sin Service Worker" es falso

El audit dice que no hay service worker. En el código existe:

- `components/ServiceWorkerRegistrar.tsx`
- `public/sw.js`
- `public/manifest.json`
- registro desde `app/layout.tsx`

El backlog no debería decir "agregar service worker". Debería decir:

**Auditar y endurecer el service worker existente.**

Alcance sugerido:

- validar cache strategy real;
- agregar fallback offline;
- revisar versionado;
- preparar base para push notifications;
- testear installabilidad PWA.

Prioridad sugerida: P2, no P0.

### 3.2 "No hay mecanismo de conversión anónimo" es exagerado

Existe `AnonymousBanner`. Lo que falta es hacerlo más inteligente:

- trigger por cantidad de movimientos;
- trigger por días de uso;
- copy más concreto sobre persistencia de datos;
- evento de analytics;
- modalidad menos invasiva pero persistente.

Entonces el item sigue siendo válido, pero no es greenfield.

### 3.3 Disponible Real como hero único requiere decisión de producto

La propuesta es razonable, pero no debería presentarse como obvia. El PRD histórico define `Saldo Vivo` como trust engine. Cambiar el hero a `Disponible Real` cambia la promesa principal.

Estado actual:

- `SaldoVivo.tsx` ya permite toggle entre `Saldo Vivo` y `Disponible Real`;
- `DisponibleRealSheet.tsx` ya existe;
- el problema real es claridad, default y copy.

Recomendación:

- tratarlo como decisión P1 con signoff;
- medir impacto en activación/confianza;
- si se cambia default, mantener `Saldo Vivo` como concepto visible y explicable.

### 3.4 No agregaría `type: 'card_payment'` ahora

Opus propone cambiar el modelo de `Pago de Tarjetas` a un nuevo tipo. Técnicamente puede ser más limpio, pero hoy hay decisiones recientes alrededor de:

- categoría especial `Pago de Tarjetas`;
- `is_legacy_card_payment`;
- ciclos de tarjeta;
- deuda pendiente;
- pagos legacy.

Cambiar el modelo ahora abriría una migración grande en una zona sensible. Mi recomendación:

- mantener `Pago de Tarjetas` como categoría especial por ahora;
- mejorar la UX para que el usuario no lo sienta como "gasto";
- consolidar primero la semántica de pago aplicable vs pago legacy;
- considerar un tipo explícito solo después de tests y migración cerrada.

### 3.5 Rollover: no reabrir como refactor grande sin tests

La dirección de Opus es correcta: `Saldo Vivo` no debe depender de rollover como fuente principal. Pero eso ya está parcialmente encaminado en docs y código.

El backlog debería cambiar de:

**"Simplificar rollover"**

a:

**"Cerrar cleanup residual de rollover / account_period_balance."**

Alcance:

- documentar rol final de `account_period_balance`;
- eliminar o esconder restos de UI/typing que contradigan el modelo;
- revisar constraints y migraciones;
- cubrir con tests antes de borrar caminos legacy.

### 3.6 Monetización completa no va antes de activación

El audit la llama existencial, pero después la manda a P3. Esa tensión es correcta: monetización importa, pero implementar billing antes de tener activación medible es prematuro.

Recomendación:

- sacar el paywall del onboarding inicial;
- usar paywall informativo o fake-door después de que el usuario ya recibió valor;
- no integrar MercadoPago hasta tener señales de conversión reales.

### 3.7 Push notifications no es P3 por complejidad, sino por timing

Push puede ayudar retención, pero antes hacen falta:

- service worker endurecido;
- permisos con contexto;
- eventos de producto claros;
- email/identidad;
- baseline de retención.

No lo pondría antes de email básico y métricas.

### 3.8 Bottom sheet audit es válido, pero no prioritario como migración masiva

La regla de diseño propuesta es buena, pero migrar todos los sheets puede consumir mucho tiempo sin mover activación ni confianza financiera.

Mejor:

- documentar la política;
- aplicarla a nuevas features;
- corregir solo sheets problemáticos cuando se toquen.

### 3.9 Benchmarks y claims de impacto necesitan bajar tono

El audit usa frases como "+10-15% completion" o "D7 pasa de 15% a 35%" sin data propia. Sirven como intuición, no como promesa.

En el backlog final conviene escribir:

- "hipótesis";
- "métrica esperada";
- "cómo se valida";
- no "impacto garantizado".

---

## 4. Omisiones importantes

### 4.1 Migraciones financieras pendientes

El audit no le da suficiente peso a cierres ya identificados en docs vigentes:

- migración / etiquetado de pagos legacy con `is_legacy_card_payment`;
- cierre semántico de `gastosTarjeta`;
- rol residual de `account_period_balance`;
- limpieza de `monthly_income`;
- constraints y tipos sincronizados con Supabase.

Esto debería estar antes que presupuestos, metas, push o import CSV.

### 4.2 Privacidad, datos y borrado de cuenta

El backlog lo pone como "fuera del producto", pero para una app financiera es core. Antes de lanzamiento público debería existir:

- política de privacidad;
- borrado de cuenta y datos;
- explicación básica de uso de Gemini;
- consentimiento mínimo para emails/notificaciones.

### 4.3 Métricas de producto concretas

"Métricas baseline" está bien, pero debe especificarse. Mínimo:

- onboarding_started;
- onboarding_completed;
- first_expense_created;
- parse_started / parse_success / parse_failed;
- preview_confirmed / preview_cancelled;
- anonymous_link_started / anonymous_link_completed;
- card_payment_prompt_seen / confirmed / dismissed;
- dashboard_loaded_with_data;
- returning_user_d1 / d7.

Sin esto, los cambios de onboarding, hero y SmartInput no se pueden evaluar.

### 4.4 Error states y boundaries

Falta como item propio. Sentry captura, pero el usuario necesita recuperación visible cuando falla dashboard, analytics, movimientos o parseo.

### 4.5 Encoding/copy visible

Hay muchos textos en archivos que aparecen con caracteres corruptos al leerlos desde terminal. Puede ser problema de encoding de terminal o de archivo, pero conviene verificar antes de lanzar. En una app con copy en español, esto afecta confianza.

### 4.6 Desalineación de stack/documentación

El contexto dice Next.js 15, pero `package.json` usa Next `16.1.6`. No es un bug de producto, pero sí una señal de documentación desalineada.

---

## 5. Backlog revisado propuesto

### P0 - Fundaciones antes de seguir expandiendo producto

| # | Item | Esfuerzo | Razón |
|---|---|---:|---|
| 01 | Observabilidad mínima con Sentry o equivalente | S | Sin errores de producción no hay forma de operar una app financiera. Debe incluir redacción de datos sensibles. |
| 02 | Métricas baseline de activación | S/M | Necesario antes de cambiar onboarding, hero o SmartInput. |
| 03 | Tests unitarios de primitives financieras | M | Cubrir `live-balance`, `movement-classification`, deuda pendiente de tarjeta, cuotas e installments. |
| 04 | Cerrar pagos legacy y deuda pendiente | M | Completar migración/etiquetado `is_legacy_card_payment` y validar `Disponible Real`. |
| 05 | Consolidar `gastosTarjeta` y pagos aplicables | M | Hoy sigue siendo la semántica más sensible en dashboard. Debe salir de lógica local frágil. |
| 06 | Reemplazar `alert()` en flujos críticos | S/M | Primero SmartInput, ParsePreview, pagos de tarjeta y onboarding. |
| 07 | Privacidad y borrado de cuenta | S/M | Blocker para lanzamiento público de una app financiera. |

### P1 - Activación y primera experiencia

| # | Item | Esfuerzo | Razón |
|---|---|---:|---|
| 08 | Decidir y ajustar hero: `Saldo Vivo` vs `Disponible Real` | S/M | Requiere signoff de producto. Puede cambiar default, copy y detalle, pero no debe borrar el concepto de trust engine. |
| 09 | Reducir onboarding y sacar paywall inicial | M | Mantener setup mínimo + primera cuenta + saldo inicial + SmartInput demo. Paywall después del valor. |
| 10 | ParsePreview compacto | S/M | Mostrar solo monto, categoría y fuente/cuenta por defecto; mover fecha, cuotas y necesidad/deseo a detalles cuando sea seguro. |
| 11 | SmartInput con estados visuales reales | S | Parseo, éxito, error y confirmación deben sentirse como core experience. |
| 12 | Empty states y guía de primera transacción | S | Dashboard vacío debe empujar al primer gasto sin explicar de más. |
| 13 | Conversión anónimo mejorada | S/M | Mejorar el banner existente con triggers por uso, copy de persistencia y analytics. |
| 14 | Error boundaries/fallbacks en rutas principales | M | Dashboard, Analytics y Movimientos deben fallar de forma recuperable. |

### P2 - Engagement y modelo de producto

| # | Item | Esfuerzo | Razón |
|---|---|---:|---|
| 15 | Filtro Estoico con consecuencias | M | Integrarlo al hero engine/insights y sugerir clasificación por categoría. |
| 16 | Budget ligero por categoría | M/L | Feature potente, pero debe venir después de cerrar confianza financiera y activation. |
| 17 | Email capture y opt-in | M | Capturar email OAuth y preparar bienvenida/digest. No enviar sin consentimiento claro. |
| 18 | Pago de tarjeta como acción UX, no como modelo nuevo | M | Mejorar `CardPaymentPrompt`/`CardPaymentForm`; mantener categoría especial hasta cerrar migración. |
| 19 | Rate limiting persistente de Gemini | S/M | Mover de memoria a storage persistente; límites por usuario/plan. |
| 20 | Endurecer service worker existente | M | Offline fallback, versionado, installability y base para push. |
| 21 | Limpieza visual guiada por design system | M | Phosphor-only, tokens tipográficos, spacing y política de sheets. No hacerlo como refactor masivo aislado. |

### P3 - Crecimiento y features grandes

| # | Item | Esfuerzo | Razón |
|---|---|---:|---|
| 22 | Paywall informativo / fake-door | S | Validar interés en Pro sin integrar billing todavía. |
| 23 | Monthly Wrap shareable | M | Buen experimento orgánico cuando haya datos y usuarios activos. |
| 24 | Push notifications fase 1 | L | Después de SW endurecido, métricas y permisos con contexto. |
| 25 | Metas de ahorro | M | Buena feature AR/USD, pero menos urgente que budgets y confianza core. |
| 26 | Import CSV banco/tarjeta | L | Alto impacto, pero grande y riesgosa. Conviene post-estabilización. |
| 27 | Referral | M/L | Tiene sentido cuando Pro o algún reward real exista. |

### P4 - Limpieza y mantenibilidad no bloqueante

| # | Item | Esfuerzo | Razón |
|---|---|---:|---|
| 28 | Eliminar `lucide-react` | S | Alinea design system y reduce dependencia duplicada. |
| 29 | Tests API routes | M | Después de tests financieros puros. |
| 30 | E2E Playwright | L | Después de estabilizar onboarding/SmartInput. |
| 31 | Refactor `Ultimos5` | M | Útil si se toca por features; no hacerlo antes de cerrar P0/P1. |
| 32 | Analytics con navegación por URL | M | Mejora UX, pero no bloquea activación inicial. |
| 33 | Ordenar documentación y encoding | S/M | Marcar vigentes, históricos y transicionales; corregir copy roto si aplica. |

---

## 6. Cambios sugeridos al audit original

Cuando se actualicen los archivos originales, sugiero editar el audit así:

1. Cambiar "Sin Service Worker" por "Service Worker básico existente, falta hardening".
2. Cambiar "sin conversión anónimo -> registrado" por "conversión anónima básica, falta trigger contextual".
3. En `Disponible Real`, bajar el tono de certeza y marcarlo como decisión de producto.
4. En `Pago de Tarjetas`, no proponer nuevo tipo como camino inmediato; proponer capa UX y consolidación semántica.
5. En rollover, referenciar los docs vigentes y tratarlo como cleanup residual, no como rediseño desde cero.
6. Mover monetización completa a post-activación; sacar paywall inicial como tarea de activación.
7. Agregar bloque de migraciones financieras pendientes.
8. Agregar privacidad/borrado de cuenta como blocker de lanzamiento.
9. Reescribir claims de impacto como hipótesis medibles.

---

## 7. Cambios sugeridos al backlog original

El backlog actual tiene demasiados P0/P1 y mezcla fundamentos, UI polish, growth y features grandes. Yo lo reestructuraría así:

- **P0:** observabilidad, métricas, tests financieros, pagos legacy/deuda pendiente, `gastosTarjeta`, alerts críticos, privacidad.
- **P1:** hero decision, onboarding corto, ParsePreview compacto, SmartInput states, empty states, anon conversion, error fallbacks.
- **P2:** Estoico, budgets, email, pago tarjeta UX, rate limit persistente, SW hardening, design system cleanup.
- **P3:** paywall fake-door, monthly wrap, push, goals, CSV import, referral.
- **P4:** lucide, API tests, E2E, Ultimos5, URL analytics, docs cleanup.

También eliminaría o reescribiría estos items:

- "Service Worker real" -> reescribir.
- "Banner conversión anónimo" -> reescribir como mejora del banner existente.
- "Monetización Gota Pro (MercadoPago)" -> postergar; antes fake-door.
- "Card payment como acción, no gasto" -> mantener UX, no migrar modelo todavía.
- "Simplificar rollover" -> convertir en cleanup/closing residual.

---

## 8. Decisiones que conviene firmar antes de tocar originales

### Decisión A - Hero financiero

¿El hero debe mostrar por defecto `Saldo Vivo` o `Disponible Real`?

Mi recomendación: probar `Disponible Real` como default solo si el detalle mantiene muy visible el puente:

`Saldo Vivo - deuda pendiente de tarjetas = Disponible Real`

### Decisión B - Modelo de pago de tarjeta

¿Se mantiene `Pago de Tarjetas` como categoría especial por ahora?

Mi recomendación: sí. Mejorar UX y consolidar semántica antes de cambiar esquema.

### Decisión C - Paywall

¿Se elimina el paywall del onboarding inicial?

Mi recomendación: sí. El paywall debe aparecer después de valor recibido o como fake-door medido.

### Decisión D - Lanzamiento público

¿Privacidad y borrado de cuenta son blocker?

Mi recomendación: sí, especialmente por ser finanzas personales.

---

## 9. Conclusión

El backlog de Opus tiene buenas intuiciones, pero necesita una poda fuerte. Gota no debería entrar en una fase de feature expansion todavía. El siguiente bloque correcto es cerrar confianza financiera, observabilidad y activación.

Después de eso, budgets, email, Estoico con consecuencias y monthly wrap tienen mucho más sentido porque se apoyan sobre un producto que ya mide, explica y sostiene sus números.
