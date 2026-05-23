# Analysis UI — Documento de iteración

## Objetivo
Definir la arquitectura visual de la pantalla de Analysis sin mezclar en una sola jerarquía:
- resumen general
- insights
- movimientos
- budgets
- metas

## Problema actual
La pantalla está empezando a acumular varios módulos importantes, y si todos se muestran con el mismo peso visual, se pierde la lectura principal.

Hoy hay riesgo de que parezca que conviven varias pantallas dentro de una sola:
- resumen / análisis
- insights
- budget
- metas futuras

## Pregunta principal de la pantalla
La pantalla debe responder primero:

> ¿Cómo va el mes?

Todo lo demás debe servir a esa pregunta.

## Jerarquía recomendada

### Capa 1 — Hero / estado general
La parte superior debe resumir el estado del mes.

Debe contener solo lo esencial:
- percibido
- total gastado
- diferencia / gap
- estado general del mes

No debe incluir demasiados módulos ni competir con otras secciones.

### Capa 2 — Navegación secundaria
Debajo del hero, una navegación corta para alternar entre modos de lectura.

Propuesta:
- `Resumen`
- `Insights`

Opcionalmente, si el diseño lo necesita:
- `Resumen`
- `Insights`
- `Control`

Pero no conviene que budgets y metas entren como tabs top-level al mismo nivel que Summary.

### Capa 3 — Contenido por modo

#### Resumen
Debe ser la vista por defecto.
Incluye:
- comparación contra meses previos
- comportamiento del mes
- top categorías
- tendencia
- movimientos destacados

#### Insights
Debe mostrar:
- cards de detalle
- anomalías
- explicaciones más finas
- desgloses adicionales

#### Control
Si existe como agrupador, puede contener:
- budgets
- metas
- estados de seguimiento

## Regla de diseño
**Una sola historia principal, varios módulos secundarios.**

La historia principal es:
> así va tu mes

Los módulos secundarios explican o controlan:
- por qué va así
- dónde estás limitado
- qué objetivos querés cumplir

## Cómo conviven los componentes
### Resumen
Es la vista principal de análisis.

### Insights
Es la vista de detalle / explicación.

### Budgets
Es control operativo.
No debe competir con resumen.

### Metas
Es horizonte futuro.
Debe aparecer como capa posterior, no como protagonista inicial.

## Layout propuesto

```text
ANÁLISIS

[ estado global del mes ]

[ Resumen ] [ Insights ]

-------------------------------------
RESUMEN
-------------------------------------
- comparación vs meses previos
- tendencia del mes
- top categorías
- movimiento destacado

-------------------------------------
CONTROL
-------------------------------------
Budgets
Metas
```

## Preguntas abiertas
Estas decisiones todavía hay que cerrarlas:

1. ¿Budgets y metas viven dentro de Analysis o como subsecciones internas?
2. ¿Insights es una tab, un bloque o una vista separada?
3. ¿El hero muestra percibido, total gastado o disponible real como número principal?
4. ¿El resumen debe priorizar comparación mensual o comportamiento interno del mes?
5. ¿Queremos una navegación tipo tabs o una pantalla vertical con secciones?

## Criterio de éxito
La pantalla está bien resuelta si:
- el usuario entiende de un vistazo cómo va el mes
- no siente que hay dos o tres pantallas peleando arriba
- puede ir de visión general a detalle sin perder contexto
- budgets y metas aportan control sin romper la lectura principal

## Decisión de producto
Analysis debe ser la pantalla madre.
Todo lo demás cuelga de esa narrativa, no compite con ella.
