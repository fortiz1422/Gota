# Roadmap de Deudas Tecnicas y de Negocio

**Fecha:** 2026-04-07  
**Objetivo:** convertir las deudas abiertas de Gota en un backlog operativo, priorizado y accionable.

Este documento no busca listar ideas sueltas. Busca ordenar los problemas reales del sistema para poder trabajarlos sin mezclar:

- bugs visibles
- decisiones de producto no cerradas
- deuda técnica estructural
- features legacy que siguen condicionando el código actual

La base de este roadmap surge de:

- auditoría histórica del producto en `docs/Gota-Product History.md`
- observación del código actual
- inconsistencias ya detectadas en Home / Saldo Vivo / breakdown / ingresos

## 1. Criterios de priorización

Para ordenar el trabajo, usamos cuatro niveles:

### P0 · Crítico

Temas que afectan la confianza del usuario, la consistencia del dinero mostrado o la base contable del producto.

### P1 · Estructural

Temas que no siempre rompen la UX hoy, pero aumentan fuertemente la complejidad, duplican lógica o frenan features futuras.

### P2 · Calidad / Robustez

Temas de ingeniería que no redefinen producto, pero exponen al sistema a bugs difíciles de detectar o recuperar.

### P3 · Limpieza / Legacy

Temas de mantenimiento, documentación, código viejo o inconsistencias no críticas, pero que degradan claridad y velocidad de desarrollo.

## 2. Resumen del estado actual

Gota hoy ya tiene una base funcional sólida:

- Home operativo
- SmartInput
- multicuenta
- transfers
- analytics
- movimientos
- suscripciones
- tarjetas

El problema no es falta de features. El problema es que varias piezas importantes del modelo financiero todavía conviven en transición:

- `monthly_income`
- `income_entries`
- `account_period_balance`
- `rollover`
- breakdown por cuenta
- RPC principal de dashboard

Eso produce tres tipos de riesgo:

1. el mismo concepto puede calcularse en más de un lugar
2. una pantalla puede mostrar un número distinto a otra por timing o por fórmula
3. agregar una feature nueva obliga a decidir entre caminos viejos y nuevos

La prioridad de este roadmap es cerrar esas ambigüedades primero.

### 2.1 Estado actualizado

Desde la redaccion inicial ya se avanzo en dos frentes del hero financiero.

`Saldo Vivo`

- ya quedo redefinido como metrica historica, no mensual
- ya usa `opening_balance` por cuenta mas movimientos historicos reales
- ya no depende del mes navegado para el hero
- ya se migraron los openings auditados del usuario principal a `accounts`

`Disponible Real`

- ya quedo definido como `Saldo Vivo - deuda pendiente de tarjetas`
- ya distingue pagos legacy de tarjeta con `is_legacy_card_payment`
- ya excluye esos pagos legacy del calculo de deuda pendiente
- ya tiene flujo UX separado del boton `Pagar resumen`

Pendientes operativos concretos:

- cerrar el siguiente bloque estructural despues del frente de ingresos

### 2.2 Progreso reciente

Ultimos avances aplicados:

- `Disponible Real` ya quedo cerrado operativamente con migracion y etiquetado legacy aplicados
- dashboard y analytics ya dejaron de usar `monthly_income` como fuente principal de ingresos
- el setup legacy de ingresos ahora crea `income_entries`
- se elimino una superficie legacy muerta que seguia escribiendo `monthly_income`
- el borrado de cuenta ya contempla `income_entries` y tablas nuevas del modelo financiero

Decisiones parciales ya tomadas:

- `income_entries` queda como fuente operativa de ingresos
- `monthly_income` queda acotado a compatibilidad residual y cierre legacy de mes
- `rollover` se mantiene por ahora, pero no debe volver al calculo principal de `Saldo Vivo`

## 3. Roadmap priorizado

## P0 · Crítico

### 3.1 Fuente de verdad de `Saldo Vivo`

**Problema**

`Saldo Vivo` sigue dependiendo de un modelo híbrido. Hoy su valor final puede verse afectado por:

- RPC `get_dashboard_data`
- `account_period_balance`
- `monthly_income`
- `income_entries`
- `rollover`
- breakdown por cuenta
- ajustes por transferencias
- rendimientos
- capital inmovilizado

