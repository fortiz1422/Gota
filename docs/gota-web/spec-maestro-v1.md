# Gota Web - Spec Maestro V1

## 1. Vision

`Gota Web` es la consola financiera desktop de Gota.

No es un panel de reportes.
No es una version agrandada del home mobile.
No es un asesor automatico.

Es un espacio para entender la situacion financiera real, leer tensiones de corto plazo y ver como la caja actual se transforma en margen disponible.

Tesis central:

`Mobile para registrar. Web para entender y decidir.`

## 2. Objetivo del producto

La primera version debe responder tres preguntas con claridad:

1. Cuanto tengo hoy.
2. Cuanto de eso realmente me queda libre.
3. Que tensiones financieras vienen ahora y en los proximos 90 dias.

## 3. Posicionamiento

Gota Web debe sentirse como:

- una consola financiera personal
- un personal CFO dashboard
- una capa de lectura e interpretacion sobre datos reales

No debe sentirse como:

- un SaaS corporativo
- un home bancario
- una grilla de charts
- una IA que opina sin fundamento

## 4. Principios de producto

- Describe primero.
- Interpreta segundo.
- Aconseja no, al menos en V1.
- La verdad del producto viene de reglas, datos y calculos, no del texto generado.
- La jerarquia importa mas que la cantidad de modulos.
- Cada bloque debe ayudar a explicar `Saldo Vivo`, `Disponible Real` o la diferencia entre ambos.

## 5. Conceptos centrales

### Saldo Vivo

La foto actual de caja del usuario.

### Disponible Real

La parte de esa caja que realmente esta libre despues de compromisos y reservas.

### Brecha

La diferencia entre `Saldo Vivo` y `Disponible Real`.

Formula conceptual:

`Saldo Vivo - Disponible Real = dinero que existe, pero ya tiene destino`

En V1, la brecha se compone por:

- compromisos proximos
- tarjeta en curso
- reservas
- capital inmovilizado, si aplica como subcomponente visible

## 6. Tono del producto

Voz:

- clara
- sobria
- humana
- interpretativa
- confiable

Debe evitar:

- dramatizacion
- coaching
- consejos fuertes
- lenguaje grandilocuente
- frases vacias sin base

## 7. Alcance V1

### Core V1

- Hero con `Saldo Vivo`, `Disponible Real` y `brecha explicada`
- `Atencion Ahora`
- `Horizonte 90 dias`
- `Compromisos`
- `Liquidez por moneda`
- `Actividad reciente`

### V1 Plus si llegamos

- `Suscripciones`
- `Instrumentos`

### Postergado a V2

- `Metas` como modulo completo y profundo
- `Brief diario` generado por LLM en produccion
- simulaciones `what-if`
- prediccion mas sofisticada
- recomendaciones explicitas

## 8. Arquitectura conceptual de la pantalla

### Top fold

- Sidebar izquierda
- Topbar liviana
- Gran hero principal dominante

### Segundo nivel

- `Atencion Ahora`
- `Horizonte 90 dias`
- `Compromisos`

### Tercer nivel

- `Liquidez por moneda`
- `Actividad reciente`
- `Suscripciones` opcional
- `Instrumentos` opcional
- `Metas` solo si entra como preview secundaria

## 9. Modulo: Hero principal

### Objetivo

Ser la pieza principal del dashboard.
Debe explicar de forma inmediata la situacion actual del usuario.

### Contenido

- brief corto tipo CFO
- `Saldo Vivo`
- `Disponible Real`
- frase de brecha: `ARS X de tu caja ya tiene destino`
- breakdown de la brecha
- visual simple de margen disponible proyectado, si suma claridad

### Orden narrativo

1. cuanto tengo
2. cuanto realmente me queda
3. por que hay diferencia

### Contenido estructural

- `Saldo Vivo`
- `Disponible Real`
- `Compromisos proximos`
- `Tarjeta en curso`
- `Reservas`

## 10. Modulo: Atencion Ahora

### Objetivo

Mostrar senales tacticas que requieren mirada hoy o en los proximos dias.

### Senales V1 confirmadas

- cierre de tarjeta cercano
- vencimiento cercano
- varios dias sin registrar
- gasto inusual o extraordinario

### Reglas

- mostrar entre 1 y 4 senales
- no inventar tension si no la hay
- ordenar por prioridad
- evitar alert fatigue

## 11. Modulo: Horizonte 90 dias

