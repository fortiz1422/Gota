# Gota — Design System v2.0
> Spec de referencia para implementación. Refleja todas las decisiones tomadas en la sesión de diseño de abril 2026.

---

## 1. Paleta de colores

### Fondo y superficies

| Token | Valor | Uso |
|---|---|---|
| `bgPrimary` | `#FFFFFF` | Fondo principal de todas las pantallas |
| `surfaceGlass` | `rgba(190,225,248,0.28)` + `blur(24px)` | Superficies glass — SmartInput, widget de métricas en Insights cards |
| `surfaceModule` | `#FFFFFF` + `box-shadow: 0 1px 6px rgba(0,0,0,0.07)` | Módulos elevados — widget de métricas en Movimientos |
| `separator` | `rgba(33,120,168,0.07)` | Separadores de lista, bordes internos |

**Regla de jerarquía:**
- Listas, hero text, Necesidad/Deseo → fluyen sobre `bgPrimary` directo, sin superficie
- SmartInput, insight cards (Fuga, Hábitos, Compromisos) → `surfaceGlass`
- Widget de métricas en Movimientos → `surfaceModule` (blanco + sombra, sin tinte)

### Colores semánticos

| Token | Valor | Uso |
|---|---|---|
| `textPrimary` | `#0D1829` | Texto principal, montos de egreso |
| `textSecond` | `#4A6070` | Texto secundario |
| `textDim` | `#90A4B0` | Captions, labels inactivos, subtextos |
| `accent` | `#2178A8` | Todo lo interactivo (ver abajo) |
| `data` | `#1B7E9E` | Datos neutros, transferencias |
| `green` | `#1A7A42` | Ingresos únicamente |
| `orange` | `#B84A12` | Deseo, Percibidos, alertas |
| `danger` | `#A61E1E` | Estados de error, saldo negativo |

### Regla de color en montos
- **Egresos** → `textPrimary` (negro neutro). El signo `-` comunica la dirección.
- **Ingresos** → `green`
- **Rojo reservado** para situaciones de alarma real: saldo negativo, límite superado

### Regla de accent
El `accent` se aplica a **todo elemento interactivo o navegable**:
- Botón `+`
- "Ver detalle", "Ver todas (N)"
- Toggle ARS/USD — activo en `accent`, inactivo en `textDim`
- Chevrons de navegación de mes (`‹ Abril ›`)
- Chevron Down del selector de mes en Análisis
- Botón "Insights" (borde + texto en `accent`)
- Back navigation ("‹ Diario")
- Chevrons de drill-down en insight cards

---

## 2. Tipografía

Font: **DM Sans**. Six-level scale, cuatro pesos únicamente: 400 / 500 / 700 / 800.

| Nivel | Size | Weight | Color | Uso |
|---|---|---|---|---|
| `display` | 40px | 800 | `textPrimary` | Hero numbers — Saldo Vivo, montos grandes |
| `title1` | 22px | 800 | `textPrimary` | Títulos de pantalla, hero text de Diario |
| `title2` | 16px | 700 | `textPrimary` | Nombres de categoría con monto |
| `body` | 15px | 500 | `textPrimary` | Nombre de movimiento, contenido de lista |
| `caption` | 12px | 400 | `textDim` | Subtexto — categoría · fecha, descripciones |
| `label` | 11px | 700 | `textSecond` | Etiquetas uppercase — "SALDO VIVO", "PERCIBIDOS" |

**Reglas:**
- `caption` es **siempre** `textDim` — nunca `textSecond`
- `label` tiene `letter-spacing: 0.8px` y `text-transform: uppercase`
- Solo cuatro pesos en uso: 400, 500, 700, 800. Nunca 600.

---

## 3. Íconos de categoría / transacción

- **Forma:** círculo, 32×32px
- **Fondo:** `${color}12` — el color semántico al 7% de opacidad
- **Ícono:** Phosphor Light, 15px, stroke 1.5px, color semántico
- **Aplica en:** todas las filas de Home, Movimientos y Análisis

Esto reemplaza el contenedor cuadrado redondeado con fondo pastel sólido anterior.

---

## 4. Navegación

### Tab bar
- 3 tabs: **Home / Movimientos / Análisis**
- Labels siempre visibles en los tres tabs (activo e inactivo)
- Tab activo: ícono stroke 2px + label 600 weight, color `accent`
- Tab inactivo: ícono stroke 1.5px + label 400 weight, color `textDim`
- Fondo: `rgba(255,255,255,0.97)` + `blur(16px)` + border top `separator`
- Sin píldora, sin background custom, sin decoración

