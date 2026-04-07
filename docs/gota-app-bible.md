# Gota App Bible

## 1. Propósito de Este Documento

Este documento es la referencia maestra de Gota. Su objetivo es explicar, en lenguaje de negocio, qué es la aplicación, cómo está pensada, qué puede hacer hoy, cómo se conectan sus partes, cómo calcula sus números principales y qué estructura técnica la sostiene.

No reemplaza a los otros documentos del repo. Los complementa:

- `VISION.md` explica la promesa del producto.
- `FEATURES.md` inventaria lo implementado.
- `ARCHITECTURE.md` resume la arquitectura técnica.
- `DESIGN.md` describe la experiencia y patrones de interfaz.
- `CONVENTIONS.md` documenta criterios de ingeniería.
- `docs/gota-prd.md`, `docs/gota-app-flows.md` y `docs/gota-backend-structure.md` contienen detalle histórico y de implementación.

La idea de esta "biblia" es unir todo eso en una sola narrativa.

## 2. Qué Es Gota

Gota es una app de finanzas personales para Argentina orientada a responder una pregunta concreta: cuánta plata tenés realmente disponible hoy.

La app no está pensada como un simple libro contable. No busca solamente listar gastos o mostrar categorías. Su propuesta es operativa: ayudarte a entender tu capacidad real de gasto considerando al mismo tiempo:

- ingresos
- cuentas y saldos
- gastos inmediatos
- gastos con tarjeta
- pagos de tarjeta
- transferencias entre cuentas propias
- arrastre de saldo entre meses
- suscripciones
- opcionalmente rendimiento e instrumentos

El producto intenta resolver dos problemas típicos de las apps financieras:

- mucha fricción para registrar movimientos
- poca confianza en el número final

Por eso Gota combina dos ideas centrales:

- `Smart Input`: registrar un gasto escribiendo una frase natural
- `Saldo Vivo`: consolidar lo importante en un número que tenga sentido operativo

## 3. Principios del Producto

### 3.1 Fricción Baja

Registrar algo no debería sentirse como llenar un formulario contable. Por eso la app prioriza un campo de texto único y una confirmación rápida.

### 3.2 Confianza

Gota intenta que el usuario pueda contrastar lo que ve con su realidad bancaria. La lógica de `Saldo Vivo`, cuentas, pagos de tarjeta y rollover existe para que el número no sea decorativo.

### 3.3 Visión Operativa

La app diferencia entre gasto que ya impacta en caja y gasto que todavía no salió realmente porque quedó financiado vía tarjeta. Esa distinción atraviesa toda la aplicación.

### 3.4 Lectura Mensual

El mes sigue siendo la unidad principal de análisis. Muchas pantallas, consultas y cálculos trabajan sobre un mes seleccionado en formato `YYYY-MM`.

## 4. Conceptos Fundamentales del Negocio

### 4.1 Saldo Vivo

Es el concepto más importante del producto. Busca responder cuánto dinero disponible real queda en el mes, teniendo en cuenta ingresos, saldo inicial o balances de cuenta, gastos percibidos y pagos de tarjeta.

En lenguaje simple:

- suma lo que entró
- toma el saldo inicial o rollover
- resta lo que ya salió efectivamente
- resta lo pagado de tarjetas

No trata de la misma forma una compra con crédito que una compra con débito o efectivo.

### 4.2 Disponible Real

Es una lectura complementaria al `Saldo Vivo`. En la app existe como segundo modo del hero principal del dashboard. Conceptualmente apunta a mostrar una visión más aterrizada del disponible actual, apoyada en balances y breakdown por cuenta.

### 4.3 Gasto Percibido

Son gastos que ya pegan en la caja del usuario. En la lógica actual eso incluye gastos cuyo `payment_method` es:

- `CASH`
- `DEBIT`
- `TRANSFER`

Siempre que no sean categoría `Pago de Tarjetas`.

### 4.4 Gasto en Tarjeta

