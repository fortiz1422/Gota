# Gota — Features Financieras: Guía Holística

Este documento describe en detalle las cuatro features financieras centrales de Gota: cómo funcionan, cómo se modelan en la base de datos, cómo interactúan entre sí y cómo afectan el cálculo del **Saldo Vivo**.

---

## 1. Sugerencias de Pago de Tarjetas

### Qué es
Un sistema proactivo que detecta cuándo el usuario tiene una tarjeta de crédito próxima al vencimiento de pago y le sugiere registrar el pago en la app. No genera el pago automáticamente — requiere confirmación explícita.

### Problema que resuelve
El usuario registra gastos en cuotas y con tarjeta de crédito durante el mes, pero el impacto real en su liquidez ocurre cuando paga el resumen. Sin este aviso, el "Pago de Tarjetas" queda sin registrar y el Saldo Vivo aparece inflado.

### Modelo de datos
- `cards`: `closing_day` (día de cierre) y `due_day` (día de vencimiento de pago) por tarjeta.
- `expenses`: cuando `payment_method = 'CREDIT'` y `category != 'Pago de Tarjetas'` → son gastos que van al resumen.
- `expenses`: cuando `category = 'Pago de Tarjetas'` → es el pago del resumen al banco.

### Cómo funciona
1. El hook `useCardPaymentPrompts` se ejecuta en el dashboard con las tarjetas del usuario.
2. Para cada tarjeta, calcula el **período de facturación** en curso (desde el cierre anterior hasta el cierre actual).
3. Suma todos los gastos con crédito de ese período → `gastos_tarjeta`.
4. Si hoy está en la **ventana de pago** (entre cierre y vencimiento) y no existe ya un "Pago de Tarjetas" registrado en ese período → activa el prompt.
5. El componente `CardPaymentPrompt` aparece como un modal fijo en la parte inferior del dashboard, mostrando el monto calculado y permitiendo ajustarlo antes de confirmar.
6. Al confirmar, llama a `POST /api/expenses` con `category: 'Pago de Tarjetas'`.

### Impacto en Saldo Vivo
- Los gastos con crédito **no** restan del Saldo Vivo en el momento del gasto (están en `gastos_tarjeta`, mostrados aparte).
- El "Pago de Tarjetas" **sí** resta del Saldo Vivo (es `pago_tarjetas` en la fórmula).
- Fórmula: `Saldo Vivo = saldo_inicial + ingresos + rendimientos − gastos_percibidos − pago_tarjetas − capitalInstrumentos`

### Archivos clave
- `hooks/useCardPaymentPrompts.ts` — lógica de detección y cálculo del período
- `components/dashboard/CardPaymentPrompt.tsx` — UI del prompt
- `components/dashboard/DashboardShell.tsx` — integración (renderiza el prompt si `activePrompt` existe)

---

## 2. Rendimientos de Cuenta (Yield Accrual)

### Qué es
Un motor que estima y acumula el rendimiento diario de cuentas remuneradas (cuentas bancarias o billeteras digitales con tasa de interés), y lo incluye como ingreso estimado en el Saldo Vivo. El usuario puede confirmar el número real del banco o dejar que Gota lo estime.

### Problema que resuelve
Las cuentas remuneradas generan interés diario que queda fuera del Saldo Vivo si no se registra. Pedirle al usuario que cargue el rendimiento manualmente cada día es impracticable.

### Modelo de datos
- `accounts`: campos `daily_yield_enabled (boolean)` y `daily_yield_rate (DECIMAL, % TNA)`.
- `yield_accumulator`: una fila por cuenta por mes (`account_id`, `month`, `accumulated`, `is_manual_override`, `last_accrued_date`, `confirmed_at`).
  - `last_accrued_date`: última fecha procesada — garantiza idempotencia.
  - `confirmed_at`: si es `null`, el mes está en curso; si tiene fecha, el mes está cerrado y el valor es definitivo.
  - `is_manual_override`: el usuario ingresó el monto real del banco, no usar la estimación.

### Cómo funciona
1. Cada vez que el dashboard se carga, `processYieldAccrual` (en `lib/yieldEngine.ts`) se ejecuta en fire-and-forget.
2. Para cada cuenta con `daily_yield_enabled = true`, calcula los días transcurridos desde `last_accrued_date` hasta hoy.
3. Fórmula: `rendimiento_diario = saldo_cuenta × (TNA / 100 / 365)`. Acumula por los días transcurridos.
4. Hace upsert en `yield_accumulator` actualizando `accumulated` y `last_accrued_date`.
5. El dashboard suma todos los `accumulated` del mes → `rendimientosMes` → lo inyecta en el campo `rendimientos` del `saldo_vivo`.
6. En **Últimos movimientos**, aparece como un ítem especial (ícono `TrendUp` verde) con el monto acumulado y la etiqueta "en curso" o la fecha si ya está confirmado.
7. El usuario puede tocar el ítem para abrir un sheet e ingresar el monto real del banco → `PATCH /api/yield-accumulator/[id]` con `{ accumulated, is_manual_override: true }`.

