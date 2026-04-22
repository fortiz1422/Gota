# Codex - Backlog P0 Detallado Gota 21.4

**Fecha:** 2026-04-21
**Base:** `docs/Codex - Feedback Audit y Backlog Gota 21.4.md`
**Objetivo:** convertir los P0 en PBIs ejecutables, con alcance claro y criterios de aceptacion.

Este documento no reemplaza el audit ni el feedback estrategico. Es una herramienta de ejecucion. La idea es implementar de a un PBI, con diff revisable y validacion antes de pasar al siguiente.

---

## Estado de implementacion local

**Actualizado:** 2026-04-22

| PBI                                  | Estado                              | Validacion / pendientes                                                                     |
| ------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------- |
| P0-01 Observabilidad minima          | Codigo implementado                 | Pendiente configurar DSN/env y validar evento real en proveedor.                            |
| P0-02 Metricas baseline              | Codigo implementado                 | Pendiente SQL manual de `docs/supabase-product-events.sql` y validacion de eventos reales.  |
| P0-03 Tests financieros iniciales    | Implementado                        | `npm.cmd test` OK: 4 archivos, 22 tests.                                                    |
| P0-04 Pagos legacy y Disponible Real | Implementado en codigo/schema local | Pendiente aplicar/verificar SQL en Supabase y validar manual con datos controlados.         |
| P0-05 Consolidar `gastosTarjeta`     | Implementado                        | Helper `lib/card-debt.ts` cubierto por tests; pendiente validacion manual con tarjeta real. |
| P0-06 Reemplazar `alert()` criticos  | Implementado                        | SmartInput, ParsePreview, CardPaymentPrompt, onboarding y login usan errores inline.        |
| P0-07 Privacidad y borrado de cuenta | Implementado en codigo             | Pendiente validar `SUPABASE_SERVICE_ROLE_KEY`, prueba manual con usuario descartable y retencion de logs externos. |

**Validaciones tecnicas del bloque local:**

- `npx.cmd tsc --noEmit`: OK.
- `npm.cmd test`: OK con permiso elevado por `spawn EPERM` de esbuild dentro del sandbox.
- `npm.cmd run lint`: OK, 0 errores; quedan 13 warnings preexistentes.

**Pendientes manuales no ejecutados:** SQL/manual Supabase de P0-01/P0-02/P0-04/P0-05, configurar/validar `SUPABASE_SERVICE_ROLE_KEY` para P0-07, prueba manual de borrado con usuario descartable y pruebas manuales de UI.

---

## 1. Principios para ejecutar P0

1. No abrir features nuevas antes de cerrar confianza financiera, observabilidad y activacion minima.
2. No hacer refactors grandes sin tests alrededor de la logica financiera tocada.
3. No mezclar cambios de producto, migraciones y polish visual en el mismo PR/tarea.
4. Mantener cambios minimos y localizados por PBI.
5. Si un PBI requiere decision de producto o SQL manual en Supabase, dejarlo explicitado antes de implementar.

---

## 2. Orden recomendado

| Orden | PBI                                  | Motivo                                                                         |
| ----: | ------------------------------------ | ------------------------------------------------------------------------------ |
|     1 | P0-01 Observabilidad minima          | Permite diagnosticar produccion antes de tocar flujos sensibles.               |
|     2 | P0-02 Metricas baseline              | Permite medir onboarding, SmartInput y conversion anonima antes de cambiarlos. |
|     3 | P0-03 Tests financieros iniciales    | Reduce riesgo antes de consolidar calculos.                                    |
|     4 | P0-04 Pagos legacy y Disponible Real | Cierra una inconsistencia de confianza visible.                                |
|     5 | P0-05 Consolidar `gastosTarjeta`     | Reduce divergencia en la zona financiera mas delicada.                         |
|     6 | P0-06 Reemplazar `alert()` criticos  | Mejora calidad percibida en errores reales.                                    |
|     7 | P0-07 Privacidad y borrado de cuenta | Blocker para lanzamiento publico.                                              |

P0-01 y P0-02 pueden ejecutarse antes de P0-03 porque son mayormente instrumentacion. P0-04 y P0-05 deberian apoyarse en P0-03 si implican cambios de logica.

---

## P0-01 - Observabilidad minima de produccion

**Problema / issue**
La app no tiene error tracking de produccion. Si un usuario encuentra un crash, un fallo de parseo, un error de Supabase o un bug financiero silencioso, hoy no hay una traza centralizada para diagnosticarlo.