Aunque la UI ya funciona, el sistema todavía no tiene una única definición simple y cerrada de cuál es la fuente de verdad principal.

**Por qué existe hoy**

El producto fue evolucionando desde una lógica mensual más simple hacia un modelo más contable y multicuenta. El sistema nuevo no reemplazó completamente al anterior: conviven ambos.

**Impacto real**

- riesgo de mostrar valores distintos para el mismo concepto
- glitches visuales por cargas en distinto orden
- dificultad para debuggear bugs financieros
- dificultad para saber qué endpoint o cálculo corregir
- alto costo mental para cambiar Home sin romper otra vista

**Decisión pendiente**

Definir explícitamente si `Saldo Vivo` debe derivarse de:

1. `saldo inicial histórico por cuenta + ledger acumulado de movimientos`
2. snapshots mensuales (`account_period_balance`) + movimientos del período
3. una mezcla de ambos

**Recomendación**

La recomendación es cerrar el sistema sobre una fuente de verdad contable única:

`saldo base por cuenta + movimientos históricos con impacto real`

Y dejar snapshots mensuales como derivados, no como input principal.

**Trabajo técnico esperado**

- mapear todas las fuentes actuales que impactan `Saldo Vivo`
- documentar fórmula final por moneda
- decidir el rol exacto de `account_period_balance`
- alinear hero, breakdown, sheet y analytics resumidos
- eliminar overrides tardíos o cálculos duplicados

**Riesgos / edge cases**

- transferencias cross-currency
- gastos con tarjeta vs pagos de tarjeta
- instrumentos activos
- rendimiento acumulado
- movimientos sin `account_id`

**Criterio de cierre**

- existe una definición oficial del cálculo
- Home y detalle por cuenta derivan del mismo modelo
- no hay overrides de una fuente sobre otra para el mismo número
- el cálculo está documentado en un doc de arquitectura o producto

**Estado actualizado**

Quedo resuelta la direccion principal:

- `Saldo Vivo` paso a modelo historico
- hero y detalle principal ya no dependen del mes navegado
- se eliminaron overrides tardios entre fuentes para el hero
- los openings reales auditados se migraron a `accounts`

Sigue pendiente:

- terminar de cerrar el rol residual de tablas legacy alrededor del modelo
- alinear documentacion final del sistema contable

**Prioridad**

P0

---

### 3.2 Migración pendiente: `monthly_income` vs `income_entries`

**Problema**

Hoy conviven dos modelos de ingresos:

- `monthly_income` como sistema legacy mensual
- `income_entries` como sistema nuevo granular

El código prioriza el nuevo cuando existe, pero la convivencia sigue afectando dashboard, analytics y rollover.

**Por qué existe hoy**

La migración se hizo parcialmente para no romper el comportamiento existente.

**Impacto real**

- reglas de prioridad duplicadas
- riesgo de casos mixtos difíciles de entender
- mantenimiento más caro
- dudas de UX sobre cuál es la forma “real” de registrar ingresos

**Decisión pendiente**

Definir si `monthly_income`:

- se elimina del cálculo principal
- queda sólo como legacy / compatibilidad
- o sobrevive como feature de UX separada y explícita

**Recomendación**

Sacar `monthly_income` del corazón contable y dejarlo, si sigue existiendo, como herramienta auxiliar de UX con un rol muy acotado.

**Trabajo técnico esperado**

- listar todos los lugares donde hoy se usa `monthly_income`
- clasificar uso contable vs uso visual
- migrar lógica central a `income_entries`
- decidir estrategia para datos históricos

**Riesgos / edge cases**

- usuarios viejos con datos sólo en `monthly_income`
- meses sin ingresos granulares pero con configuración legacy
- interacción con rollover

**Criterio de cierre**

- el sistema tiene una política explícita y única sobre ingresos
- la prioridad entre ambos modelos deja de estar duplicada
- el comportamiento está documentado para usuarios nuevos y legacy

**Prioridad**

P0

---

**Estado actualizado**

Avance parcial importante:

- dashboard y analytics ya dejaron de usar `monthly_income` como fuente principal de ingresos
- el setup legacy de ingresos ahora crea `income_entries`
- se elimino una superficie legacy muerta que seguia escribiendo `monthly_income`
- `monthly_income` quedo acotado a compatibilidad residual y cierre legacy de mes