Es un gasto registrado con `payment_method = CREDIT`. Se considera un consumo real para análisis, compromisos y lectura financiera, pero no siempre impacta inmediatamente como salida de dinero disponible.

### 4.5 Pago de Tarjeta

Es un caso especial. En la base de gastos vive como una categoría específica: `Pago de Tarjetas`. La app lo trata distinto de una compra con crédito.

Idea de negocio:

- una compra con tarjeta registra obligación
- un pago de tarjeta registra salida real de dinero

### 4.6 Ingresos

La app hoy convive con dos modelos:

- modelo viejo: `monthly_income`
- modelo nuevo: `income_entries`

La dirección del producto y del código apunta al segundo. Cuando hay datos del modelo nuevo, muchas pantallas lo priorizan.

### 4.7 Transferencias

Son movimientos entre cuentas propias. No son ingresos ni gastos de consumo. Sirven para mover dinero entre billeteras, bancos o monedas sin distorsionar el análisis del gasto.

### 4.8 Rollover

Es el arrastre de saldo entre meses. Si queda plata al cierre de un mes, la app puede usarla como base para el siguiente.

Hoy el sistema soporta:

- `off`
- `auto`
- técnicamente `manual`, aunque no está expuesto de forma consistente en UI

### 4.9 Cuentas

Las cuentas representan dónde vive el dinero del usuario. Pueden ser:

- `bank`
- `digital`
- `cash`

También existe el concepto de cuenta principal, importante para asignar movimientos que no tienen cuenta explícita.

### 4.10 Suscripciones

Son gastos recurrentes esperados. La app puede generar automáticamente el gasto del mes cuando corresponde y guardar trazabilidad para no duplicarlo.

### 4.11 Instrumentos y Rendimiento

Son capacidades más avanzadas y hoy están controladas por feature flags.

- `yield` modela rendimiento diario sobre cuentas
- `instruments` modela activos como `plazo_fijo` y `fci`

### 4.12 Monedas

La app trabaja con `ARS` y `USD`. Muchas pantallas permiten cambiar moneda de visualización, pero los datos se guardan con su moneda original.

## 5. Cómo Está Organizada la Aplicación

Gota está organizada en módulos funcionales. Cada uno resuelve una parte del problema del usuario, pero todos terminan alimentando una vista integrada del dinero.

Los módulos principales son:

- autenticación
- onboarding
- dashboard
- smart input
- gastos e historial
- movimientos
- analytics
- ingresos
- transferencias
- cuentas
- tarjetas
- suscripciones
- instrumentos y rendimiento
- settings

Técnicamente, esos módulos se reparten entre:

- `app/`: rutas, pantallas y endpoints
- `components/`: UI por feature
- `lib/`: lógica de negocio e integraciones
- `types/`: modelo tipado de datos

## 6. Qué Puede Hacer el Usuario Hoy

Hoy el usuario puede, en términos generales:

- iniciar sesión con Google
- explorar con sesión anónima según flujo disponible
- completar onboarding
- crear una cuenta principal
- configurar saldos iniciales
- registrar gastos con lenguaje natural
- confirmar o ajustar el parseo del gasto antes de guardarlo
- registrar compras con tarjeta
- registrar pagos de tarjeta
- cargar ingresos
- crear ingresos recurrentes
- transferir dinero entre cuentas
- administrar cuentas y tarjetas
- registrar y revisar suscripciones
- ver movimientos del mes
- ver historial de gastos
- abrir analíticas de comportamiento
- exportar gastos
- cambiar moneda de visualización
- usar rollover
- si los flags están activos, usar rendimiento e instrumentos

## 7. Flujo Completo del Usuario

## 7.1 Login y Acceso

La puerta de entrada principal es el login. El flujo soporta autenticación vía Google usando Supabase Auth. También hay evidencia de flujo anónimo/exploratorio y de conversión posterior a cuenta permanente.

Técnicamente:

- la pantalla vive en `app/(auth)/login`
- el callback de OAuth vive en `app/auth/callback/route.ts`

## 7.2 Onboarding

El onboarding existe para que el usuario entienda la lógica de Gota antes de usarla en serio. No es solo un tutorial; también configura datos mínimos para que `Saldo Vivo` tenga sentido.

El recorrido actual incluye:

- explicación del concepto `Saldo Vivo`
- creación de cuenta principal
- registro de saldo inicial
- primera interacción con `Smart Input`

Técnicamente:

- la ruta está en `app/onboarding`
- el flujo se orquesta desde `app/onboarding/OnboardingFlow.tsx`
- los pasos viven en `app/onboarding/steps`
- el estado de completitud se guarda en `user_config`

## 7.3 Uso Diario

Una vez adentro, la experiencia diaria gira alrededor del dashboard.

Desde ahí el usuario puede:

- ver el número principal
- alternar entre `Saldo Vivo` y `Disponible Real`
- cambiar de mes
- cambiar moneda
- registrar un gasto
- revisar últimos movimientos
- abrir acciones operativas como ingreso, suscripción, transferencia o instrumentos

## 7.4 Gestión Mensual

La app está pensada para usarse a lo largo del mes, pero con conciencia de cierre y continuidad entre meses. Por eso aparecen:

- rollover
- pagos de tarjeta
- ingresos recurrentes
- suscripciones del mes
- movimientos agrupados por período

## 7.5 Revisión y Comprensión

El usuario no solo registra. También puede revisar:

- qué se movió en `Movimientos`
- qué gastó en `Expenses`
- qué patrones aparecen en `Analytics`

## 8. Módulo por Módulo

## 8.1 Onboarding

### Objetivo de negocio

Lograr que el usuario llegue al dashboard con una configuración mínima viable y entendiendo qué significa `Saldo Vivo`.

### Qué ve el usuario

Un recorrido guiado con pasos secuenciales.

### Qué acciones puede hacer

- definir ingresos o base conceptual del disponible
- crear cuenta principal
- cargar saldo inicial
- probar el registro de un gasto

### Qué datos consume y produce

Produce configuración inicial del usuario y, según el paso, también cuenta, balances y primer gasto.

### Nota técnica

El onboarding está implementado como flujo propio dentro de `app/onboarding`. No es solo UI: deja persistencia real en la base.

## 8.2 Dashboard

### Objetivo de negocio

Ser la cabina central de la app. Tiene que responder rápido cuánto dinero hay, qué pasó recientemente y qué acción conviene hacer.

### Qué ve el usuario

- hero principal
- toggle entre `Saldo Vivo` y `Disponible Real`
- selector de mes
- selector de moneda
- últimos movimientos
- banners operativos
- smart input flotante

### Qué datos consume y produce

Consume datos agregados de cuentas, ingresos, gastos, tarjetas, suscripciones, transferencias y, opcionalmente, rendimiento e instrumentos.

### Nota técnica

El dashboard se alimenta principalmente desde `app/api/dashboard/route.ts`. Ese endpoint concentra una parte importante de la orquestación del sistema:

- lee `user_config`
- carga cuentas y tarjetas
- revisa ingresos viejos y nuevos
- trae gastos y transferencias del mes
- ejecuta auto-inserción de suscripciones
- procesa rendimiento diario si corresponde
- calcula rollover si corresponde

Es uno de los archivos más importantes para entender cómo piensa la app.

## 8.3 Smart Input

### Objetivo de negocio

Reducir al mínimo la fricción de registrar gastos.

### Qué hace

El usuario escribe algo como una frase cotidiana y la app intenta convertir eso en un gasto estructurado.

Ejemplo conceptual:

`"café 2500 con amigos"`

La app intenta extraer:

- monto
- moneda
- categoría
- descripción
- si fue deseo o necesidad
- método de pago
- fecha

### Nota técnica

El parsing ocurre en `app/api/parse-expense/route.ts`.