**Impacto**
En una app de finanzas personales, operar sin observabilidad aumenta el riesgo de perder confianza. Un error visible puede frustrar; un error silencioso en balances o pagos puede ser mucho peor.

**Fix propuesto**
Integrar Sentry o una alternativa equivalente para Next.js, con captura de errores client/server, contexto tecnico minimo y redaccion de datos sensibles.

**Alcance**

- Agregar SDK/configuracion de observabilidad.
- Capturar errores no manejados en cliente y servidor.
- Agregar contexto no sensible: `user_id` hasheado o id interno si se decide que es aceptable, ruta, version/build, entorno.
- Capturar errores en rutas criticas:
  - parseo SmartInput;
  - guardado de gastos;
  - dashboard;
  - pagos de tarjeta.
- Agregar una regla explicita de no loguear montos, descripciones de gastos, emails ni payloads financieros completos.

**Fuera de alcance**

- Session replay.
- Product analytics.
- Logging detallado de calculos financieros con datos reales.
- Alerting avanzado por Slack/email.

**Archivos candidatos**

- `package.json`
- `next.config.ts`
- `app/layout.tsx`
- `app/global-error.tsx` si se crea
- `sentry.client.config.ts` si se usa Sentry
- `sentry.server.config.ts` si se usa Sentry
- `sentry.edge.config.ts` si aplica
- `app/api/parse-expense/route.ts`
- `app/api/expenses/route.ts`
- `lib/server/dashboard-queries.ts`

**Criterios de aceptacion**

- La app compila con la integracion de observabilidad habilitada.
- Un error de prueba en cliente queda capturado en el servicio elegido.
- Un error de prueba en servidor queda capturado en el servicio elegido.
- No se envian montos, descripciones de gastos, emails ni payloads financieros completos.
- La integracion se desactiva o degrada limpiamente si falta el DSN/env var.

**Validacion**

- `npx tsc --noEmit`
- `npm run lint`
- Test manual con error controlado en entorno local o preview.
- Revisar evento capturado y confirmar que no incluye PII ni datos financieros sensibles.

**Dependencias / bloqueos**

- Elegir proveedor: Sentry recomendado por velocidad.
- Definir env vars:
  - `NEXT_PUBLIC_SENTRY_DSN`
  - variables server-side si aplica.
- Requiere instalar dependencia. Si el entorno no permite red, pedir aprobacion para instalar.

---

## P0-02 - Metricas baseline de activacion

**Problema / issue**
El backlog propone cambios en onboarding, SmartInput, hero y conversion anonima, pero hoy no hay una baseline confiable para saber si esos cambios mejoran o empeoran el producto.

**Impacto**
Sin metricas, las decisiones se validan por intuicion. Eso es riesgoso porque varios cambios propuestos afectan la primera experiencia y el modelo mental del usuario.

**Fix propuesto**
Agregar una capa minima de eventos de producto. Debe ser simple, no invasiva y compatible con usuario anonimo.

**Alcance**

- Definir un helper unico para eventos de producto.
- Instrumentar eventos baseline:
  - `onboarding_started`
  - `onboarding_completed`
  - `first_account_created`
  - `first_expense_created`
  - `smartinput_parse_started`
  - `smartinput_parse_succeeded`
  - `smartinput_parse_failed`
  - `parsepreview_confirmed`
  - `parsepreview_cancelled`
  - `anonymous_banner_seen`
  - `anonymous_link_started`
  - `anonymous_link_completed`
  - `card_payment_prompt_seen`
  - `card_payment_prompt_confirmed`
  - `card_payment_prompt_dismissed`
  - `dashboard_loaded_with_data`
- Guardar solo propiedades no sensibles.
- Documentar taxonomia de eventos.

**Fuera de alcance**

- Embudos avanzados.
- Attribution / campaÃ±as.
- A/B testing.
- Tracking de montos, descripciones, categorias exactas si se considera sensible.
- Email marketing.

**Archivos candidatos**

- `lib/analytics` si se crea helper local
- `components/dashboard/SmartInput.tsx`
- `components/dashboard/ParsePreview.tsx`
- `components/AnonymousBanner.tsx`
- `components/dashboard/CardPaymentPrompt.tsx`
- `app/onboarding/OnboardingFlow.tsx`
- `app/onboarding/steps/Step2Cuenta.tsx`
- `app/onboarding/steps/Step5SmartInput.tsx`
- `components/dashboard/DashboardShell.tsx`
- `docs/ANALYTICS_WORKPLAN.md`

