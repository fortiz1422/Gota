# Business Logic Audit

**Fecha:** 2026-04-14  
**Objetivo:** auditar la logica de negocio financiera actualmente implementada en Gota, contrastarla contra referentes mobile finance de alta calidad y dejar un mapa claro de gaps, riesgos y oportunidades.

## 1. Resumen ejecutivo

Gota ya tiene una base de producto financieramente seria para un producto en esta etapa:

- Smart Input con captura rapida
- modelo multicuenta
- transferencias entre cuentas
- ingresos granulares
- tarjetas con ciclos y pago de resumen
- cuotas nuevas y cuotas en curso
- separacion conceptual entre `Saldo Vivo`, analytics mensuales y deuda de tarjeta

La debilidad principal no es falta de features.

La debilidad principal es que el modelo financiero todavia esta en transicion:

- conviven modelo legacy y modelo nuevo
- varias reglas del dominio se calculan en mas de un lugar
- algunas entidades de producto ya existen en UX pero no estan cerradas como primitives contables
- multimoneda existe, pero todavia no esta modelada con la profundidad que exige el caso argentino

La conclusion general es:

**Gota va en una direccion correcta de producto, pero todavia no tiene una capa contable unica y cerrada.**

Eso hoy genera tres riesgos:

1. inconsistencias silenciosas entre Home, analytics, tarjetas y movimientos
2. dificultad para explicar numeros al usuario con precision
3. dificultad para agregar nuevas features sin aumentar la deuda estructural

---

## 2. Metodologia

El analisis se hizo sobre:

- implementacion actual en `app/`, `components/`, `lib/`, `types/`
- schema real y migraciones en [schema.sql](/C:/Users/Admin/Documents/gota/schema.sql)
- auditorias vigentes del repo
- docs historicos solo como contexto, no como fuente principal de verdad
- comparacion externa contra referentes del espacio:
  - Revolut
  - Monarch Money
  - Copilot Money
- contexto regulatorio y de uso argentino con foco en:
  - tarjetas de credito
  - pagos de resumen
  - consumos en moneda extranjera
  - transferencias electronicas

Fuentes externas usadas:

- BCRA tarjeta de credito: https://www.bcra.gob.ar/tarjeta-de-credito-funcionamiento-costos-y-buenas-practicas/
- BCRA medios de pago electronico: https://www.bcra.gob.ar/catalogo_de_datos/medios-de-pago-electronico-y-extracciones-de-efectivo/
- Monarch recurring tracking: https://help.monarchmoney.com/hc/en-us/articles/4890751141908-Tracking-Recurring-Expenses-and-Bills
- Monarch flex budgeting: https://help.monarchmoney.com/hc/en-us/articles/32125337244052-Understanding-Flex-Budgeting
- Copilot transaction types: https://help.copilot.money/en/articles/3971267-transaction-types
- Copilot internal transfer payments: https://help.copilot.money/en/articles/4235839-creating-manual-internal-transfer-payments
- Copilot accounts overview: https://help.copilot.money/en/articles/6213732-accounts-tab-overview
- Revolut wealth analytics: https://help.revolut.com/help/accounts/budget-and-analytics/how-can-i-see-my-total-wealth-analytics/
- Revolut budgeting and pockets: https://www.revolut.com/meet-your-financial-goals-with-vaults/

---

## 3. Estado actual por dominio

## 3.1 Saldo Vivo y modelo contable

### Lo que esta bien encaminado

La direccion conceptual actual es buena:

- `Saldo Vivo` se empuja hacia un modelo historico acumulado
- `accounts.opening_balance_*` actua como base contable
- `income_entries`, `expenses`, `transfers`, `yield_accumulator` e `instruments` ya forman un ledger de hecho
- el breakdown por cuenta esta mejor encapsulado en [lib/live-balance.ts](/C:/Users/Admin/Documents/gota/lib/live-balance.ts)

### Problema principal

La fuente de verdad todavia no esta completamente cerrada.

Persisten restos de logica distribuida entre:

- RPC `get_dashboard_data`
- [lib/server/dashboard-queries.ts](/C:/Users/Admin/Documents/gota/lib/server/dashboard-queries.ts)
- [lib/live-balance.ts](/C:/Users/Admin/Documents/gota/lib/live-balance.ts)
- [lib/rollover.ts](/C:/Users/Admin/Documents/gota/lib/rollover.ts)
- [app/api/analytics-data/route.ts](/C:/Users/Admin/Documents/gota/app/api/analytics-data/route.ts)

### Hallazgo

