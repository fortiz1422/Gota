# Live Balance vs Dashboard Gap Analysis

**Fecha:** 2026-04-10  
**Objetivo:** documentar exactamente que outputs expone hoy `lib/live-balance.ts`, que outputs reconstruye `app/api/dashboard/route.ts`, cual es el gap real entre ambos, y que conviene mover antes de refactorizar.

## 1. Resumen ejecutivo

Hoy `live-balance.ts` ya resuelve bien el **saldo vivo por cuenta**.

Pero `dashboard/route.ts` todavia reconstruye por separado varios agregados globales que pertenecen al mismo dominio:

- `saldo_inicial`
- `ingresos`
- `gastos_percibidos`
- `pago_tarjetas`
- `rendimientos`
- `gastos_tarjeta`
- `transferCurrencyAdjustment`
- `capitalInstrumentosMes`

Eso significa que:

- el breakdown por cuenta ya parte de una primitive compartida
- el hero principal todavia no

El gap real no es solo "usar `buildLiveBalanceBreakdown()`".  
El gap es que `live-balance.ts` hoy devuelve **breakdown**, pero no devuelve **los agregados canonicos del hero**.

Ademas:

- no conviene forzar la primera consolidacion a traves de `buildLiveBalanceBreakdown()`
- `dashboard/route.ts` hoy trae varias queries live solo con `amount`, sin `account_id`
- por eso, la primera primitive nueva del hero conviene separarla del breakdown por cuenta

## 2. Que expone hoy `live-balance.ts`

Archivo:

- [live-balance.ts](/C:/Users/Admin/Documents/gota/lib/live-balance.ts)

Outputs actuales:

- `buildLiveBalanceBreakdown()`
- `sumLiveBreakdown()`
- `sumCrossCurrencyTransferAdjustment()`
- `sumActiveInstrumentCapital()`

Capacidades reales:

- parte de `accounts.opening_balance_*`
- asigna ingresos por cuenta
- resta gastos percibidos por cuenta
- resta pagos de tarjeta por cuenta
- aplica transferencias internas por cuenta
- suma yield por cuenta en ARS
- resta instrumentos activos por cuenta

Limitacion principal:

- no devuelve una estructura agregada con los componentes del hero
- no expone separadamente cada subtotal vivo que `dashboard/route.ts` necesita

## 3. Que reconstruye hoy `dashboard/route.ts`

Archivo:

- [route.ts](/C:/Users/Admin/Documents/gota/app/api/dashboard/route.ts)

Outputs financieros vivos que hoy calcula localmente:

- `liveSaldoInicial`
- `liveIngresos`
- `liveGastosPercibidos`
- `livePagoTarjetas`
- `livePagoTarjetasAplicables`
- `liveCreditoDevengado`
- `liveGastosTarjeta`
- `rendimientosHistoricos`
- `transferCurrencyAdjustment`
- `capitalInstrumentosMes`

Observacion importante:

- varias de estas queries globales hoy no traen `account_id`
- eso impide reutilizar directamente la primitive de breakdown para el hero sin cambiar antes la forma en que el endpoint consulta datos

Y con eso sobreescribe el resultado del RPC:

- `dashboardData.saldo_vivo`
- `dashboardData.gastos_tarjeta`

## 4. Mapa exacto del gap

## A. `saldo_inicial`

Estado actual:

- `dashboard/route.ts` lo recalcula sumando `accounts.opening_balance_*`
- `live-balance.ts` lo usa internamente para construir el balance por cuenta
- no lo expone como subtotal

Gap:

- falta output agregado oficial

Recomendacion:

- exponer `saldoInicial` dentro de una nueva primitive agregada de live balance

## B. `ingresos`

Estado actual:

- `dashboard/route.ts` suma `income_entries` por moneda hasta hoy
- `live-balance.ts` ya usa esos mismos ingresos para el breakdown por cuenta
- no expone subtotal agregado

Gap:

- la regla ya existe, pero el subtotal global no esta centralizado

Recomendacion:

- exponer `ingresos` como parte del output agregado

## C. `gastos_percibidos`

Estado actual:

- `dashboard/route.ts` suma gastos `CASH | DEBIT | TRANSFER`, excluyendo `Pago de Tarjetas`
- `live-balance.ts` aplica exactamente esa familia de gastos al breakdown
- no expone subtotal agregado

Gap:

- mismo criterio de negocio decidido en dos lugares: query + helper

Recomendacion:

- mover el subtotal agregado a una primitive viva comun
- mas adelante, formalizar la clasificacion en helpers compartidos

## D. `pago_tarjetas`

Estado actual:

- `dashboard/route.ts` suma todos los `Pago de Tarjetas` hasta hoy
- `live-balance.ts` tambien los resta del saldo por cuenta
- no expone subtotal agregado

Gap:

- subtotal vivo no centralizado

Recomendacion:

- exponer `pagoTarjetas` en el output agregado

## E. `rendimientos`

Estado actual:

- `dashboard/route.ts` suma `yield_accumulator.accumulated`
- `live-balance.ts` suma yield por cuenta solo para ARS dentro del breakdown
- no expone subtotal agregado

Gap:

- criterio y subtotal todavia viven repartidos

Recomendacion:

- exponer `rendimientos` desde una primitive agregada viva

