# Codex - Work Items P0-04 y P0-05 Gota 21.4

**Fecha:** 2026-04-21
**Base:** `docs/Codex - Backlog P0 Detallado Gota 21.4.md`
**Objetivo:** dejar dos work items completos y revisables para cerrar el bloque financiero de pagos legacy, `Disponible Real` y deuda pendiente de tarjetas.

Estos work items estan pensados para implementarse despues de P0-03. La suite inicial de tests ya existe, por lo que cualquier cambio de logica financiera debe entrar con tests.

---

## Estado real observado en codigo

Archivos revisados:

- `schema.sql`
- `types/database.ts`
- `lib/movement-classification.ts`
- `lib/server/dashboard-queries.ts`
- `components/dashboard/DisponibleRealSheet.tsx`
- `components/dashboard/SaldoVivo.tsx`
- `components/dashboard/CardPaymentForm.tsx`
- `app/(dashboard)/tarjetas/[cardId]/LegacyCardPaymentModal.tsx`
- `app/(dashboard)/tarjetas/[cardId]/PagarResumenModal.tsx`
- `lib/card-summaries.ts`
- `lib/analytics/computeResumen.ts`
- `docs/disponible-real-deuda-legacy-tarjetas.md`
- `docs/supabase-legacy-card-payment-migration.sql`
- `docs/roadmap-deudas-tecnicas-y-negocio.md`

Estado actual:

- `is_legacy_card_payment` ya existe en `schema.sql` y `types/database.ts`.
- `lib/movement-classification.ts` ya distingue:
  - pago de tarjeta;
  - pago legacy;
  - pago aplicable;
  - gasto CREDIT devengado;
  - gasto percibido.
- `LegacyCardPaymentModal` ya crea `Pago de Tarjetas` con `is_legacy_card_payment: true`.
- `PagarResumenModal` crea `Pago de Tarjetas` sin flag explicito. Hoy eso funciona porque `null` se trata como aplicable.
- `CardPaymentForm` tambien crea `Pago de Tarjetas` sin flag explicito. Hoy eso tambien queda aplicable por regla `null => aplicable`.
- `readDashboardData` calcula deuda pendiente en TypeScript como:
  - CREDIT no `Pago de Tarjetas`;
  - menos pagos de tarjeta no legacy;
  - clamp a `>= 0`.
- Esa formula todavia vive localmente en `lib/server/dashboard-queries.ts`.
- El SQL historico en `schema.sql` todavia contiene versiones de `get_dashboard_data` que pueden divergir de la semantica runtime si se usan directo.

Riesgo principal:

- La semantica correcta existe en partes, pero todavia no esta concentrada en una primitive pura. Eso deja margen para que dashboard, tarjetas, analytics o futuras rutas calculen distinto.

---

## WI P0-04 - Cerrar pagos legacy y Disponible Real

### Tipo

Bugfix financiero + hardening de semantica.

### Problema

Los pagos legacy de tarjeta representan plata que salio de la cuenta, por lo que deben bajar `Saldo Vivo`. Pero no deben cancelar deuda pendiente de tarjetas generada por consumos que Gota si registro.

Si un pago legacy se trata como pago aplicable, `Disponible Real` queda artificialmente alto. Si no baja `Saldo Vivo`, la caja real queda artificialmente alta. Ambos casos rompen confianza.

### Regla de producto

- Todo `Pago de Tarjetas` baja `Saldo Vivo`.
- `is_legacy_card_payment = true` baja `Saldo Vivo`, pero no reduce deuda pendiente.
- `is_legacy_card_payment = false` o `null` reduce deuda pendiente.
- `Disponible Real = Saldo Vivo - deuda_pendiente_tarjetas`.
- `deuda_pendiente_tarjetas` nunca debe ser menor que cero.

### Alcance

1. Confirmar y blindar que todo flujo que crea pago legacy mande `is_legacy_card_payment: true`.
2. Hacer explicitos los flujos aplicables:
   - `PagarResumenModal`: mandar `is_legacy_card_payment: false`.
   - `CardPaymentForm`: mandar `is_legacy_card_payment: false` si sigue siendo un flujo soportado.
3. Agregar tests que demuestren:
   - pago legacy baja `Saldo Vivo`;
   - pago legacy no es pago aplicable;
   - pago aplicable si reduce deuda pendiente;
   - `null` mantiene compatibilidad legacy como pago aplicable.
4. Revisar `schema.sql` para que la version vigente de `get_dashboard_data` documente y/o refleje la exclusion de pagos legacy.
5. Dejar SQL manual separado, sin ejecutarlo desde este work item.

### Fuera de alcance

- Ejecutar SQL real en Supabase.
- Etiquetar pagos historicos reales.
- Redisenar el flujo de tarjetas.
- Crear una tabla nueva de pagos de tarjeta.
- Cambiar la categoria `Pago de Tarjetas`.