Ese endpoint:

- exige usuario autenticado
- aplica rate limit por usuario
- arma un prompt para Gemini
- parsea la respuesta JSON
- la valida con Zod

La integración con IA vive en:

- `lib/gemini/client.ts`
- `lib/gemini/prompts.ts`
- `lib/validation/schemas.ts`

## 8.4 Expenses

### Objetivo de negocio

Dar un historial más directo de gastos, separado de ingresos y transferencias.

### Qué permite

- ver gastos por mes
- filtrar por categoría
- filtrar por método de pago
- editar
- borrar

### Nota técnica

La pantalla vive en `app/(dashboard)/expenses/page.tsx`. El modelo principal es la tabla `expenses`.

Esa tabla también soporta:

- cuotas
- asociación a tarjeta
- asociación a cuenta
- moneda
- vínculo opcional a suscripción

## 8.5 Movimientos

### Objetivo de negocio

Dar una lectura operativa unificada de todo lo que se movió.

### Qué mezcla

- gastos
- ingresos
- transferencias
- rendimiento, si está activo

### Qué lo vuelve importante

Es la vista más cercana a un "ledger operativo" del usuario. Permite entender el mes sin separar mentalmente cada tipo de entidad.

### Nota técnica

El endpoint `app/api/movimientos/route.ts`:

- carga varias colecciones en paralelo
- permite filtrar por tipo, origen, cuenta, categoría y moneda
- arma una lista unificada de movimientos
- calcula estadísticas auxiliares como:
  - `percibidos`
  - `tarjeta`
  - `pagoTarjeta`

## 8.6 Analytics

### Objetivo de negocio

Transformar registro en comprensión. No solo mostrar números, sino ayudar al usuario a detectar hábitos, fugas y compromisos.

### Qué incluye

- ranking por categoría
- split necesidad/deseo
- gasto de fin de semana
- goteo
- compromisos
- hero textual con interpretación

### Nota técnica

La capa de analytics combina datos del backend con lógica local. Parte del procesamiento vive en:

- `app/api/analytics-data/route.ts`
- `lib/analytics/*`
- `lib/heroEngine/*`

El `heroEngine` es relevante porque no solo calcula números: genera lectura narrativa de esos números.

## 8.7 Income

### Objetivo de negocio

Registrar entradas de dinero y sostener el cálculo del mes.

### Qué permite

- crear ingresos manuales
- clasificarlos
- asociarlos a cuenta
- generar o usar ingresos recurrentes

### Nota técnica

El sistema convive con dos modelos:

- `monthly_income`: agregado mensual legacy
- `income_entries`: entradas individuales nuevas

Muchos cálculos priorizan `income_entries` y usan `monthly_income` como fallback.

## 8.8 Transfers

### Objetivo de negocio

Mover plata entre cuentas sin contaminar la lectura de consumo.

### Qué permite

- transferencias entre cuentas propias
- movimientos entre monedas
- uso de tipo de cambio en transferencias cruzadas

### Nota técnica

La tabla `transfers` registra:

- cuenta origen
- cuenta destino
- monto origen
- monto destino
- moneda origen
- moneda destino
- tipo de cambio opcional

En dashboard y rollover, las transferencias afectan balances por cuenta, pero no se comportan como gasto de consumo.

## 8.9 Accounts

### Objetivo de negocio

Representar dónde está el dinero y permitir que el usuario estructure su realidad financiera.

### Qué permite

- crear cuentas
- marcar una cuenta principal
- editar
- archivar
- borrar cuando no haya dependencias

### Nota técnica

Las cuentas son claves para:

- asignación de saldo inicial
- breakdown del dashboard
- ingresos asociados
- transferencias
- rendimiento diario

Además, la cuenta principal sirve como fallback cuando un movimiento no trae `account_id`.

## 8.10 Cards

### Objetivo de negocio

Separar el consumo con crédito del impacto real en caja.

### Qué permite