Sigue pendiente:

- decidir el destino final de `/api/monthly-income`
- resolver estrategia para usuarios o meses historicos que solo tengan datos en `monthly_income`
- simplificar helpers y documentacion para reflejar que `income_entries` es la fuente operativa

### 3.3 Rol real de `account_period_balance`

**Problema**

`account_period_balance` hoy actúa a veces como snapshot derivado y a veces como dato operativo que influye en Home. Esa ambigüedad contamina la arquitectura.

**Por qué existe hoy**

Fue útil como infraestructura para rollover, balances por cuenta y comparativas mensuales, pero nunca se terminó de cerrar si es dato editable/semilla o simple snapshot calculado.

**Impacto real**

- difícil saber cuándo confiar en el snapshot
- mezcla entre modelo histórico y modelo mensual
- potencial desalineación entre cuenta individual y total consolidado

**Decisión pendiente**

Definir si `account_period_balance` es:

1. snapshot derivado
2. input editable
3. mecanismo interno sólo para rollover

**Recomendación**

Tratarlo como snapshot derivado siempre que sea posible.

**Trabajo técnico esperado**

- inventariar todos los writers y readers de `account_period_balance`
- separar casos de inicialización/manualidad de casos derivados
- prohibir que sea la fuente principal de un número contable vivo, salvo si se justifica explícitamente

**Riesgos / edge cases**

- cuentas recién creadas
- edición de opening balances
- meses proyectados
- rollover manual / auto

**Criterio de cierre**

- el rol de la tabla queda escrito y respetado por el código
- no existen usos contradictorios entre endpoints

**Estado actualizado**

Parcialmente acotado.

Ya se decidio que `account_period_balance` no debe ser la fuente principal del hero ni del total vivo. Falta cerrar formalmente si queda solo como snapshot derivado o si conserva algun uso manual controlado.

**Prioridad**

P0

---

### 3.4 Disponible Real y pagos legacy de tarjeta

**Problema**

`Disponible Real` se rompia para usuarios que empezaban a usar Gota con deuda previa de tarjeta. Los pagos de esa deuda vieja bajaban correctamente `Saldo Vivo`, pero tambien reducian la deuda pendiente aunque Gota no tuviera cargados los consumos originales.

**Por qué existe hoy**

El sistema original asumía que todo `Pago de Tarjetas` compensaba consumos que Gota ya conocía.

**Impacto real**

- `Disponible Real` inflado artificialmente
- onboarding peor para usuarios con deuda arrastrada
- perdida de confianza en el hero

**Decisión tomada**

Se aprobó mantener la categoría `Pago de Tarjetas` y distinguir pagos legacy con un flag:

- `is_legacy_card_payment = true`

Reglas ya cerradas:

- pago legacy baja `Saldo Vivo`
- pago legacy no baja deuda pendiente de `Disponible Real`
- `Pagar resumen` queda reservado para resúmenes calculados por Gota
- el pago legacy entra por un modal separado en la pantalla de tarjeta

**Trabajo realizado**

- soporte de schema y tipos para `is_legacy_card_payment`
- ajuste del backend para excluir pagos legacy del cálculo de deuda pendiente
- UX separada para pagos anteriores a los resúmenes de Gota
- SQL preparado para marcar pagos legacy históricos ya existentes

**Pendiente**

- correr la migración SQL en Supabase
- marcar los pagos históricos legacy reales
- validar número final de `Disponible Real`

**Criterio de cierre**

- la migración está corrida
- los pagos históricos relevantes están etiquetados
- `Disponible Real` cierra con la expectativa real del usuario

**Prioridad**

P0

---

### 3.5 Auditoría completa de cuotas

**Problema**

Cuotas existe en UI, esquema y partes del flujo, pero no está cerrada como feature completamente auditada de punta a punta.

**Por qué existe hoy**

Se implementó parcialmente para cubrir casos reales, pero sin una validación final integral del comportamiento contable y de UX.

**Impacto real**

- riesgo de cargos múltiples incorrectos
- riesgo de inconsistencia en movimientos, tarjetas y analytics
- dificultad para soportar reclamos del usuario si una compra en cuotas queda mal expandida

**Decisión pendiente**

Definir si cuotas:

- queda como feature oficialmente soportada
- se simplifica
- o se recorta hasta auditarla correctamente

**Recomendación**

No seguir expandiendo cuotas hasta cerrar una auditoría completa del flujo.

**Trabajo técnico esperado**

- revisar creación de cuotas desde ParsePreview y flujos manuales
- validar expansión de filas en `expenses`
- validar edición y borrado de grupos
- validar impacto en movimientos, tarjetas, analytics y Home
- documentar comportamiento esperado

**Riesgos / edge cases**

- cuotas con tarjeta vs otros medios
- eliminación parcial del grupo
- cambio de mes
- cálculo de compromisos y cierre de tarjeta

**Criterio de cierre**

- el flujo completo está auditado
- el comportamiento esperado está documentado
- hay tests para inserción y borrado grupal

**Prioridad**

P0

## P1 · Estructural

### 3.6 Rollover: cerrar alcance real de producto

**Problema**

`rollover` existe como parte importante del sistema, pero no está completamente estabilizado como concepto de producto. Además, `manual` existe en tipos/lógica y no está claramente expuesto o consolidado.

**Por qué existe hoy**

Se incorporó para resolver continuidad entre meses cuando el sistema todavía estaba apoyado en una lógica más mensual.

**Impacto real**

- complejiza Home
- complejiza onboarding y cuentas
- se cruza con ingresos y balances iniciales
- genera estados proyectados y mensuales difíciles de explicar

**Decisión pendiente**

Definir si rollover:

- sigue siendo feature central
- queda sólo como ayuda de snapshot mensual
- o deja de participar del cálculo principal del dinero vivo

**Recomendación**

Reducir el alcance contable de rollover y dejarlo como herramienta de período, no como base del modelo principal.

**Trabajo técnico esperado**

- revisar todos los caminos `auto`, `manual`, `off`
- definir qué ve el usuario en cada modo
- decidir si `manual` se expone formalmente o se elimina

**Riesgos / edge cases**

- navegación al mes siguiente
- meses cerrados vs abiertos
- usuarios con datos legacy

**Criterio de cierre**

- producto tiene una postura clara sobre rollover
- UI y lógica soportan exactamente los modos vigentes

**Prioridad**

P1

---

### 3.7 Duplicación de lógica financiera

**Problema**

Hay partes importantes de la lógica de negocio repetidas entre:

- `/api/dashboard`
- `/api/dashboard/account-breakdown`
- `/api/analytics-data`
- `lib/rollover`
- posiblemente otras superficies

**Por qué existe hoy**

Las features crecieron por capas y cada endpoint resolvió su cálculo localmente.

**Impacto real**

- un bug corregido en un lado puede seguir vivo en otro
- alto riesgo de divergencia
- mantenimiento lento
- hace más difícil testear

**Decisión pendiente**

Definir qué cálculos deben vivir como primitives compartidas y qué puede seguir local a cada endpoint.

**Recomendación**

Extraer núcleo contable compartido a funciones puras en `lib/`.

**Trabajo técnico esperado**

- detectar fórmulas repetidas
- identificar outputs canónicos
- extraer helpers puros reutilizables
- reducir lógica ad hoc por endpoint

**Riesgos / edge cases**

- no sobregeneralizar demasiado rápido
- no romper diferencias legítimas entre vista mensual y contabilidad viva

**Criterio de cierre**

- las fórmulas centrales existen una sola vez
- endpoints distintos reutilizan primitives comunes

**Prioridad**

P1

---

### 3.8 Features legacy aún activas

**Problema**

Hay flujos, rutas y componentes que siguen existiendo aunque ya no sean el camino principal del producto.

Ejemplos típicos:

- `/expenses` como ruta legacy
- settings legacy vs `CuentaSheet`
- flows de ingresos viejos
- componentes todavía presentes pero no centrales

**Por qué existe hoy**

La app evolucionó sin una fase posterior de consolidación y poda.

**Impacto real**

- más superficie para mantener
- ambigüedad sobre cuál es la UX oficial
- costo de onboarding para desarrollo futuro

**Decisión pendiente**

Decidir qué legacy:

- se mantiene oficialmente
- se migra
- o se elimina

**Recomendación**

Hacer un inventario de superficies legacy y decidir una por una si viven o se recortan.

**Trabajo técnico esperado**

