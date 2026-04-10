# Financial Logic Consolidation Audit

**Fecha:** 2026-04-10  
**Objetivo:** mapear donde vive hoy la logica financiera principal de Gota, que formulas estan duplicadas, cual es el impacto real de esa duplicacion, y como conviene consolidarla sin romper producto.

## 1. Contexto

Durante las ultimas limpiezas ya se avanzo bastante:

- `Saldo Vivo` dejo de depender de `monthly_income`
- `account_period_balance` dejo de actuar como input principal del modelo vivo
- `yield` ya no depende de APB
- `rollover` quedo mas acotado a snapshots de periodo

El problema que queda no es una decision de producto grande.  
Es una deuda estructural de implementacion:

- el mismo dominio financiero todavia se calcula en mas de un lugar
- cada endpoint arma su propia version del modelo
- algunas formulas ya fueron consolidadas, pero no todas

## 2. Que archivos concentran la deuda

Los principales puntos hoy son:

- [route.ts](/C:/Users/Admin/Documents/gota/app/api/dashboard/route.ts)
- [route.ts](/C:/Users/Admin/Documents/gota/app/api/dashboard/account-breakdown/route.ts)
- [route.ts](/C:/Users/Admin/Documents/gota/app/api/analytics-data/route.ts)
- [live-balance.ts](/C:/Users/Admin/Documents/gota/lib/live-balance.ts)
- [rollover.ts](/C:/Users/Admin/Documents/gota/lib/rollover.ts)

No todos hacen exactamente lo mismo, pero varios comparten subformulas o reglas de negocio cercanas.

## 3. Que calcula cada uno hoy

## A. `lib/live-balance.ts`

Es hoy la mejor primitive existente del modelo vivo.

Que resuelve:

- saldo por cuenta partiendo de `accounts.opening_balance_*`
- suma ingresos por cuenta
- resta gastos percibidos por cuenta
- resta pagos de tarjeta por cuenta
- aplica transferencias internas por cuenta
- suma yield por cuenta en ARS
- resta capital inmovilizado en instrumentos activos

Outputs principales:

- `buildLiveBalanceBreakdown()`
- `sumLiveBreakdown()`
- `sumCrossCurrencyTransferAdjustment()`
- `sumActiveInstrumentCapital()`

Estado:

- bien encaminado
- reusable
- ya es una base real para consolidar

## B. `app/api/dashboard/account-breakdown/route.ts`

Usa `buildLiveBalanceBreakdown()` correctamente.

Que resuelve:

- breakdown vivo por cuenta
- total consolidado desde esa misma primitive

Estado:

- bastante sano
- es el endpoint mas alineado con la direccion final

## C. `app/api/dashboard/route.ts`

Es el endpoint mas cargado y el mas hibrido.

Que resuelve hoy:

- hero principal
- `Saldo Vivo`
- `Disponible Real`
- latest movements
- estado de ingresos del mes
- pending recurring incomes
- subscriptions auto-insert
- card payment prompt
- rollover summary para el mes actual
- ajuste por transferencias cross-currency
- capital inmovilizado y rendimientos

Problema:

- mezcla capa de datos, agregacion financiera, side-effects y compatibilidad residual
- varias subformulas que ya existen en `live-balance.ts` vuelven a derivarse localmente
- el endpoint sabe demasiado

## D. `app/api/analytics-data/route.ts`

Calcula el dataset mensual para analytics.

Que resuelve:

- gastos del mes
- gastos con tarjeta del mes anterior para ciertos analisis
- ingresos del mes
- subscriptions
- card cycles para mes actual/anterior

Estado:

- no duplica exactamente el saldo vivo
- pero vuelve a decidir que entra y que no entra en categorias financieras ya definidas en otras partes
- reimplementa parte del criterio temporal por mes y tarjeta

## E. `lib/rollover.ts`

Hoy ya esta mucho mejor acotado, pero sigue siendo otra fuente de formulas.

Que resuelve:

- resumen del mes anterior
- saldo inicial / ingresos / gastos / pagos tarjeta del mes
- saldo final para rollover
- balances por cuenta para snapshots mensuales

Estado:

- tiene sentido como modulo propio
- pero algunas reglas de clasificacion financiera se parecen mucho a las del modelo vivo
- si cambia una regla contable, hay riesgo de tocar dos o tres lugares

## 4. Donde esta la duplicacion real

La duplicacion no es solo "mismo codigo copiado".  
Es principalmente "misma regla de negocio decidida varias veces".

## A. Clasificacion de movimientos

Se vuelve a decidir en varios lugares:

- que cuenta como gasto percibido
- que cuenta como pago de tarjeta
- que cuenta como gasto con tarjeta devengado
- que queda fuera de analytics o saldo vivo