El home ya no usa ciegamente la RPC, sino que la pisa parcialmente con calculos vivos mas nuevos. Eso mejora precision del hero, pero confirma que el sistema todavia no tiene una primitive unica y canonica para todos los subtotales principales.

### Riesgo

- Home puede estar mas correcto que analytics
- breakdown por cuenta puede usar una semantica distinta al hero
- una correccion futura puede arreglar una pantalla y dejar otra desviada

### Evaluacion

**Nivel:** P0  
**Diagnostico:** la direccion es correcta, el cierre estructural todavia no.

---

## 3.2 Clasificacion de movimientos

### Estado actual

Ya existe una base compartida en [lib/movement-classification.ts](/C:/Users/Admin/Documents/gota/lib/movement-classification.ts):

- `isCardPayment`
- `isLegacyCardPayment`
- `isApplicableCardPayment`
- `isCreditAccruedExpense`
- `isPerceivedExpense`

### Lo positivo

Esta es una de las mejoras mas sanas del modelo actual.

El sistema ya distingue:

- gasto percibido
- gasto con tarjeta devengado
- pago de tarjeta
- pago legacy de tarjeta
- pago de tarjeta aplicable a deuda pendiente

### Gap

La clasificacion todavia no esta consumida por absolutamente todos los flujos financieros.

El problema real no es codigo repetido literal.

El problema real es que la misma regla de negocio todavia se decide varias veces al construir:

- saldo vivo
- deuda pendiente de tarjetas
- analytics
- compromisos
- movimientos
- rollover

### Evaluacion

**Nivel:** P1  
**Diagnostico:** buen avance tecnico, consolidacion todavia incompleta.

---

## 3.3 Gastos y Smart Input

### Lo fuerte de Gota

Este es uno de los diferenciales reales del producto.

Comparado contra referentes como Monarch o Copilot:

- Gota gana en velocidad de captura manual
- Gota tiene una tesis de producto mas fuerte sobre input natural
- Gota esta mejor alineado con el problema de abandono por friccion

### Limitaciones observadas

- la calidad contable depende de revision posterior en `ParsePreview`
- la categorizacion sigue fuerte en UX, pero menos fuerte en infraestructura de reglas
- no aparece una capa robusta de aprendizaje de reglas del usuario tipo merchant rules o recategorizacion automatica persistente

### Gap frente al mercado

Referentes como Monarch y Copilot no compiten tanto en input libre, sino en:

- reglas persistentes
- transacciones recurrentes
- merchant normalization
- correcciones automáticas sostenidas en el tiempo

Gota hoy tiene mejor entrada manual rapida, pero menor capacidad de “aprender” comportamiento del usuario.

### Evaluacion

**Nivel:** P1 de producto  
**Diagnostico:** fuerte diferencial de UX, debil en personalizacion y memoria operativa.

---

## 3.4 Multimoneda

### Estado actual

Gota soporta:

- `ARS`
- `USD`
- cuentas con saldo base en ambas monedas
- ingresos y gastos por moneda
- transferencias same-currency y cross-currency

### Lo que funciona

- separacion nominal de balances por moneda
- ajuste de transferencias cross-currency
- posibilidad de operar ARS y USD sin colapsar todo a una sola moneda fija

### Problemas de fondo

Para el caso argentino, multimoneda hoy esta submodelado.

No aparece cerrado de forma explicita:

- criterio de valuacion consolidada
- tipo de cambio de referencia
- tipo de cambio efectivo por transferencia
- ganancia o perdida cambiaria
- pago de tarjeta en ARS contra consumo en USD
- resumenes mixtos o deuda dolarizada
- consolidado patrimonial cross-currency con trazabilidad

### Por que esto es serio en Argentina

Segun BCRA, los consumos en moneda extranjera pueden cancelarse en dolares o en pesos y la cotizacion aplicada depende del momento de cancelacion. Eso no es un edge case local; es comportamiento central.

### Gap frente a referentes

- Revolut tiene manejo mucho mas nativo de multi-currency balances
- Gota tiene mejor sensibilidad local para ARS/USD como problema de usuario argentino, pero todavia sin modelo suficientemente robusto

### Evaluacion

**Nivel:** P0 de negocio/modelo  
**Diagnostico:** feature existente pero todavia no lista para ser una columna vertebral confiable.

---

## 3.5 Tarjetas y resumenes

### Estado actual

Hoy existen:

- `cards`
- `card_cycles`
- calculo de ciclos con fallback legacy
- modal de pago de resumen
- reversión de pago
- calculo de deuda pendiente via ciclos abiertos/cerrados no pagados

Archivos clave:

- [lib/card-cycles.ts](/C:/Users/Admin/Documents/gota/lib/card-cycles.ts)
- [lib/card-summaries.ts](/C:/Users/Admin/Documents/gota/lib/card-summaries.ts)
- [app/api/card-cycles/route.ts](/C:/Users/Admin/Documents/gota/app/api/card-cycles/route.ts)
- [app/(dashboard)/tarjetas/[cardId]/PagarResumenModal.tsx](/C:/Users/Admin/Documents/gota/app/(dashboard)/tarjetas/[cardId]/PagarResumenModal.tsx)

### Lo que esta bien

- Gota ya entendio que tarjeta no es “otro gasto”, sino una deuda que se paga despues
- `Disponible Real` se mueve hacia una nocion mas correcta de deuda pendiente y no solo gasto del mes
- hay UI especifica para revisar y pagar resumen

### Gaps fuertes

#### A. Pago de tarjeta sigue modelado como gasto especial

Hoy el pago se registra como `expense` con categoria `Pago de Tarjetas`.

Eso sirve para cashflow, pero es un modelo limitado.

No representa con suficiente fuerza:

- cancelacion de pasivo
- pago parcial real
- saldo remanente financiado
- intereses por revolving
- minimo vs total
- conciliacion de cuenta de origen contra deuda de tarjeta

#### B. El modal de pago esta hardcodeado a ARS

En [PagarResumenModal.tsx](/C:/Users/Admin/Documents/gota/app/(dashboard)/tarjetas/[cardId]/PagarResumenModal.tsx), el pago y los ajustes se guardan en ARS.

Eso deja flojo:

- consumo en USD
- pago en USD
- ajustes en otra moneda
- resumenes con componente dolarizada

#### C. El resumen aun no es un liability model completo

Falta cerrar entidad de deuda por tarjeta con campos como:

- monto total
- monto minimo
- monto pagado acumulado
- remanente
- intereses
- cargos bancarios
- carryover al siguiente ciclo

### Comparacion con mercado

Copilot modela pagos de tarjeta como `Internal Transfer` cuando corresponde. Esa decision es mas limpia para patrimonio y deuda.

Monarch y Revolut, cada uno a su manera, estan mas cerca de separar asset, liability y spending.

Gota hoy esta bien orientado para cashflow, pero todavia no para liability accounting completo.

### Evaluacion

**Nivel:** P0/P1  
**Diagnostico:** muy buena direccion UX, modelo contable todavia incompleto.

---

## 3.6 Cuotas

### Estado actual

La feature de cuotas hoy:

- soporta compra nueva en cuotas
- soporta cuotas ya en curso
- expande a filas futuras en `expenses`
- soporta borrado grupal
- bloquea edicion individual de cuotas agrupadas

Base relevante:

- [app/api/expenses/route.ts](/C:/Users/Admin/Documents/gota/app/api/expenses/route.ts)
- [app/api/expenses/[id]/route.ts](/C:/Users/Admin/Documents/gota/app/api/expenses/[id]/route.ts)
- [components/dashboard/CuotasEnCursoSheet.tsx](/C:/Users/Admin/Documents/gota/components/dashboard/CuotasEnCursoSheet.tsx)
- [docs/cuotas-feature-audit.md](/C:/Users/Admin/Documents/gota/docs/cuotas-feature-audit.md)

### Lo que esta bien

- el impacto mensual queda explicito
- evita una abstraccion compleja y opaca
- la suma total cierra exacta
- se visualiza cada cuota como consumo real del mes correspondiente

### Problemas

#### A. No hay edicion grupal

Hoy la asimetria es:

- borrar grupo: si
- editar grupo: no

Eso es operativo pero no sostenible para UX madura.

#### B. Falta metadata de origen

No queda bien distinguido si el grupo vino de:

- compra nueva
- cuota ya en curso

Eso impacta en explicabilidad, debugging y futuras reglas.

#### C. Falta una politica de compromisos cerrada

La app modela bien la cuota mensual registrada.

No modela tan claramente:

- obligacion futura total remanente
- compra financiada como compromiso agregado
- relacion entre cuotas futuras y disponible/planning

### Comparacion con referentes

Los referentes globales suelen tratar installment plans como parte del pasivo o del expected spend, no solo como filas futuras mensuales.

Para Argentina, donde cuotas son centrales, Gota puede tener una oportunidad de diferenciarse mucho si cierra este modelo mejor que los referentes globales.

### Evaluacion

**Nivel:** P1  
**Diagnostico:** bien resuelto para MVP serio, incompleto para producto experto.

---

## 3.7 Ingresos, recurrentes y subscriptions