**Criterios de aceptacion**

- Existe una lista documentada de eventos baseline.
- Los eventos se disparan desde los flujos principales sin romper SSR/client boundaries.
- Los eventos no contienen montos, texto libre de usuario ni emails.
- Si el proveedor de analytics no esta configurado, la app no falla.
- Se puede distinguir usuario anonimo vs registrado sin exponer PII.

**Validacion**

- `npx tsc --noEmit`
- `npm run lint`
- Validacion manual en consola/devtools o proveedor elegido.
- Flujo manual:
  - iniciar onboarding;
  - crear cuenta;
  - parsear gasto;
  - confirmar preview;
  - ver dashboard con datos;
  - ver/linkear banner anonimo si aplica.

**Dependencias / bloqueos**

- Definir proveedor o estrategia:
  - opcion simple: tabla propia en Supabase;
  - opcion externa: PostHog, Vercel Analytics u otro.
- Si se usa tabla propia, requiere SQL y RLS.

---

## P0-03 - Tests unitarios de logica financiera critica

**Problema / issue**
No hay tests automaticos detectables para la logica financiera core. Esto hace riesgoso tocar `Saldo Vivo`, `Disponible Real`, cuotas, pagos de tarjeta, rollover o analytics.

**Impacto**
Cada refactor financiero puede introducir regresiones silenciosas. El usuario percibe la app principalmente a traves de los numeros; si los numeros no cierran, el producto pierde su razon de existir.

**Fix propuesto**
Agregar una suite inicial de tests unitarios sobre funciones puras y semanticas financieras compartidas.

**Alcance**

- Instalar/configurar Vitest o runner equivalente.
- Agregar script `test`.
- Cubrir como minimo:
  - `buildLiveBalanceHeroSummary`;
  - `buildLiveBalanceBreakdown`;
  - `sumCrossCurrencyTransferAdjustment`;
  - `sumActiveInstrumentCapital`;
  - `isCardPayment`;
  - `isLegacyCardPayment`;
  - `isApplicableCardPayment`;
  - `isCreditAccruedExpense`;
  - `isPerceivedExpense`;
  - `buildInstallmentRows` si esta suficientemente aislado.
- Agregar casos de borde:
  - multi-cuenta;
  - ARS/USD;
  - transferencias cross-currency;
  - pagos legacy;
  - pago de tarjeta aplicable;
  - cuotas con centavos;
  - gastos sin `account_id`.

**Fuera de alcance**

- Tests E2E.
- Tests de API routes con Supabase mockeado.
- Playwright.
- Cobertura total del repo.

**Archivos candidatos**

- `package.json`
- `vitest.config.ts` si hace falta
- `lib/live-balance.ts`
- `lib/movement-classification.ts`
- `lib/expenses/installments.ts`
- `lib/analytics/computeCompromisos.ts`
- `lib/card-cycles.ts`
- `lib/**/*.test.ts`

**Criterios de aceptacion**

- `npm test` existe y corre.
- La suite inicial pasa localmente.
- Los tests cubren al menos `live-balance` y `movement-classification`.
- Hay casos que documentan explicitamente la diferencia entre pago legacy y pago aplicable.
- Los tests no requieren red ni Supabase real.

**Validacion**

- `npm test`
- `npx tsc --noEmit`
- `npm run lint`

**Dependencias / bloqueos**

- Requiere instalar dependencia de test si no existe.
- Si la instalacion falla por red/sandbox, pedir aprobacion.

---

## P0-04 - Cerrar pagos legacy y `Disponible Real`

**Problema / issue**
`Disponible Real` depende de distinguir deuda pendiente de tarjeta y pagos aplicables. Los pagos legacy de deudas anteriores a Gota deben bajar `Saldo Vivo`, pero no deben reducir deuda pendiente que Gota nunca registro como consumo original.

**Impacto**
Si esta semantica queda mal, `Disponible Real` puede quedar inflado o deprimido artificialmente. Es un problema directo de confianza en el hero financiero.

**Fix propuesto**
Cerrar la migracion y validacion de `is_legacy_card_payment`, y dejar documentada la regla operativa.

**Alcance**

- Revisar estado actual de schema/tipos para `is_legacy_card_payment`.
- Confirmar que pagos legacy:
  - bajan `Saldo Vivo`;
  - no bajan deuda pendiente de tarjeta;
  - se ven como movimiento especial;
  - no rompen analytics.
