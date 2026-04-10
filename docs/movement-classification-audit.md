# Movement Classification Audit

**Fecha:** 2026-04-10  
**Objetivo:** documentar donde se clasifica hoy cada tipo de movimiento financiero en Gota, cuales son los criterios actuales, donde hay divergencia potencial, y que helpers conviene extraer antes de seguir refactorizando.

## 0. Estado implementado

Ya se implemento el primer bloque de adopcion:

- [movement-classification.ts](/C:/Users/Admin/Documents/gota/lib/movement-classification.ts)
- [rollover.ts](/C:/Users/Admin/Documents/gota/lib/rollover.ts)
- [route.ts](/C:/Users/Admin/Documents/gota/app/api/dashboard/route.ts)

Helpers ya creados:

- `isCardPayment`
- `isLegacyCardPayment`
- `isApplicableCardPayment`
- `isCreditAccruedExpense`
- `isPerceivedExpense`

## 1. Contexto

Despues de consolidar una parte del hero en `live-balance.ts`, el siguiente riesgo estructural mas importante sigue siendo la clasificacion de movimientos.

El problema no es solo que haya filtros repetidos.  
El problema es que varias reglas de negocio criticas todavia se deciden localmente en distintos archivos:

- que cuenta como gasto percibido
- que cuenta como gasto con tarjeta
- que cuenta como pago de tarjeta
- que pago de tarjeta reduce deuda pendiente y cual no
- que entra en rollover
- que entra en analytics

Si una de esas reglas cambia y no se actualiza en todos lados, aparecen divergencias silenciosas.

## 2. Archivos auditados

- [route.ts](/C:/Users/Admin/Documents/gota/app/api/dashboard/route.ts)
- [rollover.ts](/C:/Users/Admin/Documents/gota/lib/rollover.ts)
- [route.ts](/C:/Users/Admin/Documents/gota/app/api/analytics-data/route.ts)
- [route.ts](/C:/Users/Admin/Documents/gota/app/api/movimientos/route.ts)

## 3. Tipos de movimiento relevantes

Para esta auditoria, las clases importantes son:

- gasto percibido
- gasto con tarjeta devengado
- pago de tarjeta
- pago de tarjeta aplicable a deuda pendiente
- pago legacy de tarjeta
- ingreso
- transferencia

No todas tienen que compartirse igual, pero estas son las que hoy ya cruzan Home, tarjetas, rollover y analytics.

## 4. Criterios observados hoy

## A. Gasto percibido

Criterio observado:

- `payment_method` en `CASH | DEBIT | TRANSFER`
- `category !== 'Pago de Tarjetas'`

Donde aparece:

- [route.ts](/C:/Users/Admin/Documents/gota/app/api/dashboard/route.ts)
- [rollover.ts](/C:/Users/Admin/Documents/gota/lib/rollover.ts)
- [route.ts](/C:/Users/Admin/Documents/gota/app/api/movimientos/route.ts)

Lectura:

- la regla es consistente hoy
- pero esta hardcodeada varias veces

## B. Gasto con tarjeta devengado

Criterio observado:

- `payment_method === 'CREDIT'`
- `category !== 'Pago de Tarjetas'`

Donde aparece:

- [route.ts](/C:/Users/Admin/Documents/gota/app/api/dashboard/route.ts)
- [route.ts](/C:/Users/Admin/Documents/gota/app/api/analytics-data/route.ts)
- [route.ts](/C:/Users/Admin/Documents/gota/app/api/movimientos/route.ts)

Lectura:

- tambien es consistente hoy
- pero ya afecta deuda de tarjeta, analytics y filtros

## C. Pago de tarjeta

Criterio observado:

- `category === 'Pago de Tarjetas'`

Donde aparece:

- [route.ts](/C:/Users/Admin/Documents/gota/app/api/dashboard/route.ts)
- [rollover.ts](/C:/Users/Admin/Documents/gota/lib/rollover.ts)
- [route.ts](/C:/Users/Admin/Documents/gota/app/api/movimientos/route.ts)

Lectura:

- es la regla mas simple
- pero se mezcla con dos conceptos distintos:
  - pago de tarjeta como salida de caja
  - pago de tarjeta aplicable a deuda pendiente

## D. Pago de tarjeta aplicable a deuda pendiente

Criterio observado hoy en dashboard:

- `category === 'Pago de Tarjetas'`
- `is_legacy_card_payment IS NULL OR false`

Donde aparece:

- [route.ts](/C:/Users/Admin/Documents/gota/app/api/dashboard/route.ts)

Lectura:

- esta regla hoy solo vive en dashboard
- es critica para `Disponible Real`
- es el mejor ejemplo de clasificacion sensible todavia no compartida

## E. Pago legacy de tarjeta

Criterio observado:

- `category === 'Pago de Tarjetas'`
- `is_legacy_card_payment === true`

Donde aparece de forma operativa:

- [route.ts](/C:/Users/Admin/Documents/gota/app/api/dashboard/route.ts) por exclusion

Lectura:

- conceptualmente existe
- pero no esta expresado todavia como helper oficial

## F. Ingreso

Criterio observado:

- filas de `income_entries`

Donde aparece:

- [route.ts](/C:/Users/Admin/Documents/gota/app/api/dashboard/route.ts)
- [rollover.ts](/C:/Users/Admin/Documents/gota/lib/rollover.ts)
- [route.ts](/C:/Users/Admin/Documents/gota/app/api/analytics-data/route.ts)
- [route.ts](/C:/Users/Admin/Documents/gota/app/api/movimientos/route.ts)

Lectura:

- no es el punto mas riesgoso hoy

## G. Transferencia

Criterio observado:

- filas de `transfers`

Donde aparece:

- [route.ts](/C:/Users/Admin/Documents/gota/app/api/dashboard/route.ts)
- [rollover.ts](/C:/Users/Admin/Documents/gota/lib/rollover.ts)
- [route.ts](/C:/Users/Admin/Documents/gota/app/api/movimientos/route.ts)

Lectura:

- tampoco es el punto mas conflictivo
- el riesgo esta mas en su efecto por moneda que en su clasificacion base

## 5. Donde esta la divergencia potencial real

## A. Dashboard vs rollover

Hoy ambos comparten bastante criterio para:

- gasto percibido
- pago de tarjeta

Pero no comparten helpers.  
Si cambia la regla, hay que tocar ambos manualmente.

## B. Dashboard vs analytics

Analytics no calcula `Saldo Vivo`, pero si vuelve a decidir:

- que es gasto con tarjeta
- que no cuenta como `Pago de Tarjetas`
- como se mira el mes actual vs mes anterior

Eso puede generar diferencias de lectura entre:

- Home
- analytics mensual
- deuda de tarjeta

## C. Dashboard vs movimientos

Movimientos expone filtros de UX usando exactamente estas categorias:

- `percibido`
- `tarjeta`
- `pago_tarjeta`

Hoy esas etiquetas estan implementadas localmente con filtros sobre `expenses`.

Si dashboard cambia semantica y movimientos no, el usuario puede ver clasificaciones distintas segun pantalla.

## D. Pago legacy aplicable

Este es el caso mas delicado hoy.

Solo dashboard distingue explicitamente entre:

- pago de tarjeta comun
- pago de tarjeta legacy que no reduce deuda pendiente

Mientras esa regla no viva en un helper compartido, sigue siendo facil romper `Disponible Real`.

## 6. Helpers candidatos

La recomendacion no es una mega-funcion.  
Conviene extraer helpers chicos y composables.

Propuesta minima:

```ts
isCardPayment(expense)
isLegacyCardPayment(expense)
isApplicableCardPayment(expense)
isCreditAccruedExpense(expense)
isPerceivedExpense(expense)
```

Semantica sugerida:

- `isCardPayment`
  - `expense.category === 'Pago de Tarjetas'`

- `isLegacyCardPayment`
  - `isCardPayment(expense) && expense.is_legacy_card_payment === true`

- `isApplicableCardPayment`
  - `isCardPayment(expense) && expense.is_legacy_card_payment !== true`

- `isCreditAccruedExpense`
  - `expense.payment_method === 'CREDIT' && !isCardPayment(expense)`

- `isPerceivedExpense`
  - `expense.payment_method` en `CASH | DEBIT | TRANSFER` y no `Pago de Tarjetas`

## 7. Orden recomendado de adopcion

## Etapa 1

Estado: implementada

Usar helpers en:

- [route.ts](/C:/Users/Admin/Documents/gota/app/api/dashboard/route.ts)
- [rollover.ts](/C:/Users/Admin/Documents/gota/lib/rollover.ts)

Razon:

- son los dos lugares donde mas importa consistencia contable

## Etapa 2

Estado: siguiente bloque recomendado

Usar helpers en:

- [route.ts](/C:/Users/Admin/Documents/gota/app/api/movimientos/route.ts)

Razon:

- alinea labels y filtros de UI con la misma semantica oficial

## Etapa 3

Usar helpers en:

- [route.ts](/C:/Users/Admin/Documents/gota/app/api/analytics-data/route.ts)

Razon:

- analytics tiene parte de criterio propio por mes y tarjeta
- conviene tocarlo despues de estabilizar Home y movimientos

## 8. Lo que todavia no cubre esta extraccion

Aunque saquemos estos helpers, sigue pendiente:

- criterio temporal compartido
- primitives de resumen mensual
- logica de ciclos de tarjeta

O sea:

- esto baja una fuente grande de divergencia
- pero no reemplaza el resto de la consolidacion financiera

## 9. Recomendacion concreta

El siguiente cambio de codigo correcto seria:

1. crear un modulo de clasificacion en `lib/`
2. mover primero ahi las reglas de `dashboard` y `rollover`
3. mantener el alcance chico
4. no mezclar todavia clasificacion con fechas, ciclos o summary mensual

## 10. Conclusion

La clasificacion de movimientos ya muestra una semantica bastante estable.  
La deuda no es decidirla desde cero. La deuda es dejar de repetirla.

Hoy el caso mas sensible sigue siendo:

- `Pago de Tarjetas`
- `is_legacy_card_payment`
- deuda pendiente de tarjeta

Por eso tiene sentido que esta sea la siguiente primitive compartida despues del primer bloque de `live-balance`.