- listar rutas y componentes legacy
- marcar owner y status
- eliminar lo muerto
- documentar lo que sigue vigente

**Criterio de cierre**

- cada flow tiene un status explícito: oficial, compatibilidad o deprecado

**Prioridad**

P1

## P2 · Calidad / Robustez

### 3.9 Límite diario de 50 gastos no implementado de verdad

**Problema**

La regla existe en schema/documentación, pero no está efectivamente aplicada en el flujo actual.

**Por qué existe hoy**

La función SQL quedó definida, pero no se integró al endpoint o al guardado real.

**Impacto real**

- diferencia entre producto prometido y producto real
- protección anti-spam incompleta

**Decisión pendiente**

Definir si la regla sigue vigente como política de producto.

**Recomendación**

Si sigue vigente, integrarla de forma real y visible. Si no, sacarla de docs y expectativas.

**Trabajo técnico esperado**

- revisar endpoint de creación de gastos
- integrar chequeo server-side
- definir mensaje de error/UX

**Criterio de cierre**

- la regla se cumple realmente o se retira oficialmente

**Prioridad**

P2

---

### 3.10 Rate limiting de Gemini no persistente

**Problema**

El rate limit actual del parser AI vive en memoria del proceso.

**Por qué existe hoy**

Fue la forma más rápida de proteger el endpoint en desarrollo.

**Impacto real**

- en serverless no es una defensa confiable
- puede resetearse con cold starts o instancias múltiples

**Decisión pendiente**

Definir si el rate limit debe ser:

- hard limit confiable
- soft deterrent
- o sólo protección básica temporal

**Recomendación**

Moverlo a una solución persistente si el endpoint ya es parte estable del producto.

**Trabajo técnico esperado**

- elegir almacenamiento de rate limit
- definir ventana y política de bloqueo
- revisar impacto por usuario anónimo vs autenticado

**Criterio de cierre**

- el límite es consistente entre instancias y reinicios

**Prioridad**

P2

---

### 3.11 Falta de tests en lógica financiera

**Problema**

No hay cobertura automática en las partes más delicadas del sistema.

**Por qué existe hoy**

La app priorizó velocidad de construcción y validación manual.

**Impacto real**

- regresiones silenciosas
- miedo a refactorizar
- costo alto para tocar Home, movimientos y analytics

**Decisión pendiente**

Definir una estrategia mínima viable de tests, no total.

**Recomendación**

Empezar por tests de funciones puras y flujos contables sensibles.

**Trabajo técnico esperado**

- elegir runner
- cubrir cálculo de `Saldo Vivo`
- cubrir rollover
- cubrir transferencias cross-currency
- cubrir cuotas
- cubrir agregaciones de movimientos y analytics

**Criterio de cierre**

- existe una primera suite enfocada en cálculos críticos
- refactors de Home pueden apoyarse en tests

**Prioridad**

P2

---

### 3.12 Falta de error boundaries y fallback states

**Problema**

Si falla Supabase, un RPC o una carga relevante, la experiencia no siempre se recupera bien ni comunica claramente qué pasó.

**Por qué existe hoy**

El foco estuvo en el camino feliz.

**Impacto real**

- fallos silenciosos
- menor resiliencia
- debugging más lento

**Decisión pendiente**

Definir el estándar de errores del producto:

- qué se muestra al usuario
- qué se reintenta
- qué se loguea

**Recomendación**

Incorporar fallback UI y boundaries al menos en dashboard, analytics y movimientos.

**Trabajo técnico esperado**

- revisar rutas críticas
- definir componentes de error
- separar errores de red, auth y datos

**Criterio de cierre**

- las superficies principales fallan de forma visible y recuperable

**Prioridad**

P2

## P3 · Limpieza / Legacy

### 3.13 Documentación desalineada con el producto real

**Problema**

Parte de la documentación ya no refleja el sistema actual.

**Por qué existe hoy**

Los rediseños y cambios de arquitectura fueron más rápidos que la actualización de docs.

**Impacto real**

- decisiones basadas en documentos viejos
- fricción para retomar contexto
- confusión entre “plan”, “estado real” y “dirección”

**Decisión pendiente**

Definir qué documentos son fuente de verdad y cuáles son sólo históricos.

**Recomendación**

Separar claramente:

- docs vigentes
- docs históricas
- docs de trabajo temporales

**Trabajo técnico esperado**

- etiquetar docs
- archivar o marcar desactualizadas
- dejar una tabla índice de referencia

**Criterio de cierre**

- es evidente qué documento manda en cada tema

**Prioridad**

P3

---

### 3.14 Código muerto o semiabandonado

**Problema**

Hay módulos, utilidades o flows que siguen presentes aunque ya no representen el camino activo del sistema.

**Impacto real**

- más ruido al leer el proyecto
- más riesgo de tocar algo equivocado
- falsa sensación de soporte oficial

**Recomendación**

Hacer una pasada de limpieza después de cerrar primero las decisiones estructurales.

**Trabajo técnico esperado**

- identificar imports muertos o módulos no usados
- eliminar o mover a archivo histórico

**Criterio de cierre**

- el árbol del proyecto refleja el producto real

**Prioridad**

P3

---

### 3.15 Problemas de encoding y consistencia de copy

**Problema**

Hay textos y archivos con caracteres rotos o encoding inconsistente.

**Impacto real**

- apariencia poco cuidada
- riesgo de errores en docs y UI

**Recomendación**

Normalizar encoding y revisar copy visible.

**Criterio de cierre**

- no hay strings visibles con corrupción de caracteres

**Prioridad**

P3

## 4. Orden sugerido de ejecución

Secuencia recomendada:

1. cerrar fuente de verdad de `Saldo Vivo`
2. definir rol de `monthly_income`
3. definir rol de `account_period_balance`
4. cerrar alcance real de rollover
5. auditar cuotas
6. extraer lógica financiera compartida
7. cubrir con tests los cálculos críticos
8. activar límites y robustez operativa
9. podar legacy
10. actualizar documentación

Este orden no es arbitrario. La lógica es:

- primero decidir el modelo
- después consolidar la implementación
- recién entonces limpiar y documentar

## 5. Decisiones de producto pendientes

Estas decisiones no deberían quedar implícitas en el código:

### A. Qué es exactamente `Saldo Vivo`

Hay que definirlo en una frase operativa y una fórmula oficial.

### B. Qué lugar tiene el mes en el modelo

Hay que decidir si el mes es:

- una vista analítica
- un snapshot
- o una pieza central de la contabilidad

### C. Qué features siguen oficialmente vivas

Hay que explicitar:

- legacy que se soporta
- legacy que se depreca
- features que están en beta o transición

### D. Qué tan contable quiere ser Gota

Hay que marcar el punto de equilibrio entre:

- precisión contable
- simplicidad de UX
- velocidad de uso

Sin esa decisión, varias deudas reaparecen con otro nombre.

## 6. Riesgos si esto no se trabaja

Si estas deudas siguen abiertas:

- seguirán apareciendo bugs de consistencia en Home
- cada feature nueva costará más de integrar
- habrá más riesgo de desalineación entre UI y cálculo real
- el onboarding técnico del proyecto seguirá siendo caro
- el producto puede perder confianza justo en la parte más sensible: el dinero mostrado

## 7. Checklist operativo

### P0

- [x] definir fuente de verdad de `Saldo Vivo`
- [~] decidir futuro de `monthly_income`
- [ ] decidir rol de `account_period_balance`
- [ ] cerrar `Disponible Real` con migración y etiquetado legacy aplicado en Supabase
- [ ] auditar cuotas de punta a punta

### P1

- [~] decidir futuro real de rollover
- [ ] unificar lógica financiera duplicada
- [~] inventariar y clasificar features legacy

### P2

- [ ] activar o retirar límite diario de 50 gastos
- [ ] endurecer rate limiting de Gemini
- [ ] crear primera suite de tests financieros
- [ ] agregar error boundaries / fallbacks críticos

### P3

- [ ] ordenar documentación
- [ ] remover código muerto
- [ ] corregir encoding y copy inconsistente

## 8. Recomendación de trabajo

La forma correcta de usar este roadmap no es atacar veinte cosas en paralelo.

La recomendación es trabajar por bloques:

1. bloque de definición del modelo financiero
2. bloque de consolidación técnica
3. bloque de robustez
4. bloque de limpieza

Si se intenta limpiar legacy antes de cerrar la arquitectura contable, lo más probable es que haya que rehacer decisiones después.