### Botón `+`
- Presente en las **tres pantallas** — Home, Movimientos, Análisis
- Posición: top bar, lado derecho, antes del último elemento
- Estilo: círculo 36px, fondo `accent`, ícono `plus` blanco 17px stroke 2.2
- Abre el sheet de "¿Qué querés agregar?" desde cualquier pantalla

### Análisis / Insights
- El tab se llama **Análisis** y muestra **Diario** como vista por defecto
- **Insights** es una pantalla navegada desde Diario, no un toggle hermano
- Acceso: botón pill "Insights" con border `accent` en la top bar de Diario
- Back navigation: "‹ Diario" en `accent`, top bar izquierda

---

## 5. Pantallas — decisiones por pantalla

### Home

| Elemento | Decisión |
|---|---|
| Hero (Saldo Vivo) | Directo sobre `bgPrimary`, sin contenedor |
| Toggle ARS/USD | ARS activo en `accent`, USD en `textDim` |
| "Ver detalle" | `accent` + chevron |
| Necesidad/Deseo | Sin surface, fluye sobre fondo. Label + barra + caption |
| Lista de movimientos | Sobre fondo directo, separadores `separator`, sin cards por fila |
| Montos de egreso | `textPrimary` neutro |
| SmartInput | Al final de la pantalla, después de los movimientos. Surface `surfaceGlass` |

### Movimientos

| Elemento | Decisión |
|---|---|
| Header | Sin título de pantalla — el tab ya dice "Movimientos". Solo `‹ Abril ›` con chevrons en `accent` |
| Widget de métricas | `surfaceModule` (blanco + sombra, **sin tinte glass**). Radio 22px |
| Jerarquía de métricas | Percibidos hero (28px/800/`orange`) + descripción. Tarjeta y Pago Tarjeta secundarios en fila debajo |
| Filtro | Inline con el separador de fecha del primer grupo, alineado a la derecha. Opacidad 0.35 en inactivo, `accent` en activo |
| Lista | Sobre `bgPrimary` directo, separadores de línea |
| Fechas | `caption` / `textDim`, formato "Jueves, 9 de abril" (sin mayúsculas en D/A) |

### Diario (Análisis tab)

| Elemento | Decisión |
|---|---|
| Hero text | Directo sobre fondo, sin contenedor. `title1` |
| Chips de insight | Fondo semántico al 10%, border al 35%. Texto en color semántico |
| Toggle "Solo percibidos" | `caption` para label, toggle switch estándar |
| Categorías | Lista sobre fondo directo, separadores de línea |
| "Ver todas (N)" | Botón con border `accent`, texto `accent` |

### Insights (pantalla navegada)

| Elemento | Decisión |
|---|---|
| Contenedor | `surfaceGlass` para los tres módulos |
| Bordes de radio | 16px |
| Íconos de módulo | Círculo 32px igual que TxIcon |
| Chevron drill-down | `accent` |
| Módulos | Fuga Silenciosa, Mapa de Hábitos, Compromisos |

---

## 6. Sheet "¿Qué querés agregar?"

Items del sheet (en orden):
1. Ingreso — `green`
2. Suscripción — `accent`
3. Cuotas en curso — `orange`
4. Transferencia — `data`
5. Pago de tarjeta — `#6B5B9E`

**Nota:** SmartInput en Home sigue siendo el fast path para gastos. No aparece en este sheet. Pago de tarjetas se migra desde Config a este sheet.

---

## 7. Border radius — sistema

| Elemento | Radio |
|---|---|
| Phone shell | 50px |
| Insight cards (glass) | 16px |
| Widget de métricas | 22px |
| SmartInput | 16px |
| Íconos de transacción | 50% (círculo) |
| Chips | 20px (pill) |
| Botón "Ver todas" | 12px |
| Separadores internos | 1px (no square) |

---

## 8. Lo que NO cambió

- SmartInput sigue en Home como fast path de gastos
- Pago de tarjetas permanece en Config por ahora (migración al sheet es backlog)
- Phosphor Light icons, stroke 1.5px — sin cambios
- DM Sans — sin cambios
- Tokens semánticos `green`, `orange`, `danger` — sin cambios

---

## 9. Backlog diseño (fuera de este sprint)

- Jerarquía de superficies global — revisión profunda de todas las pantallas secundarias
- Estados vacíos (empty states) en Movimientos y Análisis
- Dark mode — congelado, no prioritario