- crear tarjetas
- definir día de cierre
- definir día de vencimiento
- asociar cuenta de pago

### Nota técnica

Las tarjetas viven como entidad propia y participan en dos momentos distintos:

- durante la compra con crédito
- durante el pago de tarjeta

El sistema además calcula prompts de pago según el ciclo de cierre/vencimiento.

## 8.11 Subscriptions

### Objetivo de negocio

Dar visibilidad y consistencia a gastos recurrentes que suelen olvidarse o subestimarse.

### Qué permite

- crear
- editar
- desactivar
- revisar
- insertar automáticamente el gasto del mes

### Nota técnica

El dashboard ejecuta una lógica de auto-inserción en `processSubscriptions()`:

- busca suscripciones activas
- revisa si ya fueron insertadas ese mes
- si no lo fueron y ya llegó el día correspondiente, crea el gasto
- registra la inserción en `subscription_insertions`

Eso evita duplicados por mes.

## 8.12 Instruments y Yield

### Objetivo de negocio

Extender Gota más allá del gasto diario hacia una lectura más completa del patrimonio líquido y sus rendimientos.

### Estado actual

Existen implementados, pero detrás de feature flags.

### Nota técnica

Las flags visibles hoy son:

- `FF_YIELD`
- `FF_INSTRUMENTS`

`yield` acredita rendimiento diario en cuentas habilitadas. `instruments` maneja activos como `plazo_fijo` y `fci`.

## 8.13 Settings

### Objetivo de negocio

Concentrar la configuración estructural del sistema.

### Qué permite

- cambiar moneda por defecto
- administrar cuentas
- administrar tarjetas
- configurar rollover visible
- cerrar sesión

### Nota técnica

Aunque es una pantalla de configuración, tiene mucho impacto operativo porque modifica entidades que afectan cálculos en cascada.

## 9. Cómo Se Conectan las Partes Entre Sí

Gota no está compuesta por módulos aislados. El valor del producto aparece cuando una acción en un lugar impacta correctamente en otros lugares.

Ejemplos:

- crear un ingreso puede cambiar el dashboard, movimientos y analytics
- registrar una compra con tarjeta afecta historial y análisis, pero no igual que un gasto percibido
- registrar un pago de tarjeta impacta `Saldo Vivo`
- una transferencia cambia balances por cuenta, pero no debería aparecer como gasto de consumo
- una suscripción activa puede materializarse automáticamente como gasto del mes
- el rollover toma el cierre del mes anterior y condiciona el siguiente

Técnicamente, esta integración se resuelve con una mezcla de:

- API routes locales tipo BFF
- consultas a Supabase
- módulos de lógica en `lib/`
- refresco de UI vía fetch, React Query y `router.refresh()`

## 10. Cálculos Clave de la App

## 10.1 Saldo Vivo

### Explicación de negocio

Busca mostrar la plata realmente disponible del período, no simplemente el total gastado.

### Fórmula conceptual

`saldo inicial + ingresos - gastos percibidos - pagos de tarjeta`

Donde:

- gastos percibidos = gastos no crédito y no `Pago de Tarjetas`
- pagos de tarjeta = gastos de categoría `Pago de Tarjetas`

### Nota técnica

La lógica se ve especialmente en:

- `app/api/dashboard/route.ts`
- `lib/rollover.ts`

En `lib/rollover.ts`, funciones como `buildPrevMonthSummary()` y `calcularSaldoFinal()` hacen explícita esta lectura.

## 10.2 Diferencia entre Compra con Tarjeta y Pago de Tarjeta

### Explicación de negocio

Una compra con tarjeta genera compromiso. Un pago de tarjeta genera salida efectiva.

### Impacto en la app

- compra con tarjeta: se registra como gasto con `payment_method = CREDIT`
- pago de tarjeta: se registra como gasto especial con categoría `Pago de Tarjetas`

Esta distinción es crítica para que el dashboard no reste dos veces o reste en el momento equivocado.

