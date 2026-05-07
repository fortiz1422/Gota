# Gota Web - Data Model Dashboard V1

## 1. Objetivo de este documento

Definir la semantica de datos del dashboard V1, que piezas necesitan datos compartidos y que debe resolverse con logica trazable para evitar ambiguedad de producto.

## 2. Principio general

La verdad financiera de Gota debe seguir siendo una sola.

Implica:

- mismo Supabase
- misma logica financiera compartida
- misma semantica para mobile y web

La superficie desktop puede tener una capa de agregacion propia, pero no debe inventar una verdad distinta.

## 3. Dupla central

### Saldo Vivo

Representa la foto actual de caja.

### Disponible Real

Representa la parte de esa caja que sigue libre despues de compromisos y reservas.

### Brecha

Representa la explicacion entre ambas metricas.

Formula conceptual:

`Saldo Vivo - Disponible Real = dinero que ya tiene destino`

## 4. Componentes de la brecha en V1

La brecha debe construirse con piezas reales, entendibles y defendibles.

Componentes propuestos:

- compromisos proximos
- tarjeta en curso
- reservas
- capital inmovilizado, si se muestra como parte de reservas o como driver explicito

No incluir en la brecha V1:

- proyecciones blandas
- supuestos no trazables
- gasto esperado futuro no confirmado
- recomendaciones

## 5. Atencion Ahora

Senales confirmadas:

- cierre de tarjeta cercano
- vencimiento cercano
- varios dias sin registrar
- gasto inusual o extraordinario

### Reglas conceptuales

- mostrar entre 1 y 4 items
- no inventar senales si no hay
- ordenar por prioridad
- degradar con honestidad si la calidad de datos es baja

### Pendiente

Definir umbrales exactos de disparo por cada senal.

## 6. Gasto extraordinario o inusual

### Niveles

- `manual`: extraordinario confirmado por el usuario
- `automatico`: gasto inusual detectado por el sistema

### Regla de producto

- manual gana siempre
- automatico es sugerencia contextual

### Uso futuro

- `Atencion Ahora`
- contexto del mes
- narrativa futura
- posible tratamiento especial en proyecciones

## 7. Horizonte 90 dias

### Eventos del modelo

- cierres de tarjeta
- vencimientos
- cuotas
- metas
- instrumentos

### Criterio

Aunque metas e instrumentos no esten completamente live en produccion hoy, el modelo del horizonte debe contemplarlos desde el inicio.

### Pendiente

Definir contrato de evento unificado para alimentar timeline y agenda.

## 8. Compromisos

Debe alinearse con la logica actual de la app.

Estados:

- vencidos
- cerrados
- en curso
- pagados

### Regla de modelado

La capa web debe presentar mejor esta informacion, no redefinirla.

## 9. Liquidez por moneda

Debe responder:

- cuanta liquidez real tengo en ARS
- cuanta liquidez real tengo en USD
- como se ve mi posicion total segun tipo de cambio actual

### Criterio

No es una pantalla de mercado.
Es una lectura de disponibilidad por moneda.

## 10. Data quality

El dashboard debe poder expresar:

- lectura confiable
- lectura parcial
- pocos meses de historial
- faltan registros recientes
- falta tipo de cambio
- faltan ingresos para ciertas lecturas

### Regla

La degradacion honesta es una feature, no un defecto.

## 11. Capa tecnica sugerida

### Compartido

- Supabase
- auth
- tipos
- logica financiera base
- queries reutilizables

### Desktop-specific

- capa agregada para dashboard web
- layout y componentes propios
- payloads pensados para hero, horizonte y agenda

## 12. Repo y estructura

Se recomienda mantener:

- mismo repo
- mismo Supabase
- misma base de tipos y logica

Y separar superficies por:

- `app/(mobile)`
- `app/(desktop)`
- `components/mobile`
- `components/desktop`

## 13. Despliegue

Opciones viables:

- mismo proyecto Vercel al inicio
- dos proyectos Vercel mas adelante si conviene separar operacion

La eleccion de despliegue no cambia la verdad de datos, que debe seguir siendo compartida.

## 14. Pendientes tecnicos principales

- formula exacta de brecha
- umbrales de `Atencion Ahora`
- modelo de reservas
- shape del payload del dashboard
- decision entre RPC maestra o capa hibrida SQL + TypeScript
- integracion futura de brief generado

## 15. Criterio rector

Todo dato del dashboard debe poder trazarse a una regla, una query o una fuente clara.

Si una afirmacion no puede explicarse con precision, no deberia formar parte del V1.