### Objetivo

Mostrar los eventos relevantes de los proximos 90 dias en una logica temporal legible.

### Formato

Hibrido:

- timeline superior
- agenda resumida inferior

### Eventos posibles

- cierres de tarjeta
- vencimientos
- cuotas
- metas
- instrumentos

## 12. Modulo: Compromisos

### Objetivo

Dar una vista ejecutiva de la estructura actual de compromisos ya modelada en la app.

### Debe alinearse con la logica existente

- vencidos
- cerrados
- en curso
- pagados

### Formato recomendado

Hibrido:

- resumen superior por estado
- detalle corto inferior por tarjeta

## 13. Modulo: Liquidez por moneda

### Objetivo

Mostrar como esta distribuida la liquidez real del usuario entre ARS y USD.

### Contenido

- ARS disponible
- USD disponible
- tipo de cambio de referencia
- lectura simple de concentracion monetaria

## 14. Modulo: Actividad reciente

### Objetivo

Dar contexto rapido sobre movimientos recientes.

### Formato

- breve
- curado
- limpio
- sin parecer una tabla de backoffice

## 15. Modulo: Suscripciones

Estado: secundario en V1.

Debe mostrar:

- total mensual
- proximos debitos
- suscripciones sin revisar

## 16. Modulo: Instrumentos

Estado: secundario en V1.

Debe mostrar:

- capital inmovilizado
- proximo vencimiento
- rendimiento acumulado

## 17. Modulo: Metas

Estado: V2 o preview opcional.

Objetivo conceptual:

Permitir modelar reservas voluntarias y objetivos financieros, incluso en USD.

## 18. Data quality

El dashboard debe poder degradarse con honestidad.

Debe poder expresar:

- lectura confiable
- lectura parcial
- falta historial
- faltan registros recientes
- falta tipo de cambio
- no hay ingresos suficientes para ciertas lecturas

## 19. Gasto extraordinario o inusual

Modelo conceptual:

- `extraordinario manual`
- `inusual detectado automaticamente`

Regla de producto:

- manual = verdad declarada por el usuario
- automatico = sugerencia del sistema, no sentencia

## 20. Brief y narrativa

### V1

No depende de LLM en produccion como feature core.

### Principio futuro

Si existe brief, debe:

- narrar senales ya resueltas
- no improvisar
- no descubrir insights desde cero
- no generar afirmaciones no trazables

Cadena correcta:

`datos -> senales -> veredicto -> texto`

## 21. Diseno y sistema visual

Debe alinearse con el design system vigente de Gota:

- light mode only
- fondo blanco
- superficies frias suaves
- tipografia `DM Sans`
- accent azul `#2178A8`
- texto oscuro `#0D1829`
- menos cards genericas
- mas jerarquia limpia
- iconos Phosphor Light
- sombras sutiles
- precision antes que ornamento

## 22. Criterios de exito

Un usuario deberia poder entrar y entender en menos de 10 segundos:

- su caja actual
- su margen real
- la principal tension de corto plazo
- los proximos eventos importantes

## 23. Decisiones ya tomadas

- El producto V1 es un mix, pero con prioridad en `describir + interpretar`
- No aconseja agresivamente
- `Saldo Vivo` y `Disponible Real` son la dupla central
- El hero debe seguir la secuencia `cuanto tengo -> cuanto me queda`
- `Atencion Ahora` incluye cierre de tarjeta, vencimiento, dias sin registrar y gasto inusual o extraordinario
- `Compromisos` se alinea con la logica actual de la app
- `Horizonte 90 dias` contempla cierres, vencimientos, cuotas, metas e instrumentos
- `Liquidez por moneda` entra al core
- `Metas` no son core V1

## 24. Pendientes abiertos

- formula exacta de cada componente de la brecha
- umbrales concretos para `Atencion Ahora`
- reglas exactas de deteccion automatica de gasto inusual
- payload y arquitectura de datos dashboard
- contrato de una posible RPC maestra
- definicion operativa de reservas
- alcance real de instrumentos en V1
- momento exacto en que entra el brief generado

## 25. Resumen ejecutivo

Gota Web V1 es un dashboard desktop de lectura financiera real.
Su nucleo es la relacion entre `Saldo Vivo` y `Disponible Real`.
El producto no viene a opinar libremente ni a dar consejos fuertes; viene a mostrar, explicar y priorizar.
