# Logica de Calculo Contable

## Objetivo

Este documento describe como calcula hoy Gota los saldos principales y cual es la direccion de producto buscada.

La separacion clave es:

- `Saldo Vivo`: cuanto dinero real tiene el usuario ahora
- `Analytics / Movimientos / Resumenes`: que paso dentro de un periodo

## Principios de modelo

### 1. Saldo base por cuenta

Cada cuenta tiene:

- `opening_balance_ars`
- `opening_balance_usd`

Ese valor representa el punto de partida historico de la cuenta dentro de la app.

Regla de producto:

- se define al crear la cuenta
- luego el saldo se mueve por registros contables
- no deberia recalcularse mes a mes

### 2. Movimientos contables

Los movimientos que modifican saldo son:

- `income_entries`
- `expenses`
- `transfers`
- `yield_accumulator`
- `instruments` activos o cerrados

### 3. Datos periodizados

Las estructuras mensuales son:

- `monthly_income`
- `account_period_balance`
- `rollover_mode`

Su funcion deberia ser:

- analytics
- snapshots mensuales
- reporting
- features auxiliares de periodo

No deberian ser la fuente de verdad final de `Saldo Vivo`.

## Formula de Saldo Vivo

Conceptualmente:

`Saldo Vivo = saldo inicial historico + ingresos acumulados + rendimientos acumulados - gastos directos - pagos de tarjeta + ajuste por transferencias - capital inmovilizado`

En la UI del home, el hero usa esta composicion:

`saldo_inicial + ingresos + rendimientos - gastos_percibidos - pago_tarjetas + transferAdjustment - capitalInstrumentos`

## Impacto por tipo de registro

### Cuentas

Tabla: `accounts`

Impacto:

- definen el saldo base historico
- sirven como destino de ingresos, gastos, transferencias y rendimientos
- si un movimiento no tiene `account_id`, hoy suele asignarse a la cuenta primaria

### Ingresos

Tabla: `income_entries`

Impacto:

- suman saldo a una cuenta
- impactan `Saldo Vivo`
- impactan breakdown por cuenta
- aparecen en movimientos

### Gastos directos

Tabla: `expenses`

Medios: `CASH`, `DEBIT`, `TRANSFER`

Impacto:

- bajan `Saldo Vivo`
- bajan breakdown por cuenta
- aparecen en analytics y movimientos

### Gastos con tarjeta

Tabla: `expenses`

Medio: `CREDIT`

Impacto:

- no bajan `Saldo Vivo` en el momento del consumo
- si bajan `Disponible Real`
- forman parte del resumen de tarjeta

### Pago de tarjetas

Tabla: `expenses`

Categoria: `Pago de Tarjetas`

Impacto:

- si baja `Saldo Vivo`
- baja la cuenta desde la que se paga
- contablemente convierte deuda de tarjeta en salida real de caja

### Transferencias

Tabla: `transfers`

Impacto:

- misma moneda: no cambian el total consolidado, solo distribucion entre cuentas
- distinta moneda: cambian el total por moneda vista
- siempre ajustan balances por cuenta

### Rendimientos

Tabla: `yield_accumulator`

Impacto:

- suman saldo vivo en ARS
- suman a la cuenta asociada
- hoy el motor de calculo diario todavia usa una base mensual en algunos casos

### Instrumentos

Tabla: `instruments`

Impacto:

- un instrumento activo representa capital inmovilizado
- en home ese capital se descuenta del saldo liquido
- cuando se cierra o renueva, vuelve como `income_entry` a la cuenta si corresponde

### Suscripciones

Tablas: `subscriptions`, `subscription_insertions`

Impacto:

- no son un tipo contable aparte
- generan filas en `expenses`
- por lo tanto impactan como gasto comun

## Home

Endpoint principal: `app/api/dashboard/route.ts`

Componentes principales:

- `components/dashboard/SaldoVivo.tsx`
- `components/dashboard/DashboardShell.tsx`
- `app/api/dashboard/account-breakdown/route.ts`

### Que muestra Home

Home mezcla:

- `Saldo Vivo`
- `Disponible Real`
- breakdown por cuenta
- gastos de tarjeta del periodo
- ultimos movimientos
- filtros y analytics mensuales
- prompts de tarjetas, suscripciones, ingresos recurrentes

### Diferencia entre Saldo Vivo y Disponible Real

- `Saldo Vivo`: dinero real consolidado
- `Disponible Real`: `Saldo Vivo - gasto con tarjeta aun no debitado`

## Breakdown por cuenta

Endpoint: `app/api/dashboard/account-breakdown/route.ts`

Logica actual:

- base por cuenta: `accounts.opening_balance_ars/usd`
- suma ingresos acumulados
- resta gastos directos y pagos de tarjeta
- suma rendimiento acumulado en ARS
- aplica transferencias entrantes y salientes

Objetivo funcional:

- explicar por cuenta el mismo numero que se ve en `Saldo Vivo`

## Que sigue siendo mensual

Aunque `Saldo Vivo` debe ser historico acumulado, estas vistas siguen siendo periodizadas:

- `ultimos_5`
- `filtro_estoico`
- `top_3`
- `movimientos`
- `analytics-data`
- `card-resumen`

Eso es correcto porque responden otra pregunta:

`que paso en este periodo`

## Estado de transicion

Hoy el codigo todavia tiene mezcla entre modelo nuevo e infraestructura legacy:

- `monthly_income` sigue existiendo
- `account_period_balance` sigue existiendo
- `rollover` sigue presente en partes del home
- el motor de yield todavia usa base mensual

Direccion objetivo:

1. `Saldo Vivo` y breakdown deben depender de `opening_balance + movimientos`
2. `account_period_balance` debe quedar como snapshot derivado para analytics
3. `monthly_income` debe quedar solo como dato auxiliar si sigue teniendo valor de UX
4. `rollover` no deberia ser necesario para el calculo contable principal

## Regla de producto recomendada

La fuente de verdad final deberia ser:

`saldo inicial de cuenta + ledger historico de movimientos`

Y los snapshots mensuales deberian calcularse desde backend como datos derivados.

## Fuente de Verdad por Entidad

### `accounts`

Estado deseado:

- fuente de verdad del saldo base
- contiene el punto de partida historico por cuenta

No deberia representar snapshots mensuales ni cierre de periodo.

### `income_entries`

Estado deseado:

- fuente de verdad de ingresos reales
- cada fila debe impactar saldo y cuenta

### `expenses`

Estado deseado:

- fuente de verdad de egresos reales
- el impacto depende de `payment_method` y `category`

### `transfers`

Estado deseado:

- fuente de verdad de movimientos entre cuentas
- ajusta distribucion por cuenta y, cuando cambia la moneda, total consolidado por moneda

### `yield_accumulator`

Estado deseado:

- derivado operativo con impacto contable real
- debe poder reconstruirse o reconciliarse desde una base clara

Nota:

- hoy tiene impacto contable, pero su motor todavia no esta completamente alineado al modelo historico puro

### `instruments`

Estado deseado:

- fuente de verdad del capital inmovilizado
- mientras un instrumento esta activo, ese capital no deberia contarse como liquidez disponible

### `monthly_income`

Estado deseado:

- dato auxiliar o legacy
- no deberia ser la fuente de verdad del saldo
- solo deberia sobrevivir si sigue teniendo valor para UX o analytics

### `account_period_balance`

Estado deseado:

- snapshot derivado mensual por cuenta
- util para reporting, analytics y comparativas
- no deberia ser la fuente de verdad principal de `Saldo Vivo`

### `rollover_mode`

Estado deseado:

- feature opcional de cierre o snapshot de periodo, si se mantiene
- no deberia condicionar el calculo contable principal del home

## Decisiones Pendientes

### 1. Futuro de `monthly_income`

Hay que decidir si:

- se elimina del calculo de home y queda solo como legacy
- o se preserva como input mensual de UX para otras pantallas

### 2. Futuro de `account_period_balance`

Hay que decidir si:

- se genera solo desde backend como snapshot derivado
- o sigue existiendo ademas como superficie editable/manual

La recomendacion de producto es que quede derivado.

### 3. Motor de yield

Hay que alinear `yield_accumulator` con el modelo final.

Pendiente:

- definir si el rendimiento diario parte de `opening_balance + ledger`
- o de un snapshot mensual derivado

La direccion recomendada es que el modelo sea coherente con la verdad contable principal.

### 4. Instrumentos en breakdown por cuenta

Hoy Home resta capital inmovilizado en el hero, pero esa semantica debe quedar explicitamente reflejada en el detalle por cuenta o en una capa separada.

Hay que decidir si:

- el breakdown muestra saldo liquido
- o muestra saldo contable bruto y luego una linea separada de capital inmovilizado

### 5. Movimientos sin `account_id`

Hoy suelen resolverse a la cuenta primaria.

Hay que decidir si:

- se mantiene esa regla
- se obliga a toda nueva alta a tener cuenta
- o se migra historico sin cuenta a una cuenta explicita

### 6. Futuro de `rollover`

Hay que decidir si:

- se elimina completamente del home
- se deja solo para snapshots/cierre mensual
- o se mantiene como feature secundaria avanzada

La recomendacion de producto es que no participe del calculo principal de `Saldo Vivo`.