### Lo positivo

Ya existe una migracion clara hacia `income_entries` como fuente operativa mas granular.

Tambien existen:

- ingresos recurrentes
- subscriptions
- auto-insert de suscripciones

### Gaps

#### A. `monthly_income` sigue orbitando el sistema

Aunque la direccion ya esta tomada, la existencia residual del modelo legacy sigue agregando costo mental y riesgo.

#### B. Las subscriptions hacen side effects desde dashboard

En [app/api/dashboard/route.ts](/C:/Users/Admin/Documents/gota/app/api/dashboard/route.ts) se hace `processSubscriptions` en fire-and-forget al cargar Home.

Eso es pragmatico, pero mezcla:

- lectura de dashboard
- side effect de dominio
- insercion de gastos

Es una decision util para avanzar, pero debil como arquitectura estable.

#### C. Falta una capa mas fuerte de recurring planning

Monarch empuja mejor:

- recurring bills
- syncing de deudas y pagos
- flex budgeting
- categories con rollover

Gota tiene buenas piezas, pero todavia no una capa fuerte de “expected cash flow”.

### Evaluacion

**Nivel:** P1  
**Diagnostico:** base buena, acople arquitectonico y planning incompleto.

---

## 3.8 Transferencias y multicuenta

### Lo positivo

La introduccion de `accounts` y `transfers` fue correcta.

Eso mueve a Gota fuera del tracker simple de gastos y lo acerca a una lectura financiera mas real.

### Lo que falta

- conciliacion mas clara entre cuenta origen y destino
- UX mas explicativa del impacto por moneda
- integracion mas fuerte con deuda de tarjeta
- mayor claridad sobre cuenta default cuando un movimiento no trae `account_id`

### Comparacion con referentes

Copilot y Revolut tienen mas fuerza en account model y patrimonio consolidado.

Gota ya hizo la inversion correcta en modelo base, pero todavia no capitaliza esa ventaja en UX y consistencia total.

### Evaluacion

**Nivel:** P1  
**Diagnostico:** buen fundamento, valor usuario todavia parcialmente capturado.

---

## 4. Comparacion sintetica contra referentes

## 4.1 Revolut

### Donde Revolut es claramente superior

- multimoneda real
- cuentas y balances por moneda mas maduros
- riqueza y liabilities en una misma superficie
- gestion patrimonial mas amplia

### Donde Gota puede diferenciarse

- captura manual ultrarrapida
- foco en realidad argentina
- lectura cotidiana de gasto y liquidez local

### Implicacion

Gota no deberia copiar a Revolut completo.

Deberia absorber:

- claridad entre asset, liability y cash
- mejor modelo multimoneda
- mejor consolidado patrimonial

---

## 4.2 Monarch

### Donde Monarch es claramente superior

- recurring bills
- flex budgeting
- categorias con rollover
- planning y previsibilidad

### Donde Gota es mejor

- input friction muy bajo
- posibilidad de capturar eventos locales no sync-based

### Implicacion

Gota necesita una capa mas fuerte de:

- expected spend
- categorias no mensuales
- gastos previsibles acumulables

---

## 4.3 Copilot

### Donde Copilot es claramente superior

- taxonomia de transacciones
- separacion entre gasto, ingreso y transferencias internas
- net worth y debt model
- credit card payments mejor alineados con liability tracking

### Donde Gota puede competir

- mejor adecuacion al caso argentino
- cuotas como feature local estructural

### Implicacion

Gota deberia adoptar mas explicitamente:

- pagos de tarjeta como settlement de deuda
- distincion fuerte entre gasto, transferencia interna y ajuste

---

## 5. Fallas de logica y riesgos detectados

## P0

### 5.1 Capa financiera no unificada

La misma logica de negocio sigue repartida entre varias rutas y helpers.

**Impacto**

- numeros potencialmente divergentes
- alto costo de debugging
- baja velocidad de evolucion

### 5.2 Multimoneda insuficiente para el caso argentino

No hay politica cerrada y explicable de conversion, valuacion y pagos de deuda en USD/ARS.

**Impacto**

- riesgo funcional en tarjetas
- riesgo de desconfianza del usuario

### 5.3 Tarjetas todavia no modelan bien la deuda revolvente

No esta cerrado el comportamiento de:

- pago parcial
- carryover
- intereses
- pago minimo

**Impacto**

- lectura incompleta del pasivo
- `Disponible Real` potencialmente correcto para algunos casos, pero no para todos

## P1

### 5.4 Pago de resumen modelado como gasto especial en vez de settlement mas rico

