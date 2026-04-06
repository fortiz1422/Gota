# Diagnóstico: Saldo Vivo y contexto de fecha — Abril 2026

## Síntoma reportado

El usuario cargaba gastos de BBVA (cuenta no primaria) y Saldo Vivo no los reflejaba.
Investigación inicial apuntó a un problema de cuenta secundaria sin apertura en `account_period_balance`,
pero el bug real era diferente.

---

## Causa raíz identificada

Saldo Vivo está calculado con filtro de mes calendario:

```sql
-- get_dashboard_data (schema.sql)
AND DATE_TRUNC('month', date) = DATE_TRUNC('month', p_month)
```

Esto aplica a `ingresos`, `gastos_percibidos` y `pago_tarjetas`.

Consecuencias:
- Gastos cargados con fecha de marzo **no impactan** el Saldo Vivo de abril.
- La app ya no tiene navegador de período en home — Saldo Vivo se concibió como balance corriente, no mensual.
- La implementación contradice el diseño: el SQL sigue siendo mensual aunque la UI no navega períodos.

El mismo problema existe en:
- `app/api/dashboard/route.ts` → `transferCurrencyAdjustment`, `rendimientosMes`, `capitalInstrumentosMes` (todos filtran por mes)
- `app/api/dashboard/account-breakdown/route.ts` → todas las queries de income/expenses/transfers filtran por mes

---

## Por qué el rollover automático lo "arregla"

Con `rollover_mode = 'auto'`, al comenzar un mes nuevo:

1. `buildSmartPerAccountBalances()` calcula el saldo final real del mes anterior por cuenta.
2. Ese saldo se usa como `effectiveSaldoInicial` para el mes actual, sobreescribiendo el `saldo_inicial` del SQL.
3. Los gastos de meses anteriores quedan "incorporados" en el saldo de apertura del nuevo mes.

O sea: **rollover automático no elimina el filtro mensual, lo compensa** — hace que el saldo inicial del mes actual sea el cierre del mes anterior, absorbiendo indirectamente todos los gastos previos.

Con rollover `off`: los meses son compartimentos estancos. Un gasto de marzo nunca aparece en el Saldo Vivo de abril.

---

## Fix correcto a implementar (pendiente)

Cambiar Saldo Vivo a balance corriente real, sin filtro de mes:

### 1. `get_dashboard_data` (SQL)
- `saldo_inicial`: leer `SUM(accounts.opening_balance_ars)` en lugar de `account_period_balance`
- `ingresos`: `date <= CURRENT_DATE` (sin corte de mes)
- `gastos_percibidos`: ídem
- `pago_tarjetas`: ídem
- Las otras secciones (top_3, filtro_estoico, ultimos_5) mantienen filtro de mes — solo el bloque `saldo_vivo` cambia

### 2. `app/api/dashboard/route.ts`
- `transferCurrencyAdjustment`: queries de transfers sin corte de mes
- `rendimientosMes`: sum de todos los `yield_accumulator` sin filtro de mes
- `capitalInstrumentosMes`: todos los instrumentos activos, no solo los del mes

### 3. `app/api/dashboard/account-breakdown/route.ts`
- `openingMap`: usar `accounts.opening_balance_ars/usd` en lugar de `account_period_balance`
- `incomeData`, `debitExpData`, `cardPayData`, `transfersData`: `date <= today`, sin lower bound mensual
- `yieldData`: sum de todos los meses, sin filtro de `month = queryMonth`

---

## Pregunta abierta: ¿rollover automático como default?

### A favor
- Compensa el bug de filtrado mensual sin necesitar el fix completo
- Nuevo usuario que no configura nada ve un Saldo Vivo coherente entre meses
- La lógica de `buildSmartPerAccountBalances` ya funciona correctamente para multicuenta

### En contra
- Es un workaround, no el fix correcto
- Requiere que `account_period_balance` esté poblado correctamente para el mes anterior — si un usuario no tiene datos del mes anterior, el rollover no tiene de dónde partir
- Oculta el problema: la implementación sigue siendo mensual cuando debería ser corriente
- Usuario nuevo en su primer mes: rollover auto no cambia nada (no hay mes anterior)

### Recomendación
Implementar el fix correcto (Saldo Vivo sin filtro mensual) **y** mantener rollover auto como default para usuarios nuevos. Son complementarios: el fix correcto resuelve el modelo de datos, rollover auto tiene utilidad propia (proyección al mes siguiente, historial mensual visible en analíticas).

---

## Fix colateral aplicado en esta sesión

`app/api/accounts/route.ts` (POST): al crear una cuenta nueva con saldo de apertura > 0, ahora se escribe automáticamente en `account_period_balance` para el mes actual. Antes ese valor quedaba solo en `accounts.opening_balance_ars` y el SQL de Saldo Vivo no lo veía.

**Limitación**: BBVA (y cualquier cuenta creada antes de este fix) necesita insert manual en `account_period_balance` para el período correspondiente.