- Preparar o validar SQL de migracion para pagos historicos.
- Documentar query de validacion manual.
- Revisar UI de pago legacy en tarjeta si ya existe.
- Dejar criterio claro para marcar un pago como legacy vs aplicable.

**Fuera de alcance**

- Reemplazar `Pago de Tarjetas` por un nuevo tipo de transaccion.
- Redisenar completo de tarjetas.
- Reconciliacion automatica de deuda historica.
- Integracion bancaria.

**Archivos candidatos**

- `types/database.ts`
- `schema.sql`
- `lib/movement-classification.ts`
- `lib/server/dashboard-queries.ts`
- `components/dashboard/DisponibleRealSheet.tsx`
- `app/(dashboard)/tarjetas/[cardId]/LegacyCardPaymentModal.tsx`
- `app/(dashboard)/tarjetas/[cardId]/PagarResumenModal.tsx`
- `docs/supabase-legacy-card-payment-migration.sql`
- `docs/disponible-real-deuda-legacy-tarjetas.md`
- `docs/roadmap-deudas-tecnicas-y-negocio.md`

**Criterios de aceptacion**

- Existe una regla documentada y no ambigua:
  - pago legacy baja saldo vivo;
  - pago legacy no reduce deuda pendiente;
  - pago aplicable si reduce deuda pendiente.
- La UI o flujo que crea pago legacy setea `is_legacy_card_payment = true`.
- La UI o flujo que paga resumen calculado setea `is_legacy_card_payment = false` o `null` segun la regla vigente.
- `Disponible Real` usa solo pagos aplicables para reducir deuda pendiente.
- Hay al menos un test o caso manual documentado para:
  - consumo CREDIT registrado + pago aplicable;
  - pago legacy sin consumo CREDIT original.

**Validacion**

- `npm test` si P0-03 ya existe.
- `npx tsc --noEmit`
- `npm run lint`
- Validacion manual con datos controlados:
  - crear gasto CREDIT de 100;
  - verificar deuda pendiente 100;
  - registrar pago aplicable 100;
  - verificar deuda pendiente 0;
  - registrar pago legacy 100 sin consumo original;
  - verificar que `Saldo Vivo` baja y deuda pendiente no se vuelve negativa.

**Dependencias / bloqueos**

- Puede requerir SQL manual en Supabase.
- Antes de correr SQL real, revisar datos historicos afectados.
- Depende de decision de producto: mantener `Pago de Tarjetas` como categoria especial por ahora.

---

## P0-05 - Consolidar `gastosTarjeta` y pagos aplicables

**Problema / issue**
La semantica de gasto con tarjeta devengado, pago aplicable y pago legacy todavia aparece como logica local en dashboard. Esto aumenta el riesgo de que Home, Analytics, Movimientos o tarjetas calculen distinto el mismo concepto.

**Impacto**
Si cada superficie recalcula deuda de tarjeta de forma levemente distinta, el usuario ve numeros inconsistentes. Es una de las formas mas rapidas de perder confianza.

**Fix propuesto**
Extraer una primitive financiera pura para calcular deuda pendiente de tarjeta / `gastosTarjeta`, reutilizable y testeable.

**Alcance**

- Crear helper puro, por ejemplo en `lib/card-debt.ts` o modulo equivalente.
- Entrada sugerida:
  - gastos CREDIT no `Pago de Tarjetas`;
  - pagos de tarjeta;
  - flags `is_legacy_card_payment`;
  - moneda.
- Salida sugerida:
  - `creditAccrued`;
  - `applicablePayments`;
  - `legacyPayments`;
  - `pendingDebt`;
  - opcionalmente breakdown por tarjeta.
- Reemplazar calculo local en dashboard con helper.
- Agregar tests unitarios.

**Fuera de alcance**

- Reescribir todo `dashboard-queries.ts`.
- Cambiar schema.
- Crear tabla nueva de card payments.
- Cambiar UX de pago de tarjeta.

**Archivos candidatos**

- `lib/server/dashboard-queries.ts`
- `lib/movement-classification.ts`
- nuevo `lib/card-debt.ts` si aplica
- `lib/analytics/computeCompromisos.ts`
- `lib/card-summaries.ts`
- `components/dashboard/DisponibleRealSheet.tsx`
- tests en `lib/*.test.ts`

**Criterios de aceptacion**

- Existe una primitive pura para deuda pendiente de tarjeta.
- La primitive tiene tests para:
  - sin gastos de tarjeta;
  - gastos CREDIT sin pagos;
  - pagos aplicables parciales;
  - pagos aplicables completos;
  - pagos legacy ignorados para deuda;
  - exceso de pagos sin deuda negativa.