### Archivos a tocar

Probables:

- `app/(dashboard)/tarjetas/[cardId]/PagarResumenModal.tsx`
- `components/dashboard/CardPaymentForm.tsx`
- `schema.sql`
- `lib/movement-classification.test.ts`
- `lib/live-balance.test.ts`

Posibles, solo si aparece una brecha:

- `app/(dashboard)/tarjetas/[cardId]/LegacyCardPaymentModal.tsx`
- `docs/disponible-real-deuda-legacy-tarjetas.md`
- `docs/supabase-legacy-card-payment-migration.sql`

### Tests esperados

Extender `lib/movement-classification.test.ts`:

- `isLegacyCardPayment` solo true con flag true.
- `isApplicableCardPayment` true con flag false.
- `isApplicableCardPayment` true con flag null por compatibilidad.
- `isApplicableCardPayment` false con flag true.

Extender `lib/live-balance.test.ts`:

- un pago legacy incluido en `cardPayments` reduce el balance de la cuenta igual que cualquier pago de tarjeta.

Si WI P0-05 se implementa inmediatamente despues, mover los tests de deuda pendiente a `lib/card-debt.test.ts`.

### Criterios de aceptacion

- La regla legacy queda documentada en tests.
- Los flujos de pago aplicable mandan flag explicito `false` o queda documentado por que `null` sigue siendo intencional.
- El flujo de pago legacy manda `true`.
- `Saldo Vivo` sigue descontando todos los pagos de tarjeta.
- La deuda pendiente usada por `Disponible Real` ignora pagos legacy.
- `npm test` pasa.
- `npx tsc --noEmit` pasa.
- Si `npm run lint` falla por deuda previa, se deja listado sin mezclar ese cleanup.

### Validacion manual diferida

Cuando haya tiempo para SQL/Supabase:

1. Correr `docs/supabase-legacy-card-payment-migration.sql` o una version revisada.
2. Marcar pagos historicos legacy reales.
3. Verificar:
   - consumo CREDIT 100 + pago aplicable 100 => deuda pendiente 0;
   - pago legacy 100 sin consumo original => `Saldo Vivo` baja y deuda pendiente no cambia;
   - deuda pendiente no queda negativa.

### Riesgos

- `schema.sql` contiene multiples versiones historicas de `get_dashboard_data`; hay que editar con cuidado la version vigente y no asumir que todas se ejecutan.
- `PagarResumenModal` tambien actualiza `card_cycles`; si se toca ese flujo, no cambiar semantica de `paid`, `amount_paid` ni `paid_at`.
- `CardPaymentForm` puede ser una superficie generica legacy; antes de removerla hay que confirmar usos. Para este work item solo conviene explicitar el flag.

---

## WI P0-05 - Consolidar gastosTarjeta y pagos aplicables

### Tipo

Refactor financiero acotado + primitive pura testeable.

### Problema

La deuda pendiente de tarjetas (`gastos_tarjeta` en `DashboardData`) se calcula localmente en `lib/server/dashboard-queries.ts`. La formula actual es correcta en intencion, pero esta embebida en una query de servidor grande.

Eso genera riesgo de divergencia:

- otra pantalla puede volver a calcular deuda con otra regla;
- el SQL/RPC puede quedar con formula vieja;
- los tests no pueden cubrir facilmente la semantica central;
- futuros cambios en pagos legacy o cuotas pueden romper `Disponible Real`.

### Objetivo

Crear una primitive pura, por ejemplo `lib/card-debt.ts`, que sea la fuente canonica para calcular deuda pendiente de tarjetas.

### API sugerida

```ts
type CardDebtMovement = {
  amount: number
  currency: 'ARS' | 'USD'
  category: string
  payment_method: 'CASH' | 'DEBIT' | 'TRANSFER' | 'CREDIT'
  is_legacy_card_payment?: boolean | null
  card_id?: string | null
}

type CardDebtSummary = {
  creditAccrued: number
  applicablePayments: number
  legacyPayments: number
  pendingDebt: number
}

function calculateCardDebtSummary(
  movements: CardDebtMovement[],
  currency: 'ARS' | 'USD'
): CardDebtSummary
```

Reglas:

- `creditAccrued`: suma `payment_method === 'CREDIT'` y `category !== 'Pago de Tarjetas'`.
- `applicablePayments`: suma `category === 'Pago de Tarjetas'` y no legacy.
- `legacyPayments`: suma `category === 'Pago de Tarjetas'` y legacy.
- `pendingDebt = max(0, creditAccrued - applicablePayments)`.
- La moneda filtra antes de sumar.
- Los pagos legacy no participan en `pendingDebt`.

Extension opcional si conviene:

```ts
function calculateCardDebtByCard(
  movements: CardDebtMovement[],
  currency: 'ARS' | 'USD'
): Record<string, CardDebtSummary>
```