Archivos afectados:

- [route.ts](/C:/Users/Admin/Documents/gota/app/api/dashboard/route.ts)
- [route.ts](/C:/Users/Admin/Documents/gota/app/api/dashboard/account-breakdown/route.ts)
- [route.ts](/C:/Users/Admin/Documents/gota/app/api/analytics-data/route.ts)
- [rollover.ts](/C:/Users/Admin/Documents/gota/lib/rollover.ts)

Impacto:

- si cambia la semantica de una categoria o payment method, es facil olvidar un lugar
- es probablemente la fuente mas peligrosa de divergencia silenciosa entre Home, rollover, analytics y tarjetas

## B. Agregacion por moneda

Hay varias sumas que vuelven a hacerse filtrando por `currency`.

Ejemplos:

- ingresos vivos
- gastos percibidos
- pagos de tarjeta
- credito devengado
- ajustes de transferencias cross-currency

Impacto:

- el numero total puede cerrar, pero no necesariamente por la misma formula en todos lados
- mas costo mental al leer y tocar codigo

## C. Criterio temporal

Tambien se rederiva varias veces:

- "hasta hoy" para saldo vivo
- "mes seleccionado" para analytics
- "mes anterior" para rollover
- "period_from -> closing_date" para resumenes de tarjeta

Esto no siempre es duplicacion mala, pero hoy esta repartido sin una capa clara.

Impacto:

- dificulta entender si un bug es de fecha, de categoria o de agregacion
- puede convertirse en bug funcional cuando se comparan analytics de un mes pasado contra rollover o ciclos de tarjeta de ese mismo periodo

## D. Saldos por cuenta vs saldo consolidado

Hoy el breakdown por cuenta ya tiene una primitive clara, pero el hero principal no consume directamente ese mismo resultado como fuente oficial.

Impacto:

- se mantiene el riesgo de que total y breakdown se desalineen si un ajuste se aplica en un solo lado

## E. Transferencias cross-currency

`sumCrossCurrencyTransferAdjustment()` ya existe en `live-balance.ts`, pero el endpoint de dashboard sigue manejando parte del contexto general localmente.

Impacto:

- no es el peor punto hoy
- pero sigue mostrando que el modelo global no esta encapsulado en una sola primitive

## 5. Impacto real de dejarlo asi

## A. Impacto en producto

El usuario puede no ver un bug todos los dias, pero el riesgo existe:

- un numero puede cambiar correctamente en Home y quedar viejo en analytics
- una mejora en pagos de tarjeta puede no reflejarse igual en rollover
- una nueva feature puede apoyar una formula equivocada porque hay varias candidatas

El problema no es solo precision.  
Tambien es consistencia explicable.

## B. Impacto en debugging

Hoy, cuando aparece una duda financiera, primero hay que descubrir:

- que endpoint genera el numero
- que helper local aplica
- si ese helper usa la misma regla que otro flujo

Eso vuelve caro cualquier analisis.

## C. Impacto en velocidad de cambio

Cada cambio en reglas contables tiende a pedir:

- tocar varios archivos
- revalidar varias pantallas
- recordar edge cases que no estan centralizados

Eso frena la capacidad de evolucionar Home, analytics y tarjetas.

## D. Impacto en testing

Si no hay primitives compartidas, tampoco hay un punto claro donde testear.

Resultado:

- se termina testeando por endpoint completo
- mas setup
- menos foco
- mas regresiones manuales

## 6. Efecto esperado de consolidarlo

Consolidar no significa volver todo a una mega-funcion.

El efecto bueno seria:

- una sola primitive oficial para balance vivo
- una sola primitive oficial para clasificacion de movimientos
- una sola primitive oficial para resumen mensual base
- endpoints mas chicos y mas declarativos
- tests mas simples y con menos mocking

Efecto en producto:

- menos riesgo de inconsistencias entre Home, breakdown, tarjetas y analytics
- cambios futuros mas predecibles

Efecto en ingenieria:

- menos costo para debuggear
- menos miedo a tocar reglas financieras
- mejor base para tests

## 7. Que no deberia consolidarse a la fuerza

No todo tiene que vivir en una sola funcion.

Conviene separar:

- modelo vivo historico
- modelo mensual / analytics
- snapshots de periodo / rollover
- resumenes de tarjeta por ciclo

La consolidacion correcta no es mezclar todo.  
Es compartir solo las primitives del mismo concepto.

## 8. Primitives oficiales recomendadas

## A. `live-balance` como nucleo oficial de saldo vivo

Deberia concentrar:

- breakdown por cuenta
- total consolidado por moneda
- ingresos vivos
- gastos percibidos vivos
- pagos de tarjeta vivos
- yield acumulado
- capital inmovilizado
- ajuste cross-currency