- `dashboard-queries.ts` deja de contener la formula ad hoc principal.
- `Disponible Real` no puede quedar aumentado artificialmente por pagos legacy.
- El resultado nunca baja de cero salvo que producto decida permitir deuda negativa, cosa que hoy no se recomienda.

**Validacion**

- `npm test`
- `npx tsc --noEmit`
- `npm run lint`
- Caso manual con tarjeta:
  - consumir con CREDIT;
  - ver deuda;
  - pagar parcialmente;
  - ver deuda restante;
  - registrar legacy;
  - confirmar que legacy no reduce la deuda del consumo registrado.

**Dependencias / bloqueos**

- Idealmente depende de P0-03.
- Debe alinearse con P0-04 para no duplicar reglas.

---

## P0-06 - Reemplazar `alert()` en flujos criticos

**Problema / issue**
Hay muchos `alert()` en flujos visibles. Esto rompe la calidad percibida, no sigue el design system y genera una experiencia brusca en momentos de error.

**Impacto**
Los errores son momentos de alta sensibilidad. En SmartInput, ParsePreview, onboarding y pagos, un `alert()` hace que la app se sienta prototipo, no producto financiero confiable.

**Fix propuesto**
Crear o adoptar un mecanismo consistente de feedback no bloqueante para errores y estados. Reemplazar primero los `alert()` de flujos criticos.

**Alcance**

- Definir componente o helper de feedback:
  - toast;
  - inline error;
  - sheet/local error segun contexto.
- Reemplazar `alert()` en:
  - `components/dashboard/SmartInput.tsx`;
  - `components/dashboard/ParsePreview.tsx`;
  - `components/dashboard/CardPaymentPrompt.tsx`;
  - `components/dashboard/CardPaymentForm.tsx` si aplica;
  - onboarding setup;
  - login si el cambio es pequeno.
- Mantener copy breve y accionable.
- Asegurar que errores no desaparezcan demasiado rapido si bloquean accion.

**Fuera de alcance**

- Reemplazar todos los `alert()` del repo en una sola tarea.
- Sistema completo de notificaciones.
- Redisenar formularios.

**Archivos candidatos**

- `components/ui` si se crea `Toast` o `InlineError`
- `app/(auth)/login/LoginButton.tsx`
- `app/onboarding/steps/Step2Cuenta.tsx`
- `app/onboarding/steps/Step4SaldoInicial.tsx`
- `components/dashboard/SmartInput.tsx`
- `components/dashboard/ParsePreview.tsx`
- `components/dashboard/CardPaymentPrompt.tsx`
- `components/dashboard/IncomeModal.tsx`
- `components/dashboard/Ultimos5.tsx`

**Criterios de aceptacion**

- SmartInput no usa `alert()` para error de parseo o conexion.
- ParsePreview no usa `alert()` para error de guardado.
- CardPaymentPrompt no usa `alert()` para error de pago.
- Los errores se muestran en UI con estilo consistente y accesible.
- El usuario puede reintentar sin recargar.
- No se introducen dependencias pesadas si un componente local alcanza.

**Validacion**

- `npx tsc --noEmit`
- `npm run lint`
- Manual:
  - forzar parse fallido;
  - forzar error de red o respuesta no ok en guardado;
  - forzar error en pago de tarjeta;
  - verificar copy, foco y posibilidad de reintento.

**Dependencias / bloqueos**

- Definir si se prefiere toast global o errores inline. Recomendacion:
  - SmartInput: inline/toast suave;
  - ParsePreview y formularios: inline error persistente;
  - pagos: inline error dentro del sheet/modal.

---

## P0-07 - Privacidad, datos y borrado de cuenta

**Problema / issue**
Gota maneja finanzas personales. Antes de lanzamiento publico necesita una base minima de privacidad, consentimiento y control de datos. El backlog de Opus lo deja "fuera del producto", pero deberia ser blocker de lanzamiento.

**Impacto**
Sin politica de privacidad ni borrado de cuenta, el producto queda debil legalmente y genera desconfianza. Ademas, SmartInput usa Gemini, por lo que conviene explicar que texto envia y con que finalidad.

**Fix propuesto**
Agregar una base minima de privacidad y control de datos:

- politica de privacidad;
- pantalla o seccion visible desde Settings;
- borrado de cuenta y datos;
- copy claro sobre uso de IA en SmartInput;
- opt-in futuro para emails/notificaciones.