### Impacto en Saldo Vivo
El campo `rendimientos` en `saldo_vivo` suma el yield acumulado del mes. Es aditivo al `saldo_inicial` e `ingresos`.

### Archivos clave
- `lib/yieldEngine.ts` — motor de accrual
- `app/api/yield-accumulator/[id]/route.ts` — PATCH para override manual
- `components/dashboard/Ultimos5.tsx` — renderiza el ítem yield + sheet de override
- `app/api/dashboard/route.ts` — calcula `rendimientosMes` e inyecta en `dashboardData`

---

## 3. Instrumentos — Plazo Fijo y FCI

### Qué es
Un módulo para registrar y hacer seguimiento de inversiones de capital cerrado: **plazos fijos** (con tasa TNA) y **fondos comunes de inversión** (FCI, con tasa mensual). Cada instrumento tiene un ciclo de vida completo: alta → activo → cierre.

### Problema que resuelve
Cuando el usuario invierte en un plazo fijo, ese capital "sale" de su cuenta y no debería contarse como saldo disponible. Al vencer, el capital más los intereses "vuelven". Sin este modelo, el Saldo Vivo aparece inflado durante la vida del instrumento.

### Modelo de datos
- `instruments`: `type` (plazo_fijo/fci), `label`, `amount`, `currency`, `rate`, `account_id` (cuenta de origen), `opened_at`, `due_date`, `status` (active/closed), `closed_at`, `closed_amount`.
- No crea un egreso en `expenses` — el impacto se modela directamente en Saldo Vivo.

### Ciclo de vida

#### Alta (POST /api/instruments)
- Se crea el instrumento con `status = 'active'`.
- No se genera ningún gasto. Gota deduce el capital del Saldo Vivo directamente (ver abajo).

#### Activo
- El instrumento figura en la card "En Instrumentos" del home.
- Aparece en la lista `/instrumentos` con días restantes, monto acumulado estimado del mes y alerta visual si vence en ≤ 5 días.
- El yield estimado se calcula como: PF: `amount × (rate / 100 / 365)` por día; FCI: `amount × (rate / 100 / 30)` por día.

#### Cierre (PATCH /api/instruments/[id] — actions)
Tres acciones posibles:

| Acción | Qué hace |
|---|---|
| **Vencimiento** | Crea `income_entry` con `closed_amount` (capital + intereses). Marca instrumento como `closed`. |
| **Rescate anticipado** | Igual que vencimiento pero con monto manual. |
| **Renovar** | Crea `income_entry` por `closed_amount` (para compensar el nuevo capital en Saldo Vivo). Cierra el instrumento viejo. Crea nuevo instrumento con `new_amount`. Redirige al detalle del nuevo. |

### Impacto en Saldo Vivo
- **Deducción**: Solo se restan los instrumentos abiertos **en el mes seleccionado**. Los instrumentos de meses anteriores ya están capturados en `saldo_inicial` gracias al rollover.
- `capitalInstrumentosMes = sum(amount)` de instrumentos activos con `opened_at` en el mes seleccionado y misma moneda.
- **Renovar — doble entrada**: Al renovar, el `income_entry` del `closed_amount` cancela exactamente la deducción del nuevo instrumento, dejando el Saldo Vivo neutro (el usuario no "perdió" ni "ganó" en términos de liquidez, solo reinvirtió).

### Archivos clave
- `app/api/instruments/route.ts` — POST (alta)
- `app/api/instruments/[id]/route.ts` — PATCH (close / renovar / edit)
- `components/instruments/InstrumentForm.tsx` — formulario de alta
- `components/instruments/InstrumentosCard.tsx` — card en Home
- `components/instruments/InstrumentosPageClient.tsx` — lista `/instrumentos`
- `components/instruments/InstrumentoDetailClient.tsx` — detalle + action sheets
- `app/(dashboard)/instrumentos/page.tsx` — server component lista
- `app/(dashboard)/instrumentos/[id]/page.tsx` — server component detalle
- `components/dashboard/DashboardShell.tsx` — pasa `capitalInstrumentosMes` a `SaldoVivo`

---

## 4. Ingresos Recurrentes

### Qué es
Un sistema de recordatorio para ingresos que se repiten mensualmente (sueldo, freelance, alquiler cobrado). No acredita automáticamente — en el día esperado muestra un banner en el Home preguntando si el ingreso fue recibido. El usuario decide cuándo registrarlo.