Idealmente `dashboard/route.ts` deberia consumir este resultado en vez de reconstruir varias partes a mano.

Prerequisito:

- primero hay que mapear exactamente que outputs expone hoy `buildLiveBalanceBreakdown()` y cuales sigue reconstruyendo [route.ts](/C:/Users/Admin/Documents/gota/app/api/dashboard/route.ts)
- si faltan agregados canonicos, la Etapa 2 no es solo "usar live-balance", sino ampliar su API de forma explicita

## B. `movement-classification` o equivalente

Falta una primitive clara para responder:

- esto es gasto percibido?
- esto es pago de tarjeta?
- esto es credito devengado?
- esto impacta analytics?
- esto impacta rollover?

No necesariamente con una sola API publica gigante, pero si con helpers compartidos.

Prioridad:

- deberia subir en prioridad practica
- es la capa que mas facil rompe consistencia sin que el bug sea obvio a simple vista

## C. `monthly-summary` o equivalente

Falta una primitive clara para resumen mensual base:

- ingresos del mes
- gastos del mes
- pagos tarjeta del mes
- saldo inicial del mes
- saldo final del mes

Hoy eso vive principalmente en `rollover.ts`, pero podria formalizarse mejor para reuso.

## D. `card-cycle-summary`

La logica de tarjeta por ciclo ya esta bastante encapsulada, pero deberia seguir separada del modelo vivo general.

No hace falta mezclarla con saldo vivo.  
Si hace falta dejar bien definido donde termina una cosa y empieza la otra.

## 9. Propuesta de refactor por etapas

## Etapa 1. Auditoria y docs

Objetivo:

- dejar definida la lista oficial de primitives
- documentar que concepto corresponde a cada modulo

Riesgo:

- bajo

## Etapa 2. Mapear gap de outputs en `live-balance.ts`

Objetivo:

- comparar que expone hoy `buildLiveBalanceBreakdown()` contra todo lo que [route.ts](/C:/Users/Admin/Documents/gota/app/api/dashboard/route.ts) reconstruye localmente
- decidir que agregados deben pasar a ser outputs oficiales de `live-balance`

Resultado esperado:

- tamaño real de la consolidacion visible
- prerequisitos tecnicos claros antes del refactor

Riesgo:

- bajo

## Etapa 3. Extraer clasificacion compartida de movimientos

Objetivo:

- centralizar reglas de inclusion/exclusion de gastos, pagos de tarjeta y credito devengado

Resultado esperado:

- menos divergencia entre dashboard, analytics y rollover

Riesgo:

- medio
- puede mover varios filtros pequeños
- pero conviene priorizarla mas alto porque es donde mas facil aparece divergencia silenciosa

## Etapa 4. Consolidar outputs vivos en `live-balance.ts`

Objetivo:

- mover a un helper compartido las agregaciones que hoy `dashboard/route.ts` hace por separado para `Saldo Vivo` y `Disponible Real`

Resultado esperado:

- Home y breakdown parten del mismo nucleo real

Riesgo:

- medio
- requiere validar numeros visibles

## Etapa 5. Formalizar `monthly-summary`

Objetivo:

- dejar a `rollover.ts` como consumidor de una primitive mensual mas canonica

Resultado esperado:

- menos reglas contables repartidas

Riesgo:

- medio

## Etapa 6. Tests en paralelo sobre primitives

Objetivo:

- arrancar tests desde la primera consolidacion util, no al final
- usar `live-balance` y luego `movement-classification` como red de seguridad para las etapas siguientes

Resultado esperado:

- refactor con menos riesgo
- base reutilizable para monthly summary y futuros cambios

Riesgo:

- bajo

## 10. Recomendacion concreta

El siguiente paso correcto no es reescribir todo `dashboard/route.ts` de una.

La recomendacion es:

1. usar este audit para decidir las primitives oficiales
2. mapear primero el gap exacto entre `live-balance.ts` y [route.ts](/C:/Users/Admin/Documents/gota/app/api/dashboard/route.ts)
3. priorizar `movement-classification` mas arriba de lo que parecia al inicio
4. consolidar despues el modelo vivo en `live-balance.ts`
5. meter tests desde esa primera consolidacion, no al final
6. dejar `rollover` y analytics consumiendo esas primitives de a poco

## 11. Conclusion

La deuda actual no es que el modelo financiero este mal definido.

La deuda es que su implementacion todavia esta repartida.

Estado real hoy:

- direccion de producto: bastante cerrada
- primitives compartidas: parciales
- endpoint principal: todavia demasiado grande
- riesgo de divergencia: moderado
- oportunidad de consolidacion: alta

Esto ya esta en punto para una etapa de refactor estructural controlado.
