# Financial Consolidation Status And Next Step

**Fecha:** 2026-04-10  
**Objetivo:** resumir el estado actual del frente de consolidacion financiera, los updates ya aplicados, y la recomendacion concreta de implementacion siguiente para revisar externamente.

## 1. Updates ya aplicados

### Docs creados o actualizados

- [financial-logic-consolidation-audit.md](/C:/Users/Admin/Documents/gota/docs/financial-logic-consolidation-audit.md)
- [live-balance-dashboard-gap-analysis.md](/C:/Users/Admin/Documents/gota/docs/live-balance-dashboard-gap-analysis.md)
- [movement-classification-audit.md](/C:/Users/Admin/Documents/gota/docs/movement-classification-audit.md)

### Conclusiones ya cerradas en docs

- la deuda real no es solo "codigo repetido", sino reglas de negocio decididas varias veces
- `movement-classification` es una de las fuentes mas peligrosas de divergencia silenciosa
- para el hero no convenia reutilizar `buildLiveBalanceBreakdown()` directamente
- el primer paso correcto era una primitive separada para agregados globales del hero
- `gastosTarjeta` debia quedar fuera de esa primera consolidacion porque depende de clasificacion mas sensible

## 2. Codigo ya implementado

### `live-balance.ts`

En [live-balance.ts](/C:/Users/Admin/Documents/gota/lib/live-balance.ts) se agrego:

- `buildLiveBalanceHeroSummary()`

Esa primitive centraliza los subtotales vivos del hero:

- `saldoInicial`
- `ingresos`
- `gastosPercibidos`
- `pagoTarjetas`
- `rendimientos`

### `dashboard/route.ts`

En [route.ts](/C:/Users/Admin/Documents/gota/app/api/dashboard/route.ts) el hero ya usa esa primitive para:

- `saldo_inicial`
- `ingresos`
- `gastos_percibidos`
- `pago_tarjetas`
- `rendimientos`

### `movement-classification.ts`

En [movement-classification.ts](/C:/Users/Admin/Documents/gota/lib/movement-classification.ts) se agregaron:

- `isCardPayment`
- `isLegacyCardPayment`
- `isApplicableCardPayment`
- `isCreditAccruedExpense`
- `isPerceivedExpense`

Primera adopcion ya aplicada en:

- [rollover.ts](/C:/Users/Admin/Documents/gota/lib/rollover.ts)
- [route.ts](/C:/Users/Admin/Documents/gota/app/api/dashboard/route.ts)

### Lo que se dejo explicitamente afuera

`gastosTarjeta` sigue aparte y no fue absorbido por `live-balance`, porque depende de una capa de clasificacion mas delicada:

- gasto con tarjeta devengado
- pago de tarjeta aplicable
- pago legacy excluido

## 3. Verificacion del bloque implementado

- `npx tsc --noEmit`: pasa
- `npx eslint lib/live-balance.ts app/api/dashboard/route.ts`: pasa

## 4. Recomendacion de implementacion siguiente

El siguiente bloque recomendado es `movement-classification`, con alcance chico y controlado.

### Contrato del modulo nuevo

Archivo propuesto:

- [movement-classification.ts](/C:/Users/Admin/Documents/gota/lib/movement-classification.ts)

Forma:

- helpers puros
- sin dependencia de Supabase client
- sin dependencia de queries

Input minimo implementado:

```ts
type ExpenseLike = {
  category: string
  payment_method: string
  is_legacy_card_payment?: boolean | null
}
```

### Helpers propuestos

- `isCardPayment(expense)`
- `isLegacyCardPayment(expense)`
- `isApplicableCardPayment(expense)`
- `isCreditAccruedExpense(expense)`
- `isPerceivedExpense(expense)`

### Nota de naming

Se eligio `isPerceivedExpense` y no `isDebitExpense` porque la semantica real es:

- `CASH`
- `DEBIT`
- `TRANSFER`
- excluyendo `Pago de Tarjetas`

## 5. Orden recomendado

### Etapa 1

Crear:

- [movement-classification.ts](/C:/Users/Admin/Documents/gota/lib/movement-classification.ts)

### Etapa 2

Estado: implementada

Adoptarlo en el mismo bloque inicial en:

- [rollover.ts](/C:/Users/Admin/Documents/gota/lib/rollover.ts)
- [route.ts](/C:/Users/Admin/Documents/gota/app/api/dashboard/route.ts)

Razon:

- ahi importa mucho la consistencia contable
- hoy ambos comparten criterio pero sin helpers
- conviene evitar una ventana donde rollover use clasificacion centralizada y dashboard no

Alcance acotado para `dashboard`:

- usar helpers en logica local sensible
- especialmente en el bloque relacionado a `gastosTarjeta`
- no reescribir queries SQL todavia en esta pasada

### Etapa 3

Estado: siguiente bloque

Dejar para segunda pasada:

- [route.ts](/C:/Users/Admin/Documents/gota/app/api/movimientos/route.ts)
- [route.ts](/C:/Users/Admin/Documents/gota/app/api/analytics-data/route.ts)

Razon:

- `movimientos` es mas UX-facing
- `analytics` tiene criterio temporal mas delicado

## 6. Recomendacion concreta para review externa

La recomendacion concreta para revisar con Claude es:

1. implementar ya el modulo de helpers de clasificacion
2. adoptarlo en `rollover.ts` y `dashboard/route.ts` dentro del mismo bloque inicial
3. en `dashboard/route.ts`, usarlo solo donde haya clasificacion local sensible
4. no tocar todavia las queries SQL ni reestructurar analytics o movimientos en esta pasada
5. abrir un bloque separado despues para adopcion en `movimientos` y `analytics`

## 7. Estado general

Estado actual del frente:

- consolidacion del hero: iniciada y validada
- docs madre: armados y alineados
- `movement-classification`: ya iniciada
- riesgo principal restante: `Pago de Tarjetas` + `is_legacy_card_payment` en deuda pendiente

## 8. Conclusion

El frente ya no esta en etapa de diagnostico general.  
Ya paso a etapa de consolidacion incremental.

El siguiente paso correcto no es otro rediseño grande, sino una extraccion chica y precisa de helpers de clasificacion para bajar la divergencia mas sensible sin abrir demasiado alcance.