## 10.3 Ingresos

### Explicación de negocio

Los ingresos son la base de la capacidad de gasto del mes.

### Nota técnica

Muchos flujos hacen esta prioridad:

- primero sumar `income_entries`
- si no hay, usar `monthly_income`

Eso se ve en dashboard, analytics y otros endpoints.

## 10.4 Rollover

### Explicación de negocio

Si el mes anterior cerró con saldo, ese valor puede alimentar el arranque del siguiente.

### Nota técnica

`lib/rollover.ts` resuelve dos ideas:

- resumen del cierre anterior
- construcción de balances por cuenta para el nuevo período

La función `buildSmartPerAccountBalances()` hace algo importante: calcula el cierre por cuenta considerando balances previos, ingresos, gastos directos, pagos de tarjeta y transferencias internas.

## 10.5 Balances por Cuenta

### Explicación de negocio

No alcanza con saber el total. Gota también intenta saber cómo se reparte ese total entre cuentas.

### Nota técnica

La tabla `account_period_balance` guarda la base mensual por cuenta. Esa base puede venir de:

- `opening`
- `rollover_auto`
- `manual`

## 10.6 Transferencias

### Explicación de negocio

Mueven dinero, no necesariamente cambian riqueza.

### Nota técnica

En la lógica de balances:

- la cuenta origen pierde
- la cuenta destino gana

Si la transferencia es entre monedas, el sistema usa `amount_from`, `amount_to` y `exchange_rate`.

## 10.7 Rendimiento Diario

### Explicación de negocio

Si una cuenta genera rendimiento, la app puede sumarlo al resultado del mes.

### Nota técnica

`lib/yieldEngine.ts` implementa una acreditación diaria con estas características:

- fórmula diaria sobre saldo base
- capitalización compuesta
- idempotencia diaria
- catch-up si hubo días sin correr
- respeto por override manual

Es una lógica avanzada y actualmente gated por flag.

## 10.8 Analytics

### Explicación de negocio

Analytics busca convertir movimientos en patrones legibles.

### Nota técnica

Parte del cálculo vive en utilidades de `lib/analytics/` y parte del relato final se construye con `lib/heroEngine/`.

## 11. Modelo de Datos Explicado en Lenguaje Humano

Las entidades más importantes son:

- `accounts`: lugares donde vive el dinero
- `cards`: tarjetas de crédito
- `expenses`: gastos y pagos de tarjeta
- `income_entries`: ingresos individuales
- `monthly_income`: ingreso mensual legacy
- `recurring_incomes`: plantillas de ingresos recurrentes
- `account_period_balance`: saldo base de cada cuenta por período
- `subscriptions`: gastos recurrentes
- `subscription_insertions`: control para no duplicar inserciones
- `transfers`: movimientos entre cuentas propias
- `yield_accumulator`: rendimiento acumulado del mes
- `instruments`: activos financieros
- `user_config`: configuración general del usuario

Idea importante: el modelo actual no es completamente "cerrado". El sistema todavía convive con estructuras legacy y nuevas, especialmente en ingresos y balances mensuales.

## 12. Arquitectura Técnica de Alto Nivel

La app usa:

- Next.js App Router
- React
- TypeScript strict
- Supabase como auth + base de datos
- Tailwind para UI
- Gemini para parseo de gasto natural
- React Query de forma selectiva

### Patrón principal

La UI muchas veces no pega directo a Supabase desde cualquier componente. En cambio, usa endpoints locales en `app/api/*` que funcionan como BFF.

Eso permite centralizar:

- auth
- validación
- compatibilidad entre modelos viejos y nuevos
- reglas de negocio
- orquestación con IA

## 13. Integraciones Externas

### 13.1 Supabase

Cumple varios roles:

- autenticación
- sesiones
- persistencia relacional
- consultas RPC

### 13.2 Gemini

Se usa hoy principalmente para el parseo del `Smart Input`.

### 13.3 Vercel