**Alcance**

- Crear documento/pagina de privacidad.
- Agregar acceso desde Settings/Cuenta.
- Verificar o implementar borrado de cuenta:
  - expenses;
  - income entries;
  - accounts;
  - cards;
  - card cycles;
  - transfers;
  - subscriptions;
  - recurring incomes;
  - yield/instruments si aplica;
  - user_config.
- Documentar tablas incluidas y tablas pendientes.
- Confirmar que el flujo requiere confirmacion explicita.

**Fuera de alcance**

- Auditoria legal formal.
- Gestion avanzada de consentimientos.
- Export completo de datos si todavia no esta listo.
- Email marketing.

**Archivos candidatos**

- `components/settings/CuentaSheet.tsx`
- `components/settings/SettingsPreferences.tsx`
- `app/api/account/route.ts`
- `app/(dashboard)/settings` si existe o se crea ruta
- `docs/gota-backend-structure.md`
- `docs/roadmap-deudas-tecnicas-y-negocio.md`
- `schema.sql`

**Criterios de aceptacion**

- El usuario puede encontrar una politica de privacidad desde la app.
- El usuario puede iniciar borrado de cuenta desde Settings/Cuenta o existe un camino documentado si se decide postergar UI.
- El borrado exige confirmacion explicita.
- El borrado incluye todas las tablas financieras activas conocidas o documenta cualquier excepcion.
- El copy explica, de forma breve, que SmartInput procesa texto con IA para interpretar gastos.
- No se agrega email/push sin opt-in claro.

**Validacion**

- `npx tsc --noEmit`
- `npm run lint`
- Manual con usuario de prueba:
  - crear cuenta;
  - crear gasto, cuenta, tarjeta, ingreso y transferencia si aplica;
  - ejecutar borrado;
  - verificar que datos asociados desaparecen o quedan anonimizados segun decision.

**Dependencias / bloqueos**

- Puede requerir revisar cascades/RLS en Supabase.
- Puede requerir SQL manual.
- Puede requerir decision de producto sobre retencion de logs/eventos analytics.

---

## 3. PBIs descartados de P0 por ahora

Estos items siguen siendo valiosos, pero no deberian bloquear el primer bloque P0:

| Item                              | Nueva prioridad sugerida | Motivo                                                    |
| --------------------------------- | ------------------------ | --------------------------------------------------------- |
| Disponible Real como hero default | P1                       | Requiere decision de producto y medicion.                 |
| Reduccion de onboarding           | P1                       | Importante, pero conviene instrumentar antes.             |
| SmartInput polish visual          | P1                       | Muy valioso, pero despues de baseline y errores criticos. |
| Filtro Estoico con consecuencias  | P2                       | Engagement, no fundacion.                                 |
| Presupuestos por categoria        | P2                       | Feature potente, pero necesita base financiera estable.   |
| Service worker real               | P2 reescrito             | Ya existe SW; falta hardening.                            |
| Monetizacion / MercadoPago        | P3                       | Antes conviene fake-door y activacion.                    |
| Push notifications                | P3                       | Depende de SW, permisos, metricas y timing de producto.   |
| Import CSV                        | P3                       | Alto impacto, alto riesgo, post-estabilizacion.           |
| Eliminar `lucide-react`           | P4                       | Higiene tecnica, no bloquea confianza core.               |

---

## 4. Definition of Done para cualquier PBI P0

Un PBI P0 se considera cerrado cuando:

- el alcance implementado coincide con el PBI, sin mezclar trabajo ajeno;
- hay validacion tecnica documentada;
- si toca logica financiera, hay tests o al menos casos manuales reproducibles;
- no se rompen comandos base:
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm test` si existe;
- se documenta cualquier limitacion o deuda remanente;
- no se modifican docs originales de audit/backlog sin signoff.

---

## 5. Propuesta de implementacion

Implementar en tandas pequenas:

1. P0-01 y P0-02 como instrumentacion.
2. P0-03 para abrir red de seguridad.
3. P0-04 y P0-05 como bloque financiero.
4. P0-06 como mejora de UX de errores.
5. P0-07 antes de cualquier lanzamiento publico.

Para cada PBI:

1. leer archivos relevantes;
2. confirmar alcance si aparece una decision abierta;
3. mostrar diff antes de editar archivos existentes;
4. implementar;
5. correr validaciones;
6. dejar resumen de cambios y riesgos.