No implementar breakdown por tarjeta salvo que el reemplazo actual lo necesite. Mantener el work item chico.

### Alcance

1. Crear `lib/card-debt.ts`.
2. Agregar `lib/card-debt.test.ts`.
3. Reemplazar la formula local de `liveCreditoDevengado`, `livePagoTarjetasAplicables` y `liveGastosTarjeta` en `lib/server/dashboard-queries.ts` por la primitive.
4. Reutilizar `movement-classification` dentro de la primitive para no duplicar semantica.
5. Mantener el shape publico de `DashboardData.gastos_tarjeta`.
6. Revisar `schema.sql` para que la version vigente del RPC no contradiga la regla. Si no se cambia el RPC real ahora, dejar comentario claro de que runtime lo sobrescribe con la primitive.

### Fuera de alcance

- Reescribir `readDashboardData`.
- Cambiar queries grandes del dashboard salvo los selects necesarios para alimentar la primitive.
- Cambiar UX de `Disponible Real`.
- Crear una tabla nueva de deuda o pagos.
- Reconciliar automaticamente pagos con ciclos especificos.
- Ejecutar SQL en Supabase.

### Archivos a tocar

Probables:

- `lib/card-debt.ts`
- `lib/card-debt.test.ts`
- `lib/server/dashboard-queries.ts`
- `schema.sql`

Posibles:

- `lib/movement-classification.ts` si hace falta ampliar tipos.
- `types/database.ts` solo si aparece una falta de tipos, no esperado.
- `components/dashboard/DisponibleRealSheet.tsx` solo si se mejora copy para alinear con la nueva primitive, no necesario para cerrar.

### Tests obligatorios

`lib/card-debt.test.ts` debe cubrir:

- sin movimientos => todo cero;
- gastos CREDIT sin pagos => deuda igual a credito devengado;
- pagos aplicables parciales => deuda restante;
- pagos aplicables completos => deuda cero;
- exceso de pagos aplicables => deuda cero, no negativa;
- pagos legacy ignorados para deuda;
- pagos legacy contabilizados en `legacyPayments`;
- mezcla ARS/USD => solo cuenta moneda seleccionada;
- `Pago de Tarjetas` con flag `null` => aplicable por compatibilidad;
- movimientos no CREDIT y no `Pago de Tarjetas` => ignorados para deuda.

### Criterios de aceptacion

- Existe `lib/card-debt.ts` como primitive pura.
- `dashboard-queries.ts` deja de contener la formula financiera principal de deuda pendiente.
- La deuda pendiente no puede ser reducida por pagos legacy.
- La deuda pendiente nunca baja de cero.
- La semantica de `null` como pago aplicable queda cubierta por tests.
- `npm test` pasa.
- `npx tsc --noEmit` pasa.
- `npm run lint` no introduce errores nuevos en los archivos tocados.

### Riesgos

- La query actual trae `liveAppliedCardPaymentData` y `liveCreditExpenseData` por separado. Para alimentar la primitive se puede:
  - mantener dos queries y normalizar a un arreglo comun;
  - o hacer una unica query de movimientos relevantes.
- La opcion de una unica query simplifica el modelo, pero puede tocar mas codigo. Recomendacion: mantener cambios minimos y normalizar los resultados existentes en memoria.
- El nombre `gastos_tarjeta` ya no significa "gastos con tarjeta del mes"; hoy representa deuda pendiente. No renombrar en este work item porque afectaria UI/tipos, pero dejar comentario si hace falta.

---

## Orden recomendado de implementacion

1. WI P0-04:
   - hacer explicitos los flags;
   - agregar tests de clasificacion y Saldo Vivo;
   - ajustar doc/schema si corresponde.
2. WI P0-05:
   - crear primitive `card-debt`;
   - reemplazar formula local en dashboard;
   - cubrir deuda pendiente con tests.
3. Validar:
   - `npm test`;
   - `npx tsc --noEmit`;
   - `npm run lint` y registrar deuda previa si sigue fallando.

No mezclar con:

- P0-06 (`alert()`);
- SQL manual real;
- limpieza de lint global;
- cambios visuales de tarjetas.

---

## Preguntas de revision

1. Confirmar si `CardPaymentForm` sigue siendo una superficie oficial o legacy. Si sigue, conviene marcar `is_legacy_card_payment: false` explicitamente.
2. Confirmar si `PagarResumenModal` debe seguir usando `null` por compatibilidad o pasar a `false` explicito. Recomendacion: `false`.
3. Confirmar si en este bloque se actualiza solo `schema.sql` o tambien se crea una migracion SQL nueva para alinear `get_dashboard_data`. Recomendacion: crear/actualizar SQL, pero no ejecutarlo hasta la ventana de Supabase.
4. Confirmar si `gastos_tarjeta` se mantiene como nombre tecnico temporal aunque semantically sea `pendingCardDebt`. Recomendacion: mantener nombre para reducir blast radius.