Sirve, pero escala mal.

### 5.5 Hardcodeo a ARS en el pago de resumen

Debilita el caso de consumos en USD.

### 5.6 Cuotas sin edicion grupal ni metadata completa de origen

Limita UX y explicabilidad.

### 5.7 Side effects de subscriptions disparados desde dashboard

Mezcla lectura con escritura.

### 5.8 Falta una capa fuerte de planning y expected cash flow

Hay buenas piezas, pero no un sistema unificado.

## P2

### 5.9 Falta de test coverage de dominio

No hay evidencia fuerte de tests que cubran:

- cuotas
- pagos de tarjeta
- reversal
- transferencias cross-currency
- clasificacion financiera
- edge cases de fechas

---

## 6. Oportunidades de mejora

## 6.1 Consolidar una capa canonica del dominio financiero

Crear una capa comun que exponga:

- subtotales vivos
- deuda de tarjeta
- pagos aplicables
- clasificacion de movimientos
- criterio temporal por vista
- criterio por moneda

Todo lo demas deberia consumir esa capa:

- Home
- analytics
- movimientos
- tarjetas
- rollover residual

## 6.2 Separar explicitamente tres conceptos de producto

Gota hoy mezcla bien varios conceptos, pero todavia no los separa del todo.

Conviene cerrar tres superficies:

- `Liquidez actual`
- `Compromisos futuros`
- `Patrimonio neto`

Eso ordenaria mucho mejor:

- tarjetas
- cuotas
- instrumentos
- ingresos recurrentes
- transferencias

## 6.3 Rehacer tarjetas como subledger de deuda

Direccion recomendada:

- cada tarjeta con saldo de deuda
- cada resumen con estado y remanente
- pagos parciales acumulables
- fees e intereses separados
- conciliacion entre cuenta pagadora y deuda cancelada

## 6.4 Subir multimoneda de feature a modelo

Definir explicitamente:

- cotizacion de referencia
- cotizacion efectiva por evento
- valuacion consolidada opcional
- deudas en moneda original
- pagos en moneda distinta

## 6.5 Evolucionar cuotas a compromiso financiero completo

Sin perder simplicidad de persistencia, agregar:

- metadata de origen
- edicion grupal
- deuda remanente agregada
- lectura de “cuotas por venir”

## 6.6 Agregar capa fuerte de previsibilidad

Inspirado mas en Monarch que en un tracker simple:

- gastos no mensuales
- sobres o buckets acumulativos
- expected spend
- compromisos futuros
- renovaciones y suscripciones mas visibles

---

## 7. Backlog priorizado

## P0

### B1. Cerrar fuente de verdad financiera unica

Definir y hacer cumplir una primitive compartida para:

- saldo vivo
- deuda de tarjeta
- disponible real
- clasificacion contable base

### B2. Definir politica multimoneda oficial

Especialmente para:

- pagos de tarjeta
- transferencias cross-currency
- consolidado patrimonial

### B3. Rediseñar modelo de deuda de tarjeta

Agregar semantica clara de liability y pago parcial.

## P1

### B4. Eliminar dependencias residuales del modelo legacy en runtime principal

Reducir el rol de:

- `monthly_income`
- paths residuales de rollover
- rederivaciones locales

### B5. Cuotas v2

- metadata de origen
- edicion grupal
- compromiso remanente

### B6. Expected cash flow y planning

- recurring better surfaced
- subscriptions mejor integradas
- no mensuales y rollover category logic

### B7. Reordenar events y side effects

Sacar escrituras automáticas del request de dashboard cuando sea posible.

## P2

### B8. Test suite de dominio financiero

Prioridad en:

- resumenes
- pagos
- cuotas
- transferencias
- multimoneda
- edge cases temporales

---

## 8. Conclusion

Gota ya no es solo un expense tracker simple.

El producto ya tiene piezas de:

- ledger personal
- cashflow tracker
- debt tracker
- account model
- planning assistant

El riesgo hoy es quedarse en una mitad de camino:

- demasiada complejidad para ser solo un tracker
- todavia poca consolidacion para ser un sistema financiero verdaderamente confiable

La mejor oportunidad estrategica es profundizar la tesis local:

**captura ultrarrapida + logica financiera realmente util para Argentina**

Eso implica priorizar:

1. consistencia contable
2. tarjetas y deuda bien modeladas
3. multimoneda real
4. cuotas como ventaja competitiva local
5. planning y compromisos futuros

Si Gota cierra esas cinco cosas, puede quedar mas adaptado al caso argentino que varios referentes globales, incluso si sigue siendo mas chico en superficie de producto.