Es la plataforma esperada de deploy del proyecto.

### 13.4 PWA

La app incluye manifest y service worker. No es una app nativa, pero se comporta con mentalidad mobile-first e instalable.

## 14. Reglas de Negocio y Casos Especiales

Hay reglas que son esenciales para no romper el sentido del producto:

- una compra con tarjeta no es lo mismo que un pago de tarjeta
- una transferencia no debe inflar ingresos ni gastos de consumo
- una suscripción no debe insertarse dos veces en el mismo mes
- si un movimiento no tiene cuenta, muchas veces se resuelve contra la cuenta principal
- los meses son unidades fuertes de cálculo y comparación
- el sistema debe evitar mezclar ARS y USD en cálculos simples
- el rendimiento diario no debe acreditarse dos veces el mismo día

También existen tensiones o zonas grises:

- coexistencia entre `monthly_income` e `income_entries`
- soporte técnico de `manual` rollover sin exposición total en UI
- funcionalidades avanzadas detrás de flags

## 15. Estado Actual del Sistema

Gota ya está más cerca de un producto real que de un prototipo. Tiene estructura completa de app, backend, onboarding, dashboard, movimientos, analytics y settings.

Pero todavía muestra señales de evolución:

- migración de modelo de ingresos
- algunas capacidades parcialmente expuestas
- deuda de pruebas automatizadas
- ciertas inconsistencias de UX o encoding

La lectura correcta no es "app cerrada y congelada", sino "producto vivo con núcleo sólido y áreas en transición".

## 16. Mapa del Repo para Humanos

Si alguien no técnico quiere entender el repo, la guía simple es esta:

- `docs/`: documentación y contexto
- `app/`: pantallas y endpoints
- `components/`: bloques visuales y de interacción
- `lib/`: lógica importante
- `types/`: forma de los datos
- `public/`: assets estáticos

Carpetas que no hace falta leer para entender el producto:

- `.next/`
- `node_modules/`

Carpetas útiles para tooling, pero no centrales al producto:

- `.agents/`
- `.claude/`
- `.github/`

Ruta sugerida de lectura para founder o PM:

1. este documento
2. `VISION.md`
3. `FEATURES.md`
4. `docs/gota-app-flows.md`
5. `ARCHITECTURE.md`

Ruta sugerida para dev nuevo:

1. este documento
2. `ARCHITECTURE.md`
3. `FEATURES.md`
4. `app/api/dashboard/route.ts`
5. `lib/rollover.ts`
6. `app/api/parse-expense/route.ts`
7. `app/api/movimientos/route.ts`
8. `app/api/analytics-data/route.ts`

## 17. Glosario

### Saldo Vivo

Número central del producto que intenta representar dinero realmente disponible.

### Disponible Real

Vista complementaria del disponible, presentada como alternativa en el hero del dashboard.

### Gasto Percibido

Gasto que ya impactó efectivamente en caja.

### Pago de Tarjetas

Categoría especial usada para registrar el momento en que sale el dinero para cancelar deuda de tarjeta.

### Rollover

Arrastre de saldo útil entre un mes y el siguiente.

### Smart Input

Campo de texto libre que convierte lenguaje natural en un gasto estructurado.

### BFF

Backend-for-frontend. En este caso, endpoints locales de Next.js que median entre UI, Supabase y lógica de negocio.

## 18. Referencias Clave

Documentos:

- `VISION.md`
- `FEATURES.md`
- `ARCHITECTURE.md`
- `DESIGN.md`
- `CONVENTIONS.md`
- `docs/gota-prd.md`
- `docs/gota-app-flows.md`
- `docs/gota-backend-structure.md`

Archivos técnicos importantes:

- `app/api/dashboard/route.ts`
- `app/api/parse-expense/route.ts`
- `app/api/movimientos/route.ts`
- `app/api/analytics-data/route.ts`
- `lib/rollover.ts`
- `lib/yieldEngine.ts`
- `types/database.ts`