### Problema que resuelve
El usuario tiene que acordarse de registrar su sueldo cada mes. Si lo olvida, el Saldo Vivo aparece en cero o negativo, lo que genera confusión. El sistema actúa como un nudge en el momento correcto sin interferir con el control del usuario.

### Modelo de datos
- `recurring_incomes`: `amount`, `currency`, `category`, `description`, `account_id`, `day_of_month` (1–28), `is_active`.
- `income_entries.recurring_income_id` (FK nullable): vincula cada entrada de ingreso a su config recurrente.

### Cómo se crea
En el `IncomeModal`, al registrar un ingreso, hay un toggle **"Repetir cada mes"** (colapsado por defecto). Al activarlo aparece un input "Día del mes". Al guardar:
1. Se crea el registro en `recurring_incomes`.
2. Se crea el `income_entry` con `recurring_income_id` apuntando a la config.

### Cómo funciona el recordatorio
1. El dashboard API calcula `recurringPending`: configs activas donde `day_of_month ≤ hoy` y no existe ningún `income_entry` con ese `recurring_income_id` en el mes actual.
2. `RecurringIncomeBanner` renderiza un banner por cada ítem pendiente (solo en mes en curso).
3. **[Registrar →]**: abre el `IncomeModal` pre-llenado con amount, currency, category, description y cuenta. Al guardar, el ingreso queda linkeado a la config via `recurring_income_id`.
4. **[No por ahora]**: guarda `rec_dismissed_{id}_{fecha}` en `localStorage` → oculta el banner por el resto del día. Al día siguiente vuelve a aparecer si aún no se registró.

### Gestionar desde el feed
Los `income_entry` que tienen `recurring_income_id` (y cuya config está activa) muestran un ícono `ArrowsClockwise` azul en Últimos movimientos. Tocar el ícono abre un sheet "Gestionar recurrente" que muestra:
- Monto esperado y día del mes de la config.
- Botón **[Desactivar recordatorio]** → `PATCH /api/recurring-incomes/[id]` con `{ is_active: false }` → el banner ya no aparece.

### Impacto en Saldo Vivo
Ninguno directo. Los `income_entry` creados a partir de un recurrente son idénticos a cualquier otro ingreso — suman a `ingresos` en la fórmula del Saldo Vivo. La recurrencia es solo una capa de UX.

### Archivos clave
- `app/api/income-entries/route.ts` — POST extendido: acepta `recurring` (crea config) o `recurring_income_id` (linkea a existente)
- `app/api/recurring-incomes/[id]/route.ts` — PATCH (desactivar / editar config)
- `components/dashboard/IncomeModal.tsx` — toggle "Repetir cada mes" + input día; acepta `prefill` y `recurringIncomeId`
- `components/dashboard/RecurringIncomeBanner.tsx` — banner de sugerencia en Home
- `components/dashboard/DashboardShell.tsx` — renderiza el banner, pasa `activeRecurring` a Ultimos5
- `components/dashboard/Ultimos5.tsx` — ícono Gestionar + sheet de desactivación

---

## Interacciones entre features

```
income_entries
  ├── recurring_income_id → recurring_incomes   (ingresos recurrentes)
  └── category = 'other'  ← instruments PATCH   (retorno de capital al vencer/renovar)

expenses
  └── category = 'Pago de Tarjetas'  ← CardPaymentPrompt

yield_accumulator
  └── account_id → accounts (daily_yield_enabled / daily_yield_rate)

instruments
  └── account_id → accounts (cuenta de origen)
```

### Fórmula completa del Saldo Vivo

```
Saldo Vivo =
    saldo_inicial                  (account_period_balance del mes)
  + ingresos                       (income_entries del mes, incluye retornos de PF/FCI)
  + rendimientos                   (yield_accumulator acumulado del mes)
  − gastos_percibidos              (expenses CASH/DEBIT/TRANSFER, excluye Pago de Tarjetas)
  − pago_tarjetas                  (expenses con category = 'Pago de Tarjetas')
  − capitalInstrumentosMes         (instruments abiertos en el mes seleccionado)
```

**Nota sobre `capitalInstrumentosMes`**: solo se restan instrumentos abiertos en el mes visualizado. Los instrumentos de meses anteriores ya están reflejados en `saldo_inicial` vía rollover, evitando doble conteo.

---

## Resumen de tablas nuevas

| Tabla | Feature | Descripción |
|---|---|---|
| `instruments` | Plazo Fijo / FCI | Ciclo de vida de inversiones de capital cerrado |
| `yield_accumulator` | Rendimientos | Acumulado mensual de yield por cuenta remunerada |
| `recurring_incomes` | Ingresos Recurrentes | Config de ingresos que se repiten mensualmente |
| `cards.closing_day` | Pago Tarjetas | Día de cierre para calcular período de facturación |
| `income_entries.recurring_income_id` | Ingresos Recurrentes | FK que linkea ingresos a su config recurrente |
