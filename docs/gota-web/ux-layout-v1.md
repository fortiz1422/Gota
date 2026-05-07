# Gota Web - UX Layout V1

## 1. Objetivo de este documento

Definir la estructura visual y UX del dashboard desktop V1 para que el producto se vea y se sienta coherente con Gota, con jerarquia clara y foco en lectura financiera real.

## 2. Direccion general

El dashboard debe sentirse como:

- una consola financiera personal
- una experiencia calmada y premium
- una superficie de lectura y criterio

No debe sentirse como:

- una grilla de cards genericas
- un backoffice corporativo
- un mosaico sobrecargado de features

## 3. Jerarquia de lectura

La pantalla debe leerse en este orden:

1. Hero principal
2. `Atencion Ahora`
3. `Horizonte 90 dias`
4. `Compromisos`
5. Modulos secundarios

## 4. Arquitectura de pantalla

### Sidebar izquierda

Debe ser:

- limpia
- estable
- de bajo ruido

Contenido sugerido:

- logo Gota
- `Hoy`
- `Horizonte`
- `Metas`
- `Movimientos`
- `Cuentas`

### Topbar

Debe ser muy liviana.

Contenido sugerido:

- fecha
- selector de periodo
- busqueda
- CTA o acceso a resumen ejecutivo
- avatar/perfil

## 5. Hero principal

### Rol

Es la pieza dominante del dashboard.

Debe comunicar:

1. cuanto tengo hoy
2. cuanto realmente me queda
3. por que esa diferencia importa

### Estructura recomendada

- brief corto superior
- bloque `Saldo Vivo`
- bloque `Disponible Real`
- bloque de brecha explicada
- grafico de margen disponible proyectado, si mejora la comprension

### Copy clave

La frase de brecha debe ser central:

`ARS X de tu caja ya tiene destino`

### Breakdown de brecha

No mas de 3 o 4 drivers:

- compromisos proximos
- tarjeta en curso
- reservas

### Regla UX

La diferencia entre `Saldo Vivo` y `Disponible Real` no debe verse como una resta contable opaca, sino como una explicacion humana y trazable.

## 6. Atencion Ahora

### Rol

Agenda ejecutiva tactica de corto plazo.

### UX deseada

- entre 1 y 4 items
- lista priorizada
- lectura muy rapida
- peso medio, no protagonista absoluto

### Senales

- cierre de tarjeta cercano
- vencimiento cercano
- varios dias sin registrar
- gasto inusual o extraordinario

### Regla UX

Debe sentirse como agenda priorizada, no como centro de notificaciones.

## 7. Horizonte 90 dias

### Rol

Es una de las piezas diferenciales del producto.

### Formato recomendado

Hibrido:

- timeline superior
- agenda inferior

### UX deseada

- mucho aire
- gran legibilidad temporal
- protagonismo mayor que una card comun

### Tipos de evento

- cierres
- vencimientos
- cuotas
- metas
- instrumentos

### Regla UX

No debe listar todo.
Debe curar lo relevante.

## 8. Compromisos

### Rol

Explicar una parte critica de la brecha del hero.

### Formato recomendado

- resumen superior por estado
- detalle corto por tarjeta abajo

### Estados

- vencidos
- cerrados
- en curso
- pagados

### Regla UX

No hacer tabla dura.
Debe conservar precision, pero verse ejecutiva y facil de escanear.

## 9. Liquidez por moneda

### Rol

Mostrar en que moneda esta el margen real del usuario.

### Contenido

- ARS disponible
- USD disponible
- tipo de cambio de referencia
- lectura breve de concentracion monetaria

### Regla UX

No parecer una pantalla de trading ni de cotizaciones.

## 10. Actividad reciente

### Rol

Contexto breve.

### Formato

- pocos items
- alta legibilidad
- sin tabla pesada

## 11. Modulos secundarios

### Suscripciones

Debe verse como modulo complementario.

### Instrumentos

Debe verse como modulo complementario.

### Metas

En V1 no debe competir con el core.
Si aparece, debe hacerlo como preview o bloque de soporte.

## 12. Direccion visual

La interfaz debe alinearse con el design system vigente:

- light mode only
- fondo blanco
- superficies frias y suaves
- `DM Sans`
- azul Gota como accent
- iconografia `Phosphor Light`
- menos cards genericas
- mas separadores finos y jerarquia limpia

## 13. Lo que queremos evitar

- demasiadas cajas con el mismo peso
- charts innecesarios
- frialdad corporativa
- exceso de decoracion
- hero comprimido
- modulos secundarios compitiendo con el core

## 14. Direccion inspiracional para mockups

La mejor base actual para seguir iterando es:

- estructura general de `Direccion 2 - The Waterfall`
- tono narrativo y calidez de `Direccion 1 - The Brief`
- ambicion temporal y protagonismo del horizonte de `Direccion 3 - The Console`

## 15. Regla final de experiencia

Si el usuario no entiende rapido:

- cuanto tiene
- cuanto realmente le queda
- que tension importa hoy
- que se viene en los proximos 90 dias

entonces la pantalla todavia no esta resuelta.