## F. `gastos_tarjeta`

Estado actual:

- `dashboard/route.ts` calcula `liveCreditoDevengado - livePagoTarjetasAplicables`
- `live-balance.ts` no calcula este valor
- esto ya entra mas en cruce entre movimiento clasificado y saldo disponible

Gap:

- este no es solo un subtotal faltante
- requiere una primitive de clasificacion o una primitive viva mas rica

Recomendacion:

- no meterlo de forma apurada dentro de `buildLiveBalanceBreakdown()`
- primero formalizar clasificacion:
  - gasto con tarjeta devengado
  - pago de tarjeta aplicable
  - pago legacy excluido

## G. `transferCurrencyAdjustment`

Estado actual:

- `dashboard/route.ts` ya usa `sumCrossCurrencyTransferAdjustment()`
- este punto ya esta razonablemente consolidado

Gap:

- bajo

Recomendacion:

- mantener como helper separado
- no es prioridad inmediata

## H. `capitalInstrumentosMes`

Estado actual:

- `dashboard/route.ts` ya usa `sumActiveInstrumentCapital()`
- `live-balance.ts` ya descuenta instrumentos activos dentro del breakdown

Gap:

- bajo
- ya existe helper compartido para el agregado

Recomendacion:

- mantener asi por ahora

## 5. Conclusiones del mapping

## Lo que ya esta bastante bien

- breakdown por cuenta
- total derivable desde el breakdown
- cross-currency transfer adjustment
- capital inmovilizado agregado

## Lo que falta de verdad

Faltan outputs agregados oficiales para el hero de saldo vivo:

- `saldoInicial`
- `ingresos`
- `gastosPercibidos`
- `pagoTarjetas`
- `rendimientos`

## Lo que no conviene meter todavia en la misma primitive

- `gastosTarjeta`

Porque ahi ya aparece la capa de clasificacion mas delicada:

- credito devengado
- pagos aplicables
- pagos legacy excluidos

Eso merece una primitive aparte o al menos helpers compartidos antes de consolidarlo.

## 6. Propuesta de output nuevo

En vez de expandir `buildLiveBalanceBreakdown()` de forma ambigua, conviene agregar una primitive nueva en `live-balance.ts`.

Razon:

- `buildLiveBalanceBreakdown()` depende de `account_id`
- el hero actual no necesita breakdown por cuenta para esta primera pasada
- varias queries live del dashboard hoy solo necesitan agregacion global

Propuesta:

- `buildLiveBalanceHeroSummary()`

Output sugerido:

```ts
type HeroSummaryByCurrency = {
  saldoInicial: number
  ingresos: number
  gastosPercibidos: number
  pagoTarjetas: number
  rendimientos: number
}

Record<'ARS' | 'USD', HeroSummaryByCurrency>
// ej: { ARS: { saldoInicial, ingresos, ... }, USD: { saldoInicial, ingresos, ... } }
```

Razon del keying por moneda:

- el hero ya muestra ARS y USD por separado en pantalla
- evita que el consumidor tenga que filtrar por moneda afuera de la primitive, que es exactamente el problema que se quiere eliminar
- es consistente con como `buildLiveBalanceBreakdown()` trabaja por cuenta/moneda
- escala sin cambiar la firma si aparece una tercera moneda

Alternativa descartada:

- recibir `currency` como parametro y devolver un solo objeto plano
- obliga a llamar la funcion dos veces para construir el hero completo
- no mejora la situacion actual

Eso permitiria:

- que `account-breakdown/route.ts` siga consumiendo breakdown sin cambios
- que `dashboard/route.ts` use una primitive propia del hero sin ampliar queries innecesariamente
- reducir recalculo local sin mezclar responsabilidades

## 7. Que sigue faltando despues de eso

Aun despues de esa primitive, quedarian temas fuera:

- `gastosTarjeta`
- clasificacion de pagos legacy vs aplicables
- reglas compartidas de inclusion/exclusion para analytics y rollover

O sea:

- este gap analysis no cierra toda la deuda
- solo define el tamaño real de la Etapa 2

## 8. Impacto de cerrar este gap

## En producto

- Home y breakdown pasan a apoyar el hero en la misma base real
- menos riesgo de que `Saldo Vivo` y detalle por cuenta diverjan

## En debugging

- cuando cambie un subtotal del hero, habra un lugar oficial donde mirar

## En refactor futuro

- deja mejor preparada la extraccion de `movement-classification`
- baja el tamaño de `dashboard/route.ts`

## 9. Recomendacion concreta

El siguiente paso correcto en codigo seria:

1. crear una primitive agregada nueva tipo `buildLiveBalanceHeroSummary()` en [live-balance.ts](/C:/Users/Admin/Documents/gota/lib/live-balance.ts)
2. mover ahi los subtotales vivos del hero
3. dejar `gastosTarjeta` fuera de esa primera pasada
4. despues ir por `movement-classification`

## 10. Conclusion

El gap real ya esta bastante acotado.

No hace falta reinventar `live-balance.ts`.  
Hace falta ampliar su salida para que deje de ser solo "breakdown por cuenta" y pase a ser tambien la fuente oficial de subtotales vivos del hero.

La principal excepcion es `gastosTarjeta`, que sigue dependiendo de una capa de clasificacion mas sensible y conviene tratar aparte.
